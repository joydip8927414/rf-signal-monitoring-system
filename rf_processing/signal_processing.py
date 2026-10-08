import logging
from collections import deque
from datetime import datetime
from typing import Optional, Dict, Any, List

import numpy as np

from config import rf_cfg, alert_cfg

logger = logging.getLogger(__name__)

# Rolling buffer of recent signal_dbm values for statistics
_signal_buffer: deque = deque(maxlen=rf_cfg.ROLLING_WINDOW)
_noise_buffer: deque = deque(maxlen=rf_cfg.ROLLING_WINDOW)
_snr_buffer: deque = deque(maxlen=rf_cfg.ROLLING_WINDOW)


def reset_buffers() -> None:
    _signal_buffer.clear()
    _noise_buffer.clear()
    _snr_buffer.clear()


def process_measurement(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enrich a raw measurement dict with derived statistics and alert flags.
    Returns a new dict with extra fields appended.
    The raw measurement is not modified.
    """
    result = dict(raw)

    sig = raw.get('signal_dbm')
    noise = raw.get('noise_dbm')
    snr = raw.get('snr_db')

    # Update rolling buffers
    if sig is not None:
        _signal_buffer.append(sig)
    if noise is not None:
        _noise_buffer.append(noise)
    if snr is not None:
        _snr_buffer.append(snr)

    arr = np.array(_signal_buffer, dtype=float)

    # Rolling statistics
    result['rolling_mean_dbm'] = round(float(np.mean(arr)), 3) if len(arr) > 0 else None
    result['rolling_std_db'] = round(float(np.std(arr)), 3) if len(arr) > 1 else None
    result['rolling_min_dbm'] = round(float(np.min(arr)), 3) if len(arr) > 0 else None
    result['rolling_max_dbm'] = round(float(np.max(arr)), 3) if len(arr) > 0 else None

    # Rate of change (dB/sample)
    if len(arr) >= 2:
        result['rate_of_change_db'] = round(float(arr[-1] - arr[-2]), 3)
    else:
        result['rate_of_change_db'] = None

    # Alert flags
    alerts = []
    if sig is not None:
        if sig > alert_cfg.POWER_HIGH_DBM:
            alerts.append({'type': 'POWER_HIGH', 'value': sig, 'threshold': alert_cfg.POWER_HIGH_DBM})
        if sig < alert_cfg.POWER_LOW_DBM:
            alerts.append({'type': 'POWER_LOW', 'value': sig, 'threshold': alert_cfg.POWER_LOW_DBM})

    if snr is not None and snr < alert_cfg.SNR_LOW_DB:
        alerts.append({'type': 'SNR_LOW', 'value': snr, 'threshold': alert_cfg.SNR_LOW_DB})

    # Simple power-spike detection using rolling std
    if result['rolling_std_db'] is not None and result['rolling_std_db'] > rf_cfg.POWER_SPIKE_THRESHOLD_DB:
        alerts.append({'type': 'POWER_SPIKE', 'value': result['rolling_std_db'],
                       'threshold': rf_cfg.POWER_SPIKE_THRESHOLD_DB})

    result['alerts'] = alerts
    result['has_alerts'] = len(alerts) > 0

    return result


def compute_snr(signal_dbm: float, noise_dbm: float) -> float:
    """Simple SNR calculation in dB."""
    return round(signal_dbm - noise_dbm, 2)


def dbm_to_watts(dbm: float) -> float:
    return 10 ** ((dbm - 30) / 10)


def watts_to_dbm(w: float) -> float:
    return 10 * np.log10(w) + 30
