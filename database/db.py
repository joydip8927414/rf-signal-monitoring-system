import sqlite3
import logging
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from config import db_cfg
from database.models import ALL_TABLES, INDEXES

logger = logging.getLogger(__name__)

_local = threading.local()
_db_path = str(db_cfg.DB_PATH)


def _get_connection() -> sqlite3.Connection:
    if not hasattr(_local, 'conn') or _local.conn is None:
        _local.conn = sqlite3.connect(_db_path, check_same_thread=False)
        _local.conn.row_factory = sqlite3.Row
        _local.conn.execute('PRAGMA journal_mode=WAL')
        _local.conn.execute('PRAGMA foreign_keys=ON')
    return _local.conn


@contextmanager
def get_db():
    conn = _get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def init_db():
    db_cfg.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_db() as conn:
        for stmt in ALL_TABLES:
            conn.execute(stmt)
        for stmt in INDEXES:
            conn.execute(stmt)
    logger.info('Database initialised at %s', _db_path)


# ---------------------------------------------------------------------------
# Device helpers
# ---------------------------------------------------------------------------
def upsert_device(device_id: str, data: Dict[str, Any]) -> None:
    cols = ', '.join(data.keys())
    placeholders = ', '.join(['?'] * len(data))
    updates = ', '.join(f'{k}=excluded.{k}' for k in data.keys())
    sql = (
        f'INSERT INTO devices (device_id, {cols}) VALUES (?, {placeholders}) '
        f'ON CONFLICT(device_id) DO UPDATE SET {updates}'
    )
    with get_db() as conn:
        conn.execute(sql, [device_id] + list(data.values()))


def get_device(device_id: str) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        row = conn.execute(
            'SELECT * FROM devices WHERE device_id=?', (device_id,)
        ).fetchone()
        return dict(row) if row else None


# ---------------------------------------------------------------------------
# Measurement helpers
# ---------------------------------------------------------------------------
def insert_measurement(m: Dict[str, Any]) -> int:
    keys = list(m.keys())
    sql = (
        f'INSERT INTO measurements ({", ".join(keys)}) '
        f'VALUES ({", ".join(["?"]*len(keys))})'
    )
    with get_db() as conn:
        cur = conn.execute(sql, list(m.values()))
        return cur.lastrowid


def get_latest_measurements(limit: int = 100) -> List[Dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            'SELECT * FROM measurements ORDER BY timestamp DESC LIMIT ?', (limit,)
        ).fetchall()
        return [dict(r) for r in rows]


def get_measurements_since(since: datetime, limit: int = 10000) -> List[Dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            'SELECT * FROM measurements WHERE timestamp >= ? ORDER BY timestamp ASC LIMIT ?',
            (since.isoformat(), limit),
        ).fetchall()
        return [dict(r) for r in rows]


def get_measurement_range(start: datetime, end: datetime) -> List[Dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            'SELECT * FROM measurements WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp ASC',
            (start.isoformat(), end.isoformat()),
        ).fetchall()
        return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Event helpers
# ---------------------------------------------------------------------------
def insert_event(evt: Dict[str, Any]) -> int:
    keys = list(evt.keys())
    sql = (
        f'INSERT INTO rf_events ({", ".join(keys)}) '
        f'VALUES ({", ".join(["?"]*len(keys))})'
    )
    with get_db() as conn:
        cur = conn.execute(sql, list(evt.values()))
        return cur.lastrowid


def get_events(limit: int = 200) -> List[Dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            'SELECT * FROM rf_events ORDER BY start_time DESC LIMIT ?', (limit,)
        ).fetchall()
        return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# AI prediction helpers
# ---------------------------------------------------------------------------
def insert_prediction(pred: Dict[str, Any]) -> int:
    keys = list(pred.keys())
    sql = (
        f'INSERT INTO ai_predictions ({", ".join(keys)}) '
        f'VALUES ({", ".join(["?"]*len(keys))})'
    )
    with get_db() as conn:
        cur = conn.execute(sql, list(pred.values()))
        return cur.lastrowid


def get_predictions(limit: int = 100) -> List[Dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            'SELECT * FROM ai_predictions ORDER BY timestamp DESC LIMIT ?', (limit,)
        ).fetchall()
        return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Calibration helpers
# ---------------------------------------------------------------------------
def insert_calibration(cal: Dict[str, Any]) -> int:
    keys = list(cal.keys())
    sql = (
        f'INSERT INTO calibration ({", ".join(keys)}) '
        f'VALUES ({", ".join(["?"]*len(keys))})'
    )
    with get_db() as conn:
        cur = conn.execute(sql, list(cal.values()))
        return cur.lastrowid


def get_calibration_history(device_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            'SELECT * FROM calibration WHERE device_id=? ORDER BY timestamp DESC LIMIT ?',
            (device_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]
