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


# Predefined Repeatable Test Scenarios
SIMULATION_SCENARIOS = {
    'baseline': {
        'name': 'Baseline (Nominal Laboratory)',
        'description': 'Reference signal at 1.0 m, free space line of sight, clean thermal noise floor.',
        'distance_m': 1.0,
        'path_loss_exponent': 2.0,
        'wall_attenuation_db': 0.0,
        'num_walls': 0,
        'tx_power_dbm': -40.0,
        'reference_distance_m': 1.0,
        'noise_floor_dbm': -95.0,
        'interference_level_dbm': -120.0,
        'fading_depth_db': 1.5,
        'fading_speed_hz': 0.05,
        'signal_variation_std_db': 1.0,
        'is_device_outage': False,
    },
    'increased_distance': {
        'name': 'Increased Distance (Path Loss)',
        'description': 'Transmitter moved from 1.0 m to 15.0 m, exhibiting ~23.5 dB free-space path loss.',
        'distance_m': 15.0,
        'path_loss_exponent': 2.0,
        'wall_attenuation_db': 0.0,
        'num_walls': 0,
        'tx_power_dbm': -40.0,
        'reference_distance_m': 1.0,
        'noise_floor_dbm': -95.0,
        'interference_level_dbm': -120.0,
        'fading_depth_db': 2.5,
        'fading_speed_hz': 0.05,
        'signal_variation_std_db': 1.5,
        'is_device_outage': False,
    },
    'obstacle_introduced': {
        'name': 'Obstacle Introduced (Wall Penetration)',
        'description': 'Concrete partition/wall introduced (12 dB attenuation per wall, 2 walls = 24 dB loss).',
        'distance_m': 5.0,
        'path_loss_exponent': 2.2,
        'wall_attenuation_db': 12.0,
        'num_walls': 2,
        'tx_power_dbm': -40.0,
        'reference_distance_m': 1.0,
        'noise_floor_dbm': -95.0,
        'interference_level_dbm': -120.0,
        'fading_depth_db': 3.5,
        'fading_speed_hz': 0.08,
        'signal_variation_std_db': 2.0,
        'is_device_outage': False,
    },
    'increased_interference': {
        'name': 'Increased Interference / Jammer',
        'description': 'High-power in-band co-channel interferer raising the effective noise+interference floor to -68 dBm.',
        'distance_m': 2.0,
        'path_loss_exponent': 2.0,
        'wall_attenuation_db': 0.0,
        'num_walls': 0,
        'tx_power_dbm': -40.0,
        'reference_distance_m': 1.0,
        'noise_floor_dbm': -92.0,
        'interference_level_dbm': -68.0,
        'fading_depth_db': 2.0,
        'fading_speed_hz': 0.1,
        'signal_variation_std_db': 2.5,
        'is_device_outage': False,
    },
    'device_outage': {
        'name': 'Temporary Device Outage',
        'description': 'Simulates temporary microcontroller / sensor blackout where no telemetry packets are generated.',
        'distance_m': 1.0,
        'path_loss_exponent': 2.0,
        'wall_attenuation_db': 0.0,
        'num_walls': 0,
        'tx_power_dbm': -40.0,
        'reference_distance_m': 1.0,
        'noise_floor_dbm': -95.0,
        'interference_level_dbm': -120.0,
        'fading_depth_db': 0.0,
        'fading_speed_hz': 0.0,
        'signal_variation_std_db': 0.0,
        'is_device_outage': True,
    },
    'recovery': {
        'name': 'Recovery to Nominal',
        'description': 'System restored to clean line-of-sight conditions following an outage or jamming incident.',
        'distance_m': 1.0,
        'path_loss_exponent': 2.0,
        'wall_attenuation_db': 0.0,
        'num_walls': 0,
        'tx_power_dbm': -40.0,
        'reference_distance_m': 1.0,
        'noise_floor_dbm': -95.0,
        'interference_level_dbm': -120.0,
        'fading_depth_db': 1.5,
        'fading_speed_hz': 0.05,
        'signal_variation_std_db': 1.0,
        'is_device_outage': False,
    },
}


