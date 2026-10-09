import sqlite3
import logging
import threading
from contextlib import contextmanager
from datetime import datetime
from typing import Optional, List, Dict, Any

from config import db_cfg
from database.models import get_schema

logger = logging.getLogger(__name__)

_local = threading.local()
_db_path = str(db_cfg.DB_PATH)

def _is_postgres() -> bool:
    return bool(db_cfg.DATABASE_URL and db_cfg.DATABASE_URL.startswith('postgres'))

def _get_connection():
    if not hasattr(_local, 'conn') or _local.conn is None:
        if _is_postgres():
            import psycopg2
            from psycopg2.extras import RealDictCursor
            _local.conn = psycopg2.connect(db_cfg.DATABASE_URL, cursor_factory=RealDictCursor)
        else:
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

# Helper functions to bridge SQLite and PostgreSQL raw queries
def _execute(conn, sql: str, params=None):
    if _is_postgres():
        sql = sql.replace('?', '%s')
        cur = conn.cursor()
        cur.execute(sql, params or ())
        cur.close()
    else:
        conn.execute(sql, params or ())

def _insert_and_get_id(conn, sql: str, params) -> int:
    if _is_postgres():
        sql = sql.replace('?', '%s')
        if not sql.strip().upper().endswith('RETURNING ID'):
            sql += ' RETURNING id'
        cur = conn.cursor()
        cur.execute(sql, params)
        res = cur.fetchone()
        cur.close()
        return dict(res)['id'] if res else 0
    else:
        cur = conn.execute(sql, params)
        return cur.lastrowid

def _fetch_one(conn, sql: str, params=None) -> Optional[Dict[str, Any]]:
    if _is_postgres():
        sql = sql.replace('?', '%s')
        cur = conn.cursor()
        cur.execute(sql, params or ())
        row = cur.fetchone()
        cur.close()
        return dict(row) if row else None
    else:
        row = conn.execute(sql, params or ()).fetchone()
        return dict(row) if row else None

def _fetch_all(conn, sql: str, params=None) -> List[Dict[str, Any]]:
    if _is_postgres():
        sql = sql.replace('?', '%s')
        cur = conn.cursor()
        cur.execute(sql, params or ())
        rows = cur.fetchall()
        cur.close()
        return [dict(r) for r in rows]
    else:
        rows = conn.execute(sql, params or ()).fetchall()
        return [dict(r) for r in rows]


def init_db():
    if not _is_postgres():
        db_cfg.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        
    tables, indexes = get_schema(is_postgres=_is_postgres())
    
    with get_db() as conn:
        for stmt in tables:
            _execute(conn, stmt)
        for stmt in indexes:
            _execute(conn, stmt)
            
    if _is_postgres():
        logger.info('Database initialised on PostgreSQL (hosted)')
    else:
        logger.info('Database initialised at %s', _db_path)


# ---------------------------------------------------------------------------
# Device helpers
# ---------------------------------------------------------------------------
def upsert_device(device_id: str, data: Dict[str, Any]) -> None:
    cols = ', '.join(data.keys())
    placeholders = ', '.join(['?'] * len(data))
    updates = ', '.join(f'{k}=EXCLUDED.{k}' for k in data.keys())
    # Note: SQLite allows `excluded.k`, Postgres usually prefers uppercase `EXCLUDED.k`
    # Also Postgres ON CONFLICT requires specific syntax, but ON CONFLICT (device_id) DO UPDATE works on both.
    sql = (
        f'INSERT INTO devices (device_id, {cols}) VALUES (?, {placeholders}) '
        f'ON CONFLICT (device_id) DO UPDATE SET {updates}'
    )
    with get_db() as conn:
        _execute(conn, sql, [device_id] + list(data.values()))


def get_device(device_id: str) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        return _fetch_one(conn, 'SELECT * FROM devices WHERE device_id=?', (device_id,))


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
        return _insert_and_get_id(conn, sql, list(m.values()))


def get_latest_measurements(limit: int = 100) -> List[Dict[str, Any]]:
    with get_db() as conn:
        return _fetch_all(conn, 'SELECT * FROM measurements ORDER BY timestamp DESC LIMIT ?', (limit,))


def get_measurements_since(since: datetime, limit: int = 10000) -> List[Dict[str, Any]]:
    with get_db() as conn:
        return _fetch_all(conn, 
            'SELECT * FROM measurements WHERE timestamp >= ? ORDER BY timestamp ASC LIMIT ?',
            (since.isoformat(), limit)
        )


def get_measurement_range(start: datetime, end: datetime) -> List[Dict[str, Any]]:
    with get_db() as conn:
        return _fetch_all(conn,
            'SELECT * FROM measurements WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp ASC',
            (start.isoformat(), end.isoformat())
        )


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
        return _insert_and_get_id(conn, sql, list(evt.values()))


def get_events(limit: int = 200) -> List[Dict[str, Any]]:
    with get_db() as conn:
        return _fetch_all(conn, 'SELECT * FROM rf_events ORDER BY start_time DESC LIMIT ?', (limit,))


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
        return _insert_and_get_id(conn, sql, list(pred.values()))


def get_predictions(limit: int = 100) -> List[Dict[str, Any]]:
    with get_db() as conn:
        return _fetch_all(conn, 'SELECT * FROM ai_predictions ORDER BY timestamp DESC LIMIT ?', (limit,))


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
        return _insert_and_get_id(conn, sql, list(cal.values()))


def get_calibration_history(device_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    with get_db() as conn:
        return _fetch_all(conn,
            'SELECT * FROM calibration WHERE device_id=? ORDER BY timestamp DESC LIMIT ?',
            (device_id, limit)
        )
