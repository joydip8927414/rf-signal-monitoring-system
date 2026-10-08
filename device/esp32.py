import logging
import time
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import requests
from requests.exceptions import RequestException

from config import device_cfg
from device.interface import DeviceDriver, RFMeasurement

logger = logging.getLogger(__name__)

class ESP32Driver(DeviceDriver):
    """
    ESP32 hardware driver.
    Communicates with physical ESP32 device over Wi-Fi via HTTP polling.
    Produces RFMeasurement objects without fabricating data.
    """

    def __init__(self):
        self._connected = False
        self._host = device_cfg.ESP32_HOST
        self._port = device_cfg.ESP32_PORT
        self._timeout = device_cfg.ESP32_TIMEOUT_S
        self._start_time: Optional[float] = None
        self._session = requests.Session()
        self._base_url = f"http://{self._host}:{self._port}"

    def connect(self) -> bool:
        """Attempt to connect to the ESP32."""
        try:
            resp = self._session.get(f"{self._base_url}/status", timeout=self._timeout)
            if resp.status_code == 200:
                self._connected = True
                self._start_time = time.time()
                logger.info('[ESP32] Successfully connected to %s', self._base_url)
                return True
            else:
                logger.warning('[ESP32] Connect failed with status %d', resp.status_code)
                return False
        except RequestException as e:
            logger.error('[ESP32] Connection failed: %s', e)
            return False

    def disconnect(self) -> None:
        self._connected = False
        if self._session:
            self._session.close()
        logger.info('[ESP32] Disconnected')

    @property
    def is_connected(self) -> bool:
        return self._connected

    def get_status(self) -> Dict[str, Any]:
        status = {
            'device_id': device_cfg.DEVICE_ID,
            'device_type': 'ESP32',
            'data_source': 'real',
            'connected': self._connected,
            'status': 'online' if self._connected else 'offline',
            'host': self._host,
            'port': self._port,
            'firmware_version': None,
            'wifi_rssi': None,
            'ip_address': self._host if self._connected else None,
            'lna_enabled': None,
            'temperature_c': None,
        }
        
        if self._connected:
            try:
                # Optional: fetch real status if device supports it
                resp = self._session.get(f"{self._base_url}/status", timeout=self._timeout)
                if resp.status_code == 200:
                    data = resp.json()
                    status.update({
                        'firmware_version': data.get('firmware_version'),
                        'wifi_rssi': data.get('wifi_rssi'),
                        'lna_enabled': data.get('lna_enabled'),
                        'temperature_c': data.get('temperature_c'),
                    })
            except RequestException:
                self._connected = False
                logger.warning('[ESP32] Lost connection during get_status')
                
        return status

    def get_measurement(self) -> Optional[RFMeasurement]:
        """Retrieve one measurement from the ESP32."""
        if not self._connected:
            # Try to reconnect
            if not self.connect():
                return None

        try:
            resp = self._session.get(f"{self._base_url}/measurement", timeout=self._timeout)
            if resp.status_code == 200:
                data = resp.json()
                
                # Validation: must have signal_dbm at minimum.
                if 'signal_dbm' not in data:
                    logger.warning('[ESP32] Invalid payload, missing signal_dbm')
                    return None
                    
                # Do not invent data. Missing GPS is handled.
                # Frequency is None since AD8318 is broadband
                return RFMeasurement(
                    device_id=device_cfg.DEVICE_ID,
                    timestamp=data.get('timestamp') or datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                    frequency_hz=data.get('frequency_hz'),
                    signal_dbm=data.get('signal_dbm'),
                    noise_dbm=data.get('noise_dbm'),
                    snr_db=data.get('snr_db'),
                    adc_value=data.get('adc_value'),
                    detector_voltage=data.get('detector_voltage'),
                    lna_enabled=data.get('lna_enabled', False),
                    data_source='real',
                    metadata={
                        'latitude': data.get('latitude'),
                        'longitude': data.get('longitude'),
                        'altitude_m': data.get('altitude_m')
                    }
                )
            else:
                logger.warning('[ESP32] Measurement fetch failed with status %d', resp.status_code)
                return None
        except RequestException as e:
            logger.error('[ESP32] Connection lost during measurement fetch: %s', e)
            self._connected = False
            return None
