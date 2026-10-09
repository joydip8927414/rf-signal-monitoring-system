import logging
import threading
import time
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional, Dict, Any, Callable

from config import device_cfg

logger = logging.getLogger(__name__)


class RFMeasurement:
    """
    Standard RF measurement data object.

    This is the single canonical format used by all layers above the device.
    All device implementations MUST produce instances of this class.
    Frequency remains None when the hardware cannot resolve frequency (e.g. AD8317).
    """

    __slots__ = (
        'device_id', 'timestamp', 'frequency_hz', 'signal_dbm',
        'noise_dbm', 'snr_db', 'adc_value', 'detector_voltage',
        'lna_enabled', 'data_source', 'metadata',
    )

    def __init__(
        self,
        device_id: str,
        timestamp: Optional[str] = None,
        frequency_hz: Optional[float] = None,
        signal_dbm: Optional[float] = None,
        noise_dbm: Optional[float] = None,
        snr_db: Optional[float] = None,
        adc_value: Optional[int] = None,
        detector_voltage: Optional[float] = None,
        lna_enabled: bool = False,
        data_source: str = 'simulator',
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.device_id = device_id
        self.timestamp = timestamp or datetime.utcnow().isoformat() + 'Z'
        self.frequency_hz = frequency_hz        # None when not available
        self.signal_dbm = signal_dbm
        self.noise_dbm = noise_dbm
        self.snr_db = snr_db
        self.adc_value = adc_value
        self.detector_voltage = detector_voltage
        self.lna_enabled = lna_enabled
        self.data_source = data_source          # 'simulator' | 'esp32' | 'real'
        self.metadata = metadata or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            'device_id': self.device_id,
            'timestamp': self.timestamp,
            'frequency_hz': self.frequency_hz,
            'signal_dbm': self.signal_dbm,
            'noise_dbm': self.noise_dbm,
            'snr_db': self.snr_db,
            'adc_value': self.adc_value,
            'detector_voltage': self.detector_voltage,
            'lna_enabled': self.lna_enabled,
            'data_source': self.data_source,
            'metadata': self.metadata,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> 'RFMeasurement':
        return cls(**{k: d.get(k) for k in cls.__slots__ if k in d})


class DeviceDriver(ABC):
    """Abstract base class that all device drivers must implement."""

    @abstractmethod
    def connect(self) -> bool:
        """Establish connection. Returns True on success."""

    @abstractmethod
    def disconnect(self) -> None:
        """Gracefully close the connection."""

    @abstractmethod
    def get_status(self) -> Dict[str, Any]:
        """Return device status dictionary."""

    @abstractmethod
    def get_measurement(self) -> Optional[RFMeasurement]:
        """Return a single measurement snapshot."""

    @property
    @abstractmethod
    def is_connected(self) -> bool:
        """True if the device is currently connected."""


class DeviceInterface:
    """
    Hardware abstraction layer.

    The rest of the application (API, DB, AI) only interacts with
    DeviceInterface — never directly with simulator.py or esp32.py.
    Swapping data sources requires only changing the driver passed here.
    """

    def __init__(self, driver: DeviceDriver, poll_interval: float = 0.5):
        self._driver = driver
        self._poll_interval = poll_interval
        self._streaming = False
        self._thread: Optional[threading.Thread] = None
        self._callbacks: list[Callable[[RFMeasurement], None]] = []
        self._latest: Optional[RFMeasurement] = None
        self._lock = threading.Lock()
        self._start_time = time.time()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def connect(self) -> bool:
        ok = self._driver.connect()
        if ok:
            logger.info('DeviceInterface: driver connected (%s)', type(self._driver).__name__)
        return ok

    def disconnect(self) -> None:
        self.stop_stream()
        self._driver.disconnect()
        logger.info('DeviceInterface: driver disconnected')

    # ------------------------------------------------------------------
    # Measurement
    # ------------------------------------------------------------------
    def get_measurement(self) -> Optional[RFMeasurement]:
        m = self._driver.get_measurement()
        if m is not None:
            with self._lock:
                self._latest = m
        return m

    def get_latest(self) -> Optional[RFMeasurement]:
        with self._lock:
            return self._latest

    # ------------------------------------------------------------------
    # Streaming
    # ------------------------------------------------------------------
    def register_callback(self, cb: Callable[[RFMeasurement], None]) -> None:
        self._callbacks.append(cb)

    def start_stream(self) -> None:
        if self._streaming:
            return
        self._streaming = True
        self._thread = threading.Thread(target=self._stream_loop, daemon=True)
        self._thread.start()
        logger.info('DeviceInterface: stream started')

    def stop_stream(self) -> None:
        self._streaming = False
        if self._thread:
            self._thread.join(timeout=3)
        logger.info('DeviceInterface: stream stopped')

    def _stream_loop(self) -> None:
        while self._streaming:
            try:
                m = self._driver.get_measurement()
                if m is not None:
                    with self._lock:
                        self._latest = m
                    for cb in self._callbacks:
                        try:
                            cb(m)
                        except Exception as exc:
                            logger.error('Stream callback error: %s', exc)
            except Exception as exc:
                logger.error('Stream poll error: %s', exc)
            time.sleep(self._poll_interval)

    # ------------------------------------------------------------------
    # Status passthrough
    # ------------------------------------------------------------------
    def get_status(self) -> Dict[str, Any]:
        status = self._driver.get_status()
        status['uptime_s'] = round(time.time() - self._start_time, 1)
        status['streaming'] = self._streaming
        
        # Override connection status if pushing data actively
        if self.is_connected and not status.get('connected'):
            status['connected'] = True
            status['status'] = 'online'
            
        return status

    @property
    def is_connected(self) -> bool:
        # Check if we have received a recent PUSH measurement (within 30 seconds)
        with self._lock:
            latest = self._latest
            
        if latest and latest.data_source == 'real':
            try:
                ts_str = latest.timestamp.replace('Z', '+00:00')
                dt = datetime.fromisoformat(ts_str)
                if (datetime.now(timezone.utc) - dt).total_seconds() < 30:
                    return True
            except Exception:
                pass
                
        return self._driver.is_connected


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------
def get_device_interface() -> DeviceInterface:
    """
    Factory function. Returns a DeviceInterface backed by the configured driver.
    Change RF_SOURCE env var (or config.py) to switch data sources.
    """
    source = device_cfg.SOURCE.lower()
    if source == 'esp32':
        from device.esp32 import ESP32Driver
        driver = ESP32Driver()
        logger.info('Using ESP32 driver (source=esp32)')
    else:
        from device.simulator import SimulatorDriver
        driver = SimulatorDriver()
        logger.info('Using Simulator driver (source=simulator)')

    iface = DeviceInterface(driver, poll_interval=device_cfg.SIM_INTERVAL_S)
    return iface
