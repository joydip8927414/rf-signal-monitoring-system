# Real Hardware Integration Guide: ESP32 & AD8318 RF Monitor

This guide explains how to connect physical hardware (ESP32 microcontroller + AD8318 RF power detector + NEO-7M GPS) to the **RF Signal Monitoring System**, switch between simulation and real hardware data, and display live measurements on the dashboard.

---

## 1. Hardware Architecture & Components

```text
 ┌────────────────┐          ┌───────────────────────┐
 │ AD8318 / AD8317│          │     NEO-7M / 6M GPS   │
 │ RF Detector    │          │     Module (UART)     │
 └───────┬────────┘          └───────────┬───────────┘
         │ Analog Vout                   │ Serial TX/RX
         ▼                               ▼
 ┌───────────────────────────────────────────────────┐
 │            ESP32 Microcontroller Node             │
 │  - Reads 12-bit ADC (AD8318 voltage)              │
 │  - Calculates RF Power (dBm), Noise, & SNR        │
 │  - Reads GPS Coordinates (NMEA sentences)         │
 │  - Connects to Wi-Fi (WPA2)                       │
 └─────────────────────────┬─────────────────────────┘
                           │ HTTPS / HTTP POST
                           ▼
 ┌───────────────────────────────────────────────────┐
 │                   Flask Backend                   │
 │       (Deployed on Render or running locally)     │
 │  - Ingestion endpoint: POST /api/device/measurements│
 │  - ML Anomaly Detector (Isolation Forest)         │
 │  - PostgreSQL / SQLite Storage                    │
 └─────────────────────────┬─────────────────────────┘
                           │ REST API
                           ▼
 ┌───────────────────────────────────────────────────┐
 │               React / Vite Dashboard              │
 │  - Live RF Power vs Time continuous chart         │
 │  - SNR, Noise floor, ADC, Detector Voltage        │
 │  - AI Status (NORMAL / ANOMALY)                   │
 │  - Interactive OpenStreetMap GPS coverage         │
 └───────────────────────────────────────────────────┘
```

### Required Components
1. **ESP32 Development Board** (NodeMCU-32S, ESP32-WROOM-32, etc.)
2. **AD8318 / AD8317 RF Logarithmic Detector Module** (Operating Range: 1 MHz to 8 GHz / 10 GHz, -60 dBm to 0 dBm)
3. **NEO-7M / NEO-6M GPS Module** (Optional, for GPS geographical tracking)
4. **SMA Antenna** (Matched to your target RF frequency band, e.g., 433 MHz, 868/915 MHz, 2.4 GHz, or broadband omnidirectional)
5. **Jumper Wires & Breadboard / Custom PCB**

---

## 2. Wiring & Pin Connections

### AD8318 to ESP32
| AD8318 Pin | ESP32 Pin | Notes |
| :--- | :--- | :--- |
| **VCC** | **5V** or **3.3V** | Recommended: 5V (from ESP32 VIN/5V pin for stable internal regulator) |
| **GND** | **GND** | Common ground with ESP32 |
| **VOUT** | **GPIO 34** (ADC1_CH6) | Use ADC1 pins (GPIO 32–39) because ADC2 is shared with Wi-Fi |
| **ENBL** | **3.3V** | Pull HIGH to enable the AD8318 detector |

> [!NOTE]
> The AD8318 output voltage typically ranges between **0.5V** (at 0 dBm maximum input power) and **2.1V** (at -60 dBm minimum input power). Because this is within the ESP32 ADC range (0V to 3.3V with 11 dB attenuation), it can be connected directly to GPIO 34 without a voltage divider.

### NEO-7M GPS to ESP32 (Optional)
| GPS Pin | ESP32 Pin | Notes |
| :--- | :--- | :--- |
| **VCC** | **3.3V** or **5V** | Power supply |
| **GND** | **GND** | Common ground |
| **TX** | **GPIO 16** (RX2) | Hardware Serial 2 Receive |
| **RX** | **GPIO 17** (TX2) | Hardware Serial 2 Transmit |

---

## 3. AD8318 Voltage-to-Power Calibration Math

The AD8318 has an inverse linear relationship between output voltage and RF input power:
$$V_{\text{out}} = \text{Slope} \times (P_{\text{in}} - P_{\text{intercept}})$$

Rearranging for Input Power ($P_{\text{in}}$ in dBm):
$$P_{\text{in}} (\text{dBm}) = \frac{V_{\text{out}} - V_{\text{intercept}}}{\text{Slope}}$$

