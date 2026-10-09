import os
import sys
import sqlite3
import psycopg2
import psycopg2.extras
from pathlib import Path
from datetime import datetime

# Ensure we can import from the project root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import db_cfg
from database.models import get_schema

def migrate():
    sqlite_path = str(db_cfg.DB_PATH)
    pg_url = os.environ.get('DATABASE_URL')
    
    if not pg_url or not pg_url.startswith('postgres'):
        print("ERROR: DATABASE_URL environment variable is not set or invalid.")
        print("Usage: Set DATABASE_URL and run this script to migrate from SQLite to PostgreSQL.")
        sys.exit(1)
        
    if not os.path.exists(sqlite_path):
        print(f"ERROR: Source SQLite database not found at {sqlite_path}")
        sys.exit(1)
        
    print(f"Starting migration from {sqlite_path} to PostgreSQL...")
    
    try:
        pg_conn = psycopg2.connect(pg_url)
        pg_conn.autocommit = False
    except Exception as e:
        print(f"ERROR: Could not connect to PostgreSQL: {e}")
        sys.exit(1)
        
    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row
    
    # 1. Initialize schema
    print("\n--- Initializing PostgreSQL Schema ---")
    tables, indexes = get_schema(is_postgres=True)
    with pg_conn.cursor() as cur:
        for stmt in tables:
            cur.execute(stmt)
        for stmt in indexes:
            cur.execute(stmt)
    pg_conn.commit()
    print("Schema initialized successfully.")
    
    # 2. Define tables to migrate in dependency order
    tables_to_migrate = ['devices', 'measurements', 'rf_events', 'ai_predictions', 'calibration']
    
    # 3. Migrate data
    print("\n--- Migrating Data ---")
    
    for table in tables_to_migrate:
        # Get SQLite count
        sq_cur = sqlite_conn.execute(f"SELECT COUNT(*) as c FROM {table}")
        sq_count = sq_cur.fetchone()['c']
        
        # Get Postgres count
        with pg_conn.cursor() as pg_cur:
            pg_cur.execute(f"SELECT COUNT(*) as c FROM {table}")
            pg_count = pg_cur.fetchone()[0]
            
        if pg_count > 0:
            print(f"WARNING: PostgreSQL table '{table}' already contains {pg_count} rows. Skipping to prevent data corruption.")
            continue
            
        if sq_count == 0:
            print(f"Table '{table}': 0 rows to migrate.")
            continue
            
        print(f"Table '{table}': Migrating {sq_count} rows...")
        
        # Read all rows
        rows = sqlite_conn.execute(f"SELECT * FROM {table} ORDER BY id ASC").fetchall()
        if not rows:
            continue
            
        # Insert into PG
        cols = rows[0].keys()
        col_names = ", ".join(cols)
        placeholders = ", ".join(["%s"] * len(cols))
        insert_sql = f"INSERT INTO {table} ({col_names}) VALUES ({placeholders})"
        
        success_count = 0
        error_count = 0
        
        with pg_conn.cursor() as pg_cur:
            for row in rows:
                try:
                    pg_cur.execute(insert_sql, tuple(row))
                    success_count += 1
                except Exception as e:
                    print(f"  Error inserting row ID {row['id']}: {e}")
                    error_count += 1
                    pg_conn.rollback() # rollback this transaction
                    continue
                    
        # Reset Sequence for serial columns so new inserts don't fail with duplicate PK
        try:
            with pg_conn.cursor() as pg_cur:
                pg_cur.execute(f"SELECT setval('{table}_id_seq', (SELECT MAX(id) FROM {table}))")
        except Exception as e:
            # Not all tables might strictly use id_seq depending on definition, but standard SERIAL does.
            pass
            
        pg_conn.commit()
        print(f"Table '{table}': {success_count} migrated, {error_count} failed.")

    print("\n--- Migration Complete ---")
    pg_conn.close()
    sqlite_conn.close()

if __name__ == '__main__':
    migrate()
