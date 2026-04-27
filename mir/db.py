"""PostgreSQL connection pool and schema bootstrap for MIR."""

import logging
import os
from pathlib import Path

import psycopg2
from psycopg2 import pool, extras

log = logging.getLogger("mir.db")

_pool: pool.ThreadedConnectionPool | None = None


def get_pool() -> pool.ThreadedConnectionPool:
    """Get or create the connection pool (thread-safe, singleton)."""
    global _pool
    if _pool is None or _pool.closed:
        dsn = os.getenv("DATABASE_URL", "postgresql://mir:mir@localhost:5432/mir")
        _pool = pool.ThreadedConnectionPool(minconn=1, maxconn=10, dsn=dsn)
        log.info("PostgreSQL connection pool created")
    return _pool


def get_conn():
    """Get a connection from the pool."""
    return get_pool().getconn()


def put_conn(conn):
    """Return a connection to the pool."""
    get_pool().putconn(conn)


def execute(sql: str, params=None, fetch: bool = False):
    """Execute a query, optionally returning results."""
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            if fetch:
                result = cur.fetchall()
            else:
                result = None
            conn.commit()
            return result
    except Exception:
        conn.rollback()
        raise
    finally:
        put_conn(conn)


def execute_many(sql: str, params_list):
    """Execute a query with multiple parameter sets."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            extras.execute_batch(cur, sql, params_list)
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        put_conn(conn)


def ensure_schema():
    """Create tables if they don't exist (reads schema.sql)."""
    schema_path = Path(__file__).parent.parent / "schema.sql"
    if not schema_path.exists():
        log.warning("schema.sql not found, skipping schema creation")
        return
    sql = schema_path.read_text()
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        log.info("Database schema ensured")
    except Exception:
        conn.rollback()
        raise
    finally:
        put_conn(conn)
