"""SQLite persistence for saved loan calculations.

Single-user by design: there is no authentication, so anyone who can reach
the backend can read and modify every record. Inputs are stored as TEXT so the
exact decimal values round-trip; results are recomputed by the finance engine
whenever a record is read, so stored records can never drift from the formula.
"""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Generator

DEFAULT_DB_PATH = Path(__file__).resolve().parents[1] / "data" / "creditwise.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS calculations (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    principal     TEXT    NOT NULL,
    annual_rate   TEXT    NOT NULL,
    tenure_months INTEGER NOT NULL,
    fee_type      TEXT    NOT NULL CHECK (fee_type IN ('percent', 'flat')),
    fee_value     TEXT    NOT NULL,
    created_at    TEXT    NOT NULL,
    updated_at    TEXT    NOT NULL
);
"""


def db_path() -> Path:
    return Path(os.environ.get("CREDITWISE_DB_PATH", DEFAULT_DB_PATH))


@contextmanager
def connect() -> Generator[sqlite3.Connection]:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute(SCHEMA)
        yield conn
        conn.commit()
    finally:
        conn.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def list_records() -> list[sqlite3.Row]:
    with connect() as c:
        return c.execute("SELECT * FROM calculations ORDER BY created_at DESC, id DESC").fetchall()


def get_record(record_id: int) -> sqlite3.Row | None:
    with connect() as c:
        return c.execute("SELECT * FROM calculations WHERE id = ?", (record_id,)).fetchone()


def insert_record(name: str, principal: str, annual_rate: str, tenure_months: int, fee_type: str, fee_value: str) -> int:
    now = _now()
    with connect() as c:
        cur = c.execute(
            "INSERT INTO calculations (name, principal, annual_rate, tenure_months, fee_type, fee_value, created_at, updated_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (name, principal, annual_rate, tenure_months, fee_type, fee_value, now, now),
        )
        assert cur.lastrowid is not None
        return cur.lastrowid


def rename_record(record_id: int, name: str) -> bool:
    with connect() as c:
        cur = c.execute("UPDATE calculations SET name = ?, updated_at = ? WHERE id = ?", (name, _now(), record_id))
        return cur.rowcount > 0


def delete_record(record_id: int) -> bool:
    with connect() as c:
        cur = c.execute("DELETE FROM calculations WHERE id = ?", (record_id,))
        return cur.rowcount > 0
