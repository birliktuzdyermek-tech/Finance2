import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path


class Database:
    def __init__(self, url=None):
        configured = os.getenv("DATABASE_URL", "").strip()
        self.url = url.strip() if url is not None else configured or "sqlite:///data/qalqan.db"
        self.configured = bool(configured) or url is not None
        self.postgres = self.url.startswith(("postgres://", "postgresql://"))
        if os.getenv("REQUIRE_POSTGRES", "false").lower() == "true" and not self.postgres:
            raise ValueError("PostgreSQL is required. Set DATABASE_URL to the Internal Database URL in Render Environment.")
        if not self.postgres:
            if not self.url.startswith("sqlite:///"):
                raise ValueError("DATABASE_URL must be PostgreSQL or sqlite:///")
            self.path = self.url.removeprefix("sqlite:///")
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def connection(self):
        if self.postgres:
            import psycopg
            conn = psycopg.connect(self.url, connect_timeout=10)
        else:
            conn = sqlite3.connect(self.path, timeout=10)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def execute(self, conn, sql, params=()):
        return conn.execute(sql.replace("?", "%s") if self.postgres else sql, params)

    def init(self):
        with self.connection() as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS checks (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, created_at TEXT NOT NULL, result TEXT NOT NULL)")
            conn.execute("CREATE INDEX IF NOT EXISTS checks_session_date ON checks(session_id, created_at)")

    def save(self, session_id, result):
        # Only derived signals and hostnames, never the submitted message or query strings.
        with self.connection() as conn:
            self.execute(conn, "DELETE FROM checks WHERE created_at < ?", (result["expires_before"],))
            clean = {k: v for k, v in result.items() if k != "expires_before"}
            self.execute(conn, "INSERT INTO checks VALUES (?, ?, ?, ?)",
                         (clean["id"], session_id, clean["created_at"], json.dumps(clean, ensure_ascii=False)))
            self.execute(conn, "DELETE FROM checks WHERE session_id = ? AND id NOT IN (SELECT id FROM checks WHERE session_id = ? ORDER BY created_at DESC LIMIT 200)", (session_id, session_id))

    def history(self, session_id):
        with self.connection() as conn:
            rows = self.execute(conn, "SELECT result FROM checks WHERE session_id = ? ORDER BY created_at DESC LIMIT 200", (session_id,)).fetchall()
        return [json.loads(row[0]) for row in rows]

    def get(self, session_id, check_id):
        with self.connection() as conn:
            row = self.execute(conn, "SELECT result FROM checks WHERE session_id = ? AND id = ?", (session_id, check_id)).fetchone()
        return json.loads(row[0]) if row else None

    def clear(self, session_id):
        with self.connection() as conn:
            self.execute(conn, "DELETE FROM checks WHERE session_id = ?", (session_id,))
