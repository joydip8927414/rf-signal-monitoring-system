# RF Monitor

![RF Monitor Dashboard] -
![Hardware] - 

**RF Monitor** is a professional-grade Radio Frequency (RF) measurement and analysis dashboard. It ingests live broadband power measurements from a custom ESP32-based hardware node (AD8318 RF detector + NEO-7M GPS) or a built-in simulator, processes the data through a machine-learning anomaly detection pipeline, and visualizes the results on a real-time, responsive React dashboard.

---

##  Features

*   **Real-time RF Dashboard:** Live metrics including Signal Power (dBm), Noise (dBm), SNR, and ADC voltage.
*   **Hardware & Simulator Modes:** Seamlessly switch between a physical ESP32 data source and a software simulator for development and testing.
*   **AI Anomaly Detection:** Real-time inference using an Isolation Forest model to detect statistical deviations and potential RF interference/jammers.
*   **Interactive Coverage Map:** Leaflet + OpenStreetMap integration to map GPS-tagged RF measurements and track geographical signal strength.
*   **RF Copilot:** A built-in chat assistant that can summarize 5-minute/60-minute averages, compare periods, and explain ML anomalies using the live SQLite database.
*   **Data Ingestion API:** A secure `POST /api/device/measurements` endpoint designed for hosted architectures where the ESP32 pushes data to the cloud.

---

##  Architecture

The project consists of a **React/Vite Frontend** and a **Flask Backend**.

```text
ESP32 (Hardware)
   │ (HTTPS POST)
   ▼
Flask Backend ──▶ SQLite Database (Data Persistence)
   │
   └─▶ ML Pipeline (Isolation Forest)
   │
   ▼ (REST API / JSON)
React Frontend (Vite)
```

### Directory Structure
*   **`frontend/`**: React + Vite UI application.
*   **`api/`**: Flask API routes (`routes.py`).
*   **`database/`**: SQLite initialization and queries.
*   **`device/`**: Hardware abstraction (`esp32.py`, `simulator.py`).
*   **`ml/`**: Machine learning models and training scripts.
*   **`rf_processing/`**: Signal processing logic.

---

##  Getting Started

### Prerequisites
*   **Python 3.10+**
*   **Node.js 18+** & `npm`

### 1. Backend Setup (Flask)

1. Navigate to the project root and create a virtual environment:
   ```bash
   python -m venv venv313
   source venv313/bin/activate  # On Windows: .\venv313\Scripts\activate
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the Flask server:
   ```bash
   python app.py
   ```
   *The backend will start on `http://127.0.0.1:5000` and automatically initialize the SQLite database.*

### 2. Frontend Setup (React)

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The frontend will start on `http://localhost:5173`.*

---

##  Configuration & Environment Variables

### Backend Configuration
The backend uses a combination of `config.py` and environment variables. To connect a real ESP32 instead of the simulator, set the following before starting `app.py`:

```bash
# Windows PowerShell
$env:RF_SOURCE="esp32"
$env:DEVICE_TOKEN="your-secure-token" # Required for API ingestion authentication
```

### ESP32 Hardware Integration
For a hosted setup, flash your ESP32 to POST JSON data to `/api/device/measurements`. Ensure the payload includes `signal_dbm`, `adc_value`, `detector_voltage`, and optional `latitude`/`longitude`. Provide the `DEVICE_TOKEN` in the `Authorization` header.

---

##  Testing

The project includes a comprehensive Python test suite for the device drivers and API ingestion.

To run the tests:
```bash
python -m unittest discover tests
```

---

##  License

This project is licensed under the MIT License.