* **Typical Slope:** $\approx -25\text{ mV/dB} = -0.025\text{ V/dB}$
* **Typical Intercept:** $\approx 2.1\text{ V}$ at $-65\text{ dBm}$ (or $0.5\text{ V}$ at $0\text{ dBm}$)
* **Linear conversion formula used in firmware:**
  $$\text{Signal dBm} = -60.0 + \frac{V_{\text{det}} - 0.5}{-0.025}$$

---

## 4. Connection Methods

The software supports two methods to connect physical hardware:

### Method A: Cloud Push Architecture (Recommended)
This is the standard production method for cloud deployments (such as Render + Vercel):
1. The ESP32 connects to local Wi-Fi.
2. Every 1.0 second, the ESP32 performs an HTTPS/HTTP `POST` request to your backend:
   ```http
   POST /api/device/measurements HTTP/1.1
   Host: your-backend.onrender.com
   Authorization: Bearer your-secure-device-token
   Content-Type: application/json

   {
     "device_id": "ESP32-RF-001",
     "signal_dbm": -52.4,
     "noise_dbm": -88.5,
     "snr_db": 36.1,
     "adc_value": 1820,
     "detector_voltage": 1.467,
     "lna_enabled": true,
     "latitude": 26.293498,
     "longitude": 89.459139,
     "altitude_m": 42.0
   }
   ```
3. The backend receives the payload, tags `data_source: "real"`, runs the AI anomaly detection model, stores it in the database, and updates the live stream.
4. **Zero router port-forwarding needed.** The ESP32 initiates outbound HTTPS connections directly to your cloud URL.

### Method B: Local LAN Pull Architecture
If running locally on a private Wi-Fi network:
1. The ESP32 runs a small web server on port 80 serving `/status` and `/measurement`.
2. In your backend `.env` file, configure:
   ```env
   RF_SOURCE=esp32
   ESP32_HOST=192.168.1.100
   ESP32_PORT=80
   ```
3. The Flask backend polls the ESP32 on the local network.

---

## 5. Complete ESP32 Firmware Sketch (Arduino C++)

Flash the following code to your ESP32 using the Arduino IDE or PlatformIO.

### Required Arduino Libraries:
* `WiFi` (Built-in ESP32)
* `HTTPClient` (Built-in ESP32)
* `ArduinoJson` (Library Manager: by Benoît Blanchon, version 6 or 7)
* `TinyGPSPlus` (Optional, if using GPS)

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// -------------------------------------------------------------
// 1. Wi-Fi & Backend Credentials
// -------------------------------------------------------------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Backend URL (e.g., Render URL or local IP: http://192.168.1.50:5000)
const char* BACKEND_URL   = "https://your-app-name.onrender.com/api/device/measurements";

// Must match DEVICE_TOKEN in your backend environment variables (.env)
const char* DEVICE_TOKEN  = "your-secure-device-token";
const char* DEVICE_ID     = "ESP32-RF-001";

// -------------------------------------------------------------
// 2. Hardware Pin Definitions
// -------------------------------------------------------------
const int PIN_AD8318_VOUT = 34; // ADC1 Channel 6
const int PIN_LNA_ENABLE  = 23; // Optional LNA control pin

// AD8318 Calibration Constants
const float V_INTERCEPT   = 0.5;   // Voltage at -60 dBm reference (Volts)
const float SLOPE         = -0.025; // Volts per dB (-25 mV/dB)
const float ADC_REF_VOLT  = 3.3;   // ESP32 ADC reference voltage
const int   ADC_MAX_COUNT = 4095;  // 12-bit ADC

