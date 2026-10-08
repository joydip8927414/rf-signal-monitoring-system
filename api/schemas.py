from datetime import datetime
from typing import Optional, Dict, Any


def measurement_schema(m: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitise and document a measurement dict for API output."""
    return {
        'device_id': m.get('device_id'),
        'timestamp': m.get('timestamp'),
        'frequency_hz': m.get('frequency_hz'),
        'signal_dbm': m.get('signal_dbm'),
        'noise_dbm': m.get('noise_dbm'),
        'snr_db': m.get('snr_db'),
        'adc_value': m.get('adc_value'),
        'detector_voltage': m.get('detector_voltage'),
        'lna_enabled': m.get('lna_enabled'),
        'data_source': m.get('data_source'),
        'rolling_mean_dbm': m.get('rolling_mean_dbm'),
        'rolling_std_db': m.get('rolling_std_db'),
        'rolling_min_dbm': m.get('rolling_min_dbm'),
        'rolling_max_dbm': m.get('rolling_max_dbm'),
        'rate_of_change_db': m.get('rate_of_change_db'),
        'alerts': m.get('alerts', []),
        'has_alerts': m.get('has_alerts', False),
        'ai_prediction': m.get('ai_prediction'),
        'ai_anomaly_score': m.get('ai_anomaly_score'),
    }


def event_schema(e: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitise an RF event dict for API output."""
    return {
        'id': e.get('id'),
        'start_time': e.get('start_time'),
        'end_time': e.get('end_time'),
        'duration_s': e.get('duration_s'),
        'peak_power_dbm': e.get('peak_power_dbm'),
        'avg_power_dbm': e.get('avg_power_dbm'),
        'event_type': e.get('event_type'),
        'noise_dbm': e.get('noise_dbm'),
        'snr_db': e.get('snr_db'),
        'ai_anomaly_score': e.get('ai_anomaly_score'),
        'ai_classification': e.get('ai_classification'),
        'device_id': e.get('device_id'),
        'data_source': e.get('data_source'),
    }


def error_response(message: str, code: int = 500) -> Dict[str, Any]:
    return {'success': False, 'error': message, 'code': code}


def success_response(data: Any = None, message: str = 'OK') -> Dict[str, Any]:
    return {'success': True, 'message': message, 'data': data}
