import json
import math
import os
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path


class Database:
    def __init__(self, url=None):
        configured = os.getenv("DATABASE_URL", "").strip()
        self.url = url.strip() if url is not None else configured or "sqlite:///data/qalqan.db"
        self.configured = bool(configured) or url is not None
        self.postgres = self.url.startswith(("postgres://", "postgresql://"))
        self.pool = None
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
            if self.pool is None:
                raise RuntimeError("Database must be initialized before use")
            with self.pool.connection(timeout=10) as conn:
                yield conn
            return
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
        if self.postgres and self.pool is None:
            from psycopg_pool import ConnectionPool
            self.pool = ConnectionPool(self.url, min_size=1, max_size=5,
                                       kwargs={"connect_timeout": 10}, open=False)
            self.pool.open(wait=True, timeout=10)
        with self.connection() as conn:
            if not self.postgres:
                conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("CREATE TABLE IF NOT EXISTS checks (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, created_at TEXT NOT NULL, result TEXT NOT NULL)")
            conn.execute("CREATE INDEX IF NOT EXISTS checks_session_date ON checks(session_id, created_at)")
            conn.execute("CREATE INDEX IF NOT EXISTS checks_date ON checks(created_at)")
            conn.execute("CREATE TABLE IF NOT EXISTS rate_limits (bucket TEXT NOT NULL, window_start BIGINT NOT NULL, used INTEGER NOT NULL, PRIMARY KEY (bucket, window_start))")
            conn.execute("CREATE INDEX IF NOT EXISTS rate_limits_window ON rate_limits(window_start)")
            conn.execute("CREATE TABLE IF NOT EXISTS feedback (check_id TEXT PRIMARY KEY, owner TEXT NOT NULL, vote TEXT NOT NULL, created_at TEXT NOT NULL, features TEXT NOT NULL)")
            conn.execute("CREATE INDEX IF NOT EXISTS feedback_owner ON feedback(owner)")
            conn.execute("CREATE INDEX IF NOT EXISTS feedback_date ON feedback(created_at)")

    def close(self):
        if self.pool is not None:
            self.pool.close()
            self.pool = None

    def reserve(self, bucket, limit, cost=1, now=None, period=60):
        """Atomic fixed-window quota shared by every app using this database."""
        moment = time.time() if now is None else now
        window = int(moment) // period * period
        bucket = str(period) + ':' + bucket
        retry = max(1, math.ceil(window + period - moment))
        if cost < 1 or cost > limit:
            return False, retry
        with self.connection() as conn:
            self.execute(conn, "DELETE FROM rate_limits WHERE window_start < ?", (int(moment) - 86400,))
            row = self.execute(conn, """INSERT INTO rate_limits (bucket, window_start, used) VALUES (?, ?, ?)
                ON CONFLICT (bucket, window_start) DO UPDATE SET used = rate_limits.used + excluded.used
                WHERE rate_limits.used + excluded.used <= ? RETURNING used""", (bucket, window, cost, limit)).fetchone()
        return row is not None, retry

    def save(self, session_id, result):
        self.save_many(session_id, [result])

    def save_many(self, session_id, results):
        # Only derived signals and hostnames, never the submitted message or query strings.
        with self.connection() as conn:
            self.execute(conn, "DELETE FROM checks WHERE created_at < ?", (results[0]["expires_before"],))
            self.execute(conn, "DELETE FROM feedback WHERE created_at < ?", (results[0]["expires_before"],))
            for result in results:
                clean = {k: v for k, v in result.items() if k != "expires_before"}
                self.execute(conn, "INSERT INTO checks VALUES (?, ?, ?, ?)",
                             (clean["id"], session_id, clean["created_at"], json.dumps(clean, ensure_ascii=False)))
            self.execute(conn, "DELETE FROM checks WHERE session_id = ? AND id NOT IN (SELECT id FROM checks WHERE session_id = ? ORDER BY created_at DESC LIMIT 200)", (session_id, session_id))

    def history(self, session_id):
        cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        with self.connection() as conn:
            rows = self.execute(conn, "SELECT result FROM checks WHERE session_id = ? AND created_at >= ? ORDER BY created_at DESC, id DESC LIMIT 200", (session_id, cutoff)).fetchall()
        return [json.loads(row[0]) for row in rows]

    def get(self, session_id, check_id):
        cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        with self.connection() as conn:
            row = self.execute(conn, "SELECT result FROM checks WHERE session_id = ? AND id = ? AND created_at >= ?", (session_id, check_id, cutoff)).fetchone()
        return json.loads(row[0]) if row else None

    def clear(self, session_id):
        with self.connection() as conn:
            self.execute(conn, "DELETE FROM checks WHERE session_id = ?", (session_id,))
            self.execute(conn, "DELETE FROM feedback WHERE owner = ?", (session_id,))

    def feedback(self, owner, item, vote):
        features = {key:item.get(key) for key in ('score','verdict','signals','urls','channel','scheme','model_version','rules_version')}
        with self.connection() as conn:
            self.execute(conn, """INSERT INTO feedback VALUES (?,?,?,?,?)
                ON CONFLICT(check_id) DO UPDATE SET vote=excluded.vote,created_at=excluded.created_at,features=excluded.features""",
                (item['id'],owner,vote,datetime.now(timezone.utc).isoformat(),json.dumps(features,ensure_ascii=False)))
