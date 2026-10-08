import logging
import math
import random
import time
from datetime import datetime, timezone
from typing import Optional, Dict, Any

import numpy as np

from config import device_cfg
from device.interface import DeviceDriver, RFMeasurement

logger = logging.getLogger(__name__)

# Clearly mark every measurement as simulated
_DATA_SOURCE = 'SIMULATED'


class _EventState:
    """Tracks an ongoing simulated RF event."""
    def __init__(self, intensity_db: float, duration_s: float):
        self.intensity_db = intensity_db
        self.remaining_s = duration_s
        self.event_type = random.choice(['POWER_SPIKE', 'INTERFERENCE', 'BURST'])


class SimulatorDriver(DeviceDriver):
    """
    Realistic RF power simulator.

    Produces measurements in the same RFMeasurement format that the future
    ESP32 driver will produce.  The rest of the application never needs to
    know where measurements come from.

    SIMULATED DATA — never present these as real hardware measurements.
    """

    def __init__(self):
        self._connected = False
        self._start_time: Optional[float] = None
        self._rng = random.Random()
        self._np_rng = np.random.default_rng()
        self._event: Optional[_EventState] = None
        self._sample_count = 0

        # Configuration
        self._base_power = device_cfg.SIM_BASE_POWER_DBM
        self._noise_floor = device_cfg.SIM_NOISE_FLOOR_DBM
        self._signal_std = device_cfg.SIM_SIGNAL_STD_DB
        self._event_prob = device_cfg.SIM_EVENT_PROBABILITY
        self._event_intensity = device_cfg.SIM_EVENT_INTENSITY_DB
        self._event_duration = device_cfg.SIM_EVENT_DURATION_S
        self._interval = device_cfg.SIM_INTERVAL_S
        self._spectrum_mode = device_cfg.SIM_SPECTRUM_MODE

        # Slow drift state
        self._drift_phase = self._rng.uniform(0, 2 * math.pi)
        self._drift_speed = self._rng.uniform(0.01, 0.05)   # rad/s

    # ------------------------------------------------------------------
    # DeviceDriver interface
    # ------------------------------------------------------------------
    def connect(self) -> bool:
        self._connected = True
        self._start_time = time.time()
        logger.info('[SIMULATOR] Connected — generating simulated RF data')
        return True

    def disconnect(self) -> None:
        self._connected = False
        logger.info('[SIMULATOR] Disconnected')

    @property
    def is_connected(self) -> bool:
        return self._connected

    def get_status(self) -> Dict[str, Any]:
        uptime = round(time.time() - self._start_time, 1) if self._start_time else 0.0
        return {
            'device_id': device_cfg.DEVICE_ID,
            'device_type': 'SIMULATOR',
            'data_source': _DATA_SOURCE,
            'connected': self._connected,
            'status': 'online' if self._connected else 'offline',
            'uptime_s': uptime,
            'sample_count': self._sample_count,
            'spectrum_mode': self._spectrum_mode,
            'firmware_version': 'sim-1.0.0',
            'wifi_rssi': None,
            'ip_address': '127.0.0.1',
            'lna_enabled': True,
            'temperature_c': None,
            'last_event_type': self._event.event_type if self._event else None,
        }

    def get_measurement(self) -> Optional[RFMeasurement]:
        if not self._connected:
            return None

        self._sample_count += 1
        now = datetime.now(timezone.utc)
        t = time.time() - (self._start_time or 0)

        # Slow sinusoidal drift
        drift = 4.0 * math.sin(self._drift_speed * t + self._drift_phase)

        # Gaussian noise on signal
        noise_on_signal = self._np_rng.normal(0, self._signal_std)

        # Noise floor with small jitter
        noise_floor = self._noise_floor + self._np_rng.normal(0, 0.5)

        # Random events
        event_bonus = 0.0
        if self._event:
            event_bonus = self._event.intensity_db * math.exp(
                -3.0 * (1 - self._event.remaining_s / self._event_duration)
            )
            self._event.remaining_s -= self._interval
            if self._event.remaining_s <= 0:
                logger.debug('[SIMULATOR] Event ended: %s', self._event.event_type)
                self._event = None
        elif self._rng.random() < self._event_prob:
            intensity = self._event_intensity + self._rng.uniform(-5, 5)
            duration = self._event_duration + self._rng.uniform(-1, 2)
            self._event = _EventState(intensity, duration)
            logger.debug('[SIMULATOR] New event: %s', self._event.event_type)

        signal_dbm = self._base_power + drift + noise_on_signal + event_bonus
        signal_dbm = max(-120.0, min(0.0, signal_dbm))   # physical bounds

        snr_db = signal_dbm - noise_floor
        # AD8317 voltage transfer function approximation: V ≈ slope*(Pout - intercept)
        slope = -0.025   # V/dB (AD8317 typical)
        intercept = -60.0
        detector_v = slope * (signal_dbm - intercept) + 0.5
        detector_v = max(0.0, min(2.5, detector_v))
        adc_value = int(detector_v / 3.3 * 4095)

        freq_hz: Optional[float] = None
        if self._spectrum_mode:
            freq_hz = self._rng.uniform(0.1e9, 6.0e9)   # only in spectrum sim mode

        return RFMeasurement(
            device_id=device_cfg.DEVICE_ID,
            timestamp=now.isoformat(),
            frequency_hz=freq_hz,
            signal_dbm=round(signal_dbm, 2),
            noise_dbm=round(noise_floor, 2),
            snr_db=round(snr_db, 2),
            adc_value=adc_value,
            detector_voltage=round(detector_v, 4),
            lna_enabled=True,
            data_source=_DATA_SOURCE,
            metadata={
                'event_active': self._event is not None,
                'event_type': self._event.event_type if self._event else None,
                'sample_count': self._sample_count,
            },
        )