// Rolling noise floor estimate
float estimated_noise_floor = -90.0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n[RF MONITOR] Starting Hardware Node...");

  // Configure ADC
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db); // Full-scale range ~0 to 3.1V

  // Configure LNA pin if used
  pinMode(PIN_LNA_ENABLE, OUTPUT);
  digitalWrite(PIN_LNA_ENABLE, HIGH); // Enable LNA

  // Connect to Wi-Fi
  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // 1. Sample ADC with averaging for stability
  long adc_sum = 0;
  const int NUM_SAMPLES = 64;
  for (int i = 0; i < NUM_SAMPLES; i++) {
    adc_sum += analogRead(PIN_AD8318_VOUT);
    delayMicroseconds(100);
  }
  int raw_adc = adc_sum / NUM_SAMPLES;

  // 2. Convert ADC counts to Detector Voltage
  float detector_voltage = (float(raw_adc) / float(ADC_MAX_COUNT)) * ADC_REF_VOLT;

  // 3. Convert Voltage to RF Power (dBm)
  // AD8318 formula: Pin = (Vout - V_intercept) / Slope - 60.0
  float signal_dbm = -60.0 + ((detector_voltage - V_INTERCEPT) / SLOPE);
  if (signal_dbm > 0.0)    signal_dbm = 0.0;
  if (signal_dbm < -100.0) signal_dbm = -100.0;

  // 4. Update rolling noise floor and calculate SNR
  if (signal_dbm < estimated_noise_floor + 5.0) {
    estimated_noise_floor = (0.95 * estimated_noise_floor) + (0.05 * signal_dbm);
  }
  float snr_db = signal_dbm - estimated_noise_floor;

  Serial.printf("[SENSOR] ADC: %4d | Vdet: %.4f V | Power: %.2f dBm | SNR: %.2f dB\n",
                raw_adc, detector_voltage, signal_dbm, snr_db);

  // 5. Send measurement to cloud backend
  sendMeasurement(signal_dbm, estimated_noise_floor, snr_db, raw_adc, detector_voltage);

  // Poll interval (1000 ms)
  delay(1000);
}

void connectWiFi() {
  Serial.printf("[WIFI] Connecting to %s ", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WIFI] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WIFI] Connection failed. Retrying...");
  }
}

void sendMeasurement(float signal_dbm, float noise_dbm, float snr_db, int adc_val, float vdet) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");

  // Construct Bearer token authorization header
  String authHeader = String("Bearer ") + DEVICE_TOKEN;
  http.addHeader("Authorization", authHeader);

  // Build JSON payload
  StaticJsonDocument<300> doc;
  doc["device_id"]        = DEVICE_ID;
  doc["signal_dbm"]       = round(signal_dbm * 100) / 100.0;
  doc["noise_dbm"]        = round(noise_dbm * 100) / 100.0;
  doc["snr_db"]           = round(snr_db * 100) / 100.0;
  doc["adc_value"]        = adc_val;
  doc["detector_voltage"] = round(vdet * 10000) / 10000.0;
  doc["lna_enabled"]      = true;

  // Optional GPS coordinates (CGEC campus default or live GPS)
  doc["latitude"]         = 26.293498;
  doc["longitude"]        = 89.459139;
  doc["altitude_m"]       = 42.0;

  String jsonString;
  serializeJson(doc, jsonString);

  int httpCode = http.POST(jsonString);
  if (httpCode == 201 || httpCode == 200) {
    Serial.println("[HTTP] Ingestion successful (201 Created)");
  } else {
    Serial.printf("[HTTP] Ingestion error: %d\n", httpCode);
  }
  http.end();
}
```

---

## 6. How Real Data Appears in the Software

Once the ESP32 begins sending data:

1. **Header Indicators:**
   * **Connection Status:** Shows `ONLINE` with a green pulse dot.
   * **Source Badge:** Switches automatically to `REAL` instead of `SIMULATED`.
2. **Real-time Overview Dashboard:**
   * **RF Power:** Updates with live hardware readings (e.g., `-54.2 dBm`).
   * **Noise Floor & SNR:** Continuously tracks physical ambient noise and signal-to-noise ratio.
   * **Detector Voltage & ADC:** Displays actual hardware ADC counts (`0–4095`) and voltage (`0–3.3V`).
   * **Continuous Chart:** The `RF Power vs Time` trend line plots live points every second and merges with the rolling history.
3. **AI Anomaly Detection:**
   * The live feature vectors (`[signal_dbm, noise_dbm, snr_db, detector_voltage, adc_value]`) are processed in real-time by the Isolation Forest model.
   * Transmitting on an RF transmitter or walkie-talkie nearby causes a sharp drop in voltage and spike in power, immediately triggering an `ANOMALY` classification and logging an event in the Timeline.
4. **Coverage Map:**
   * Plots the GPS position tagged by the hardware node, showing color-coded signal strength pins (Green: Good, Yellow: Marginal, Red: Weak).

---

## 7. Switching Between Hardware and Simulation

* **Hardware Mode (Active):** When the ESP32 is powered on and sending data, the dashboard displays live real-world metrics.
* **Simulation Mode (Fallback):** If the physical ESP32 is powered off or disconnected, the built-in simulator automatically generates realistic RF drift, Gaussian noise, and occasional interference events, keeping the dashboard operational for testing and development.
* **Server-side Mode Override:** In `.env` or Render environment settings:
  * `RF_SOURCE=simulator` (Enforces software simulator)
  * `RF_SOURCE=esp32` (Enforces pull polling of local ESP32 IP)
