import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / 'data'
RAW_DIR = DATA_DIR / 'raw'
PROCESSED_DIR = DATA_DIR / 'processed'
ML_MODELS_DIR = BASE_DIR / 'ml' / 'saved_models'

for _d in (RAW_DIR, PROCESSED_DIR, ML_MODELS_DIR):
    _d.mkdir(parents=True, exist_ok=True)


class FlaskConfig:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'rf-monitor-dev-secret')
    DEBUG = os.environ.get('FLASK_DEBUG', 'true').lower() == 'true'
    HOST = os.environ.get('FLASK_HOST', '127.0.0.1')
    PORT = int(os.environ.get('FLASK_PORT', '5000'))
    CORS_ORIGINS = ['*']


class DatabaseConfig:
    DB_PATH = BASE_DIR / 'data' / 'rf_monitor.db'
    ECHO = os.environ.get('DB_ECHO', 'false').lower() == 'true'


class DeviceConfig:
    SOURCE = os.environ.get('RF_SOURCE', 'simulator')
    DEVICE_ID = os.environ.get('DEVICE_ID', 'ESP32-RF-001')
    SIM_INTERVAL_S = float(os.environ.get('SIM_INTERVAL_S', '0.5'))
    SIM_BASE_POWER_DBM = float(os.environ.get('SIM_BASE_POWER_DBM', '-65.0'))
    SIM_NOISE_FLOOR_DBM = float(os.environ.get('SIM_NOISE_FLOOR_DBM', '-90.0'))
    SIM_SIGNAL_STD_DB = float(os.environ.get('SIM_SIGNAL_STD_DB', '3.0'))
    SIM_BASE_FREQ_HZ = float(os.environ.get('SIM_BASE_FREQ_HZ', '0'))
    SIM_EVENT_PROBABILITY = float(os.environ.get('SIM_EVENT_PROBABILITY', '0.02'))
    SIM_EVENT_INTENSITY_DB = float(os.environ.get('SIM_EVENT_INTENSITY_DB', '20.0'))
    SIM_EVENT_DURATION_S = float(os.environ.get('SIM_EVENT_DURATION_S', '5.0'))
    SIM_SPECTRUM_MODE = os.environ.get('SIM_SPECTRUM_MODE', 'false').lower() == 'true'
    ESP32_HOST = os.environ.get('ESP32_HOST', '192.168.1.100')
    ESP32_PORT = int(os.environ.get('ESP32_PORT', '80'))
    ESP32_TIMEOUT_S = float(os.environ.get('ESP32_TIMEOUT_S', '5.0'))


class RFConfig:
    ROLLING_WINDOW = int(os.environ.get('ROLLING_WINDOW', '20'))
    POWER_SPIKE_THRESHOLD_DB = float(os.environ.get('POWER_SPIKE_THRESHOLD_DB', '15.0'))
    SNR_LOW_THRESHOLD_DB = float(os.environ.get('SNR_LOW_THRESHOLD_DB', '5.0'))


class MLConfig:
    IF_CONTAMINATION = float(os.environ.get('IF_CONTAMINATION', '0.05'))
    IF_N_ESTIMATORS = int(os.environ.get('IF_N_ESTIMATORS', '100'))
    IF_MODEL_PATH = ML_MODELS_DIR / 'isolation_forest.joblib'
    IF_SCALER_PATH = ML_MODELS_DIR / 'scaler.joblib'
    MIN_TRAIN_SAMPLES = int(os.environ.get('MIN_TRAIN_SAMPLES', '50'))


class AlertConfig:
    POWER_HIGH_DBM = float(os.environ.get('ALERT_POWER_HIGH_DBM', '-30.0'))
    POWER_LOW_DBM = float(os.environ.get('ALERT_POWER_LOW_DBM', '-100.0'))
    SNR_LOW_DB = float(os.environ.get('ALERT_SNR_LOW_DB', '5.0'))
    ANOMALY_SCORE_THRESHOLD = float(os.environ.get('ALERT_ANOMALY_THRESHOLD', '0.6'))


flask_cfg = FlaskConfig()
db_cfg = DatabaseConfig()
device_cfg = DeviceConfig()
rf_cfg = RFConfig()
ml_cfg = MLConfig()
alert_cfg = AlertConfig()