class SimulatorDriver(DeviceDriver):
    """
    Physics-consistent RF propagation and detector simulator.

    Explicitly models:
    - Log-distance path loss: PL(d) = 10 * n * log10(d / d0)
    - Obstacle / wall attenuation: L_walls = N * Atten_wall
    - Temporal fading / multipath drift: Depth * sin(2*pi*f_fade*t)
    - Thermal noise floor & external co-channel interference combining: 10*log10(10^(N/10) + 10^(I/10))
    - Signal-to-Noise Ratio (SNR): Signal_dBm - EffectiveNoise_dBm
    - AD8317 logarithmic detector transfer function: V_det = -0.025 * (P_in - (-60.0)) + 0.5
    - ESP32 12-bit ADC quantization: floor(V_det / 3.3 * 4095) clamped to [0, 4095]

    SIMULATED DATA — clearly marked as synthetic data for controlled scenario testing.
    """

    def __init__(self):
        self._connected = False
        self._start_time: Optional[float] = None
        self._rng = random.Random()
        self._np_rng = np.random.default_rng()
        self._event: Optional[_EventState] = None
        self._sample_count = 0

        # Physical RF parameters (default based on 'baseline' scenario)
        self._active_scenario_name = 'baseline'
        self._distance_m: float = 1.0
        self._path_loss_exponent: float = 2.0
        self._wall_attenuation_db: float = 0.0
        self._num_walls: int = 0
        self._tx_power_dbm: float = -40.0
        self._reference_distance_m: float = 1.0

        # Noise, interference & fading
        self._noise_floor_dbm: float = device_cfg.SIM_NOISE_FLOOR_DBM  # -90 to -95 dBm
        self._interference_level_dbm: float = -120.0  # Negligible by default
        self._fading_depth_db: float = 2.0
        self._fading_speed_hz: float = 0.05
        self._signal_std: float = device_cfg.SIM_SIGNAL_STD_DB

        # Device outage emulation
        self._is_device_outage: bool = False

        # Random sporadic burst events
        self._event_prob = device_cfg.SIM_EVENT_PROBABILITY
        self._event_intensity = device_cfg.SIM_EVENT_INTENSITY_DB
        self._event_duration = device_cfg.SIM_EVENT_DURATION_S
        self._interval = device_cfg.SIM_INTERVAL_S
        self._spectrum_mode = device_cfg.SIM_SPECTRUM_MODE

        # Slow drift state
        self._drift_phase = self._rng.uniform(0, 2 * math.pi)

        # Apply baseline defaults
        self.apply_scenario('baseline')

    # ------------------------------------------------------------------
    # Scenario & Parameter Configuration API
    # ------------------------------------------------------------------
    def get_config(self) -> Dict[str, Any]:
        """Return current simulation model configuration."""
        return {
            'active_scenario': self._active_scenario_name,
            'distance_m': self._distance_m,
            'path_loss_exponent': self._path_loss_exponent,
            'wall_attenuation_db': self._wall_attenuation_db,
            'num_walls': self._num_walls,
            'tx_power_dbm': self._tx_power_dbm,
            'reference_distance_m': self._reference_distance_m,
            'noise_floor_dbm': self._noise_floor_dbm,
            'interference_level_dbm': self._interference_level_dbm,
            'fading_depth_db': self._fading_depth_db,
            'fading_speed_hz': self._fading_speed_hz,
            'signal_variation_std_db': self._signal_std,
            'is_device_outage': self._is_device_outage,
            'available_scenarios': list(SIMULATION_SCENARIOS.keys()),
        }

    def update_config(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Update individual simulation parameters dynamically."""
        if 'scenario' in params and params['scenario'] in SIMULATION_SCENARIOS:
            self.apply_scenario(params['scenario'])

        if 'distance_m' in params:
            self._distance_m = max(0.1, float(params['distance_m']))
        if 'path_loss_exponent' in params:
            self._path_loss_exponent = max(1.0, float(params['path_loss_exponent']))
        if 'wall_attenuation_db' in params:
            self._wall_attenuation_db = max(0.0, float(params['wall_attenuation_db']))
        if 'num_walls' in params:
            self._num_walls = max(0, int(params['num_walls']))
        if 'tx_power_dbm' in params:
            self._tx_power_dbm = float(params['tx_power_dbm'])
        if 'reference_distance_m' in params:
            self._reference_distance_m = max(0.1, float(params['reference_distance_m']))
        if 'noise_floor_dbm' in params:
            self._noise_floor_dbm = float(params['noise_floor_dbm'])
        if 'interference_level_dbm' in params:
            self._interference_level_dbm = float(params['interference_level_dbm'])
        if 'fading_depth_db' in params:
            self._fading_depth_db = max(0.0, float(params['fading_depth_db']))
        if 'fading_speed_hz' in params:
            self._fading_speed_hz = max(0.0, float(params['fading_speed_hz']))
        if 'signal_variation_std_db' in params:
            self._signal_std = max(0.0, float(params['signal_variation_std_db']))
        if 'is_device_outage' in params:
            self._is_device_outage = bool(params['is_device_outage'])

        return self.get_config()

    def apply_scenario(self, scenario_name: str) -> bool:
        """Apply a named preset test scenario."""
        if scenario_name not in SIMULATION_SCENARIOS:
            logger.warning('[SIMULATOR] Unknown scenario %s', scenario_name)
            return False

        sc = SIMULATION_SCENARIOS[scenario_name]
        self._active_scenario_name = scenario_name
        self._distance_m = sc['distance_m']
        self._path_loss_exponent = sc['path_loss_exponent']
        self._wall_attenuation_db = sc['wall_attenuation_db']
        self._num_walls = sc['num_walls']
        self._tx_power_dbm = sc['tx_power_dbm']
        self._reference_distance_m = sc['reference_distance_m']
        self._noise_floor_dbm = sc['noise_floor_dbm']
        self._interference_level_dbm = sc['interference_level_dbm']
        self._fading_depth_db = sc['fading_depth_db']
        self._fading_speed_hz = sc['fading_speed_hz']
        self._signal_std = sc['signal_variation_std_db']
        self._is_device_outage = sc['is_device_outage']
        logger.info('[SIMULATOR] Applied scenario: %s (%s)', scenario_name, sc['name'])
        return True

    # ------------------------------------------------------------------
    # DeviceDriver interface
    # ------------------------------------------------------------------
    def connect(self) -> bool:
        self._connected = True
        self._start_time = time.time()
        logger.info('[SIMULATOR] Connected — generating physics-based simulated RF telemetry')
        return True

    def disconnect(self) -> None:
        self._connected = False
        logger.info('[SIMULATOR] Disconnected')

    @property
    def is_connected(self) -> bool:
        return self._connected

    def get_status(self) -> Dict[str, Any]:
        uptime = round(time.time() - self._start_time, 1) if self._start_time else 0.0
        effective_status = 'offline' if (not self._connected or self._is_device_outage) else 'online'
        return {
            'device_id': device_cfg.DEVICE_ID,
            'device_type': 'SIMULATOR',
            'data_source': _DATA_SOURCE,
            'connected': self._connected and not self._is_device_outage,
            'status': effective_status,
            'uptime_s': uptime,
            'sample_count': self._sample_count,
            'spectrum_mode': self._spectrum_mode,
            'firmware_version': 'sim-2.0.0-physics',
            'wifi_rssi': None,
            'ip_address': '127.0.0.1',
            'lna_enabled': True,
            'temperature_c': None,
            'last_event_type': self._event.event_type if self._event else None,
            'simulation_scenario': self._active_scenario_name,
            'simulation_params': self.get_config(),
        }

    def get_measurement(self) -> Optional[RFMeasurement]:
        if not self._connected:
            return None

        # Simulate device outage / communication blackout
        if self._is_device_outage:
            logger.debug('[SIMULATOR] Device outage simulated — returning None')
            return None

        self._sample_count += 1
        now = datetime.now(timezone.utc)
        t = time.time() - (self._start_time or 0)

        # --------------------------------------------------------------
        # 1. Physics-based Path Loss & Wall Attenuation
        # Log-distance path loss: PL(d) = 10 * n * log10(d / d0)
        # --------------------------------------------------------------
        d_ratio = max(0.01, self._distance_m / max(0.01, self._reference_distance_m))
        path_loss_db = 10.0 * self._path_loss_exponent * math.log10(d_ratio)
        wall_loss_db = float(self._num_walls) * self._wall_attenuation_db

        base_rx_power_dbm = self._tx_power_dbm - path_loss_db - wall_loss_db

        # --------------------------------------------------------------
        # 2. Temporal Multipath Fading & Small-Scale Drift
        # --------------------------------------------------------------
        fading_db = self._fading_depth_db * math.sin(
            2.0 * math.pi * self._fading_speed_hz * t + self._drift_phase
        )

        # --------------------------------------------------------------
        # 3. Measurement Variation / Random Shadowing Noise
        # --------------------------------------------------------------
        shadowing_noise_db = float(self._np_rng.normal(0, self._signal_std)) if self._signal_std > 0 else 0.0

        # --------------------------------------------------------------
        # 4. Sporadic Event / Interference Spikes
        # --------------------------------------------------------------
        event_bonus_db = 0.0
        if self._event:
            event_bonus_db = self._event.intensity_db * math.exp(
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

        raw_signal_dbm = base_rx_power_dbm + fading_db + shadowing_noise_db + event_bonus_db
        # Clamp to realistic physical dynamic range of RF detection environment (-120 dBm to 0 dBm)
        signal_dbm = max(-120.0, min(0.0, raw_signal_dbm))

        # --------------------------------------------------------------
        # 5. Effective Noise Floor (Thermal Noise + Co-channel Interference)
        # Power addition: P_total = 10 * log10(10^(N/10) + 10^(I/10))
        # --------------------------------------------------------------
        thermal_noise = self._noise_floor_dbm + float(self._np_rng.normal(0, 0.4))
        p_noise_mw = 10.0 ** (thermal_noise / 10.0)
        p_interf_mw = 10.0 ** (self._interference_level_dbm / 10.0)
        combined_noise_dbm = 10.0 * math.log10(max(1e-15, p_noise_mw + p_interf_mw))

        # Signal to Noise Ratio
        snr_db = signal_dbm - combined_noise_dbm

        # --------------------------------------------------------------
        # 6. AD8317 / AD8318 Detector Transfer Function & ADC Quantization
        # V_out = slope * (P_in - intercept) + V_ref
        # slope = -0.025 V/dB (-25 mV/dB), intercept = -60.0 dBm
        # Clamped to detector output limit [0.0V, 2.5V]
        # Quantized by 12-bit ADC (3.3V full-scale, 4095 steps)
        # --------------------------------------------------------------
        slope = -0.025
        intercept = -60.0
        detector_v = slope * (signal_dbm - intercept) + 0.5
        detector_v = max(0.0, min(2.5, detector_v))

        # ESP32 12-bit ADC integer quantization
        adc_value = max(0, min(4095, int(detector_v / 3.3 * 4095)))

        freq_hz: Optional[float] = None
        if self._spectrum_mode:
            freq_hz = self._rng.uniform(0.1e9, 6.0e9)

        return RFMeasurement(
            device_id=device_cfg.DEVICE_ID,
            timestamp=now.isoformat(),
            frequency_hz=freq_hz,
            signal_dbm=round(signal_dbm, 2),
            noise_dbm=round(combined_noise_dbm, 2),
            snr_db=round(snr_db, 2),
            adc_value=adc_value,
            detector_voltage=round(detector_v, 4),
            lna_enabled=True,
            data_source=_DATA_SOURCE,
            metadata={
                'event_active': self._event is not None,
                'event_type': self._event.event_type if self._event else None,
                'sample_count': self._sample_count,
                'simulation_scenario': self._active_scenario_name,
                'distance_m': self._distance_m,
                'wall_loss_db': wall_loss_db,
                'path_loss_db': round(path_loss_db, 2),
                'effective_noise_dbm': round(combined_noise_dbm, 2),
            },
        )
