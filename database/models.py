import sqlite3
import logging
from datetime import datetime
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


def _row_to_dict(cursor: sqlite3.Cursor, row: sqlite3.Row) -> Dict[str, Any]:
    return dict(zip([c[0] for c in cursor.description], row))


CREATE_DEVICES = '''
CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT UNIQUE NOT NULL,
    device_type TEXT NOT NULL DEFAULT 'ESP32',
    status TEXT NOT NULL DEFAULT 'offline',
    connection TEXT NOT NULL DEFAULT 'disconnected',
    data_source TEXT NOT NULL DEFAULT 'simulator',
    last_seen TEXT,
    firmware_version TEXT,
    ip_address TEXT,
    wifi_rssi INTEGER,
    uptime_s REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
'''

CREATE_MEASUREMENTS = '''
CREATE TABLE IF NOT EXISTS measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    device_id TEXT NOT NULL,
    frequency_hz REAL,
    signal_dbm REAL,
    noise_dbm REAL,
    snr_db REAL,
    adc_value INTEGER,
    detector_voltage REAL,
    lna_enabled INTEGER,
    data_source TEXT NOT NULL DEFAULT 'simulator',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
'''

CREATE_EVENTS = '''
CREATE TABLE IF NOT EXISTS rf_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time TEXT NOT NULL,
    end_time TEXT,
    peak_power_dbm REAL,
    avg_power_dbm REAL,
    duration_s REAL,
    event_type TEXT NOT NULL DEFAULT 'UNKNOWN',
    noise_dbm REAL,
    snr_db REAL,
    ai_anomaly_score REAL,
    ai_classification TEXT,
    device_id TEXT,
    data_source TEXT NOT NULL DEFAULT 'simulator',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
'''

CREATE_AI_PREDICTIONS = '''
CREATE TABLE IF NOT EXISTS ai_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    measurement_id INTEGER,
    model_name TEXT NOT NULL,
    prediction TEXT NOT NULL,
    anomaly_score REAL,
    confidence REAL,
    features_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
'''

CREATE_CALIBRATION = '''
CREATE TABLE IF NOT EXISTS calibration (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    device_id TEXT NOT NULL,
    reference_dbm REAL NOT NULL,
    measured_dbm REAL NOT NULL,
    correction_db REAL NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
'''

ALL_TABLES = [
    CREATE_DEVICES,
    CREATE_MEASUREMENTS,
    CREATE_EVENTS,
    CREATE_AI_PREDICTIONS,
    CREATE_CALIBRATION,
]

INDEXES = [
    'CREATE INDEX IF NOT EXISTS idx_meas_timestamp ON measurements (timestamp)',
    'CREATE INDEX IF NOT EXISTS idx_meas_device ON measurements (device_id)',
    'CREATE INDEX IF NOT EXISTS idx_events_start ON rf_events (start_time)',
    'CREATE INDEX IF NOT EXISTS idx_ai_timestamp ON ai_predictions (timestamp)',
]
