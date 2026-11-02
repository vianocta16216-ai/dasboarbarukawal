#!/usr/bin/env python3
"""Local SQLite concurrency simulation for the durable Drive backup outbox.
This tests atomic D1-style claims, retry retention, and migration order.
It does not emulate Cloudflare's network or Google Drive APIs.
"""
import concurrent.futures
import os
import sqlite3
import tempfile
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "database" / "migrations"
SQL1 = (MIGRATIONS / "20261102_durable_drive_backup_queue.sql").read_text()
SQL2 = (MIGRATIONS / "20261103_durable_drive_queue_dispatch_and_pacing.sql").read_text()


def connect(path):
    con = sqlite3.connect(path, timeout=20, isolation_level=None)
    con.execute("PRAGMA busy_timeout=20000")
    return con


def main():
    with tempfile.TemporaryDirectory(prefix="kawal-drive-queue-") as tmp:
        db_path = os.path.join(tmp, "queue.sqlite")
        con = connect(db_path)
        con.execute("PRAGMA journal_mode=WAL")
        con.executescript(SQL1)
        con.executescript(SQL2)
        cols = {r[1] for r in con.execute("PRAGMA table_info(drive_backup_jobs)")}
        assert {"upload_id", "job_json", "status", "attempts", "next_attempt_at", "lease_until", "dispatch_until", "r2_ready"}.issubset(cols)

        now = int(time.time() * 1000)
        con.executemany(
            "INSERT INTO drive_backup_jobs(upload_id,job_json,status,attempts,next_attempt_at,lease_until,dispatch_until,r2_ready,created_at,updated_at) VALUES(?,?,'pending',0,?,0,0,1,?,?)",
            [(f"u-{i}", "{}", now, now, now) for i in range(100)],
        )
        con.commit()
        con.close()

        claim_sql = "UPDATE drive_backup_jobs SET status='retrying',lease_until=?,updated_at=? WHERE upload_id=? AND status IN ('pending','retrying') AND r2_ready=1 AND next_attempt_at<=? AND lease_until<=?"
        def claim(upload_id):
            db = connect(db_path)
            try:
                stamp = int(time.time() * 1000)
                cur = db.execute(claim_sql, (stamp + 300000, stamp, upload_id, stamp, stamp))
                return cur.rowcount
            finally:
                db.close()

        # 100 separate uploads are claimed concurrently once each.
        with concurrent.futures.ThreadPoolExecutor(max_workers=100) as pool:
            results = list(pool.map(claim, [f"u-{i}" for i in range(100)]))
        assert sum(results) == 100, f"Expected 100 distinct claims, got {sum(results)}"

        # Simultaneous claims for the same upload ID must have exactly one winner.
        db = connect(db_path)
        db.execute("INSERT INTO drive_backup_jobs(upload_id,job_json,status,attempts,next_attempt_at,lease_until,dispatch_until,r2_ready,created_at,updated_at) VALUES('shared','{}','pending',0,?,0,0,1,?,?)", (now, now, now))
        db.close()
        barrier = threading.Barrier(25)
        def claim_shared(_):
            barrier.wait()
            return claim("shared")
        with concurrent.futures.ThreadPoolExecutor(max_workers=25) as pool:
            shared_results = list(pool.map(claim_shared, range(25)))
        assert sum(shared_results) == 1, f"Expected one lease winner, got {sum(shared_results)}"

        # Failed Drive backup remains durable and may be scheduled indefinitely.
        db = connect(db_path)
        db.execute("UPDATE drive_backup_jobs SET status='retrying',attempts=7,next_attempt_at=?,lease_until=0,last_error='simulated 429' WHERE upload_id='shared'", (now + 30000,))
        row = db.execute("SELECT status,attempts,last_error FROM drive_backup_jobs WHERE upload_id='shared'").fetchone()
        assert row == ("retrying", 7, "simulated 429")
        assert db.execute("SELECT COUNT(*) FROM drive_backup_jobs").fetchone()[0] == 101
        db.close()

    print("PASS: migration order, 100 simultaneous distinct claims, 25-way same-upload lock (one winner), and durable retry retention.")


if __name__ == "__main__":
    main()
