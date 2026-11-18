"""SQLite store for the Beast OS kernel. Standard library only.

One file at $BEAST_OS_HOME/beast-os.db. Connections are per-thread (the HTTP
server is threaded); writes are serialised with a lock.
"""
import json
import os
import sqlite3
import threading
import time

SCHEMA = """
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS devices (
  token_hash TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL,
  created REAL NOT NULL, last_seen REAL
);
CREATE TABLE IF NOT EXISTS pair_codes (
  code_hash TEXT PRIMARY KEY, role TEXT NOT NULL, name TEXT, expires REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, updated REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS mood_checkins (
  id INTEGER PRIMARY KEY, ts REAL NOT NULL,
  recovery REAL, vitality REAL, temper REAL, words TEXT
);
CREATE TABLE IF NOT EXISTS ledger_products (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL DEFAULT 0,
  venture TEXT NOT NULL DEFAULT 'digital', created REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger_tx (
  id INTEGER PRIMARY KEY, ts REAL NOT NULL, product_id INTEGER, product TEXT,
  amount REAL NOT NULL, status TEXT NOT NULL DEFAULT 'paid', source TEXT,
  customer TEXT, venture TEXT NOT NULL DEFAULT 'digital'
);
CREATE TABLE IF NOT EXISTS market (
  venture TEXT NOT NULL, metric TEXT NOT NULL, value REAL, unit TEXT,
  source TEXT, fetched REAL NOT NULL, PRIMARY KEY (venture, metric)
);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY, ts REAL NOT NULL, who TEXT, what TEXT, ok INTEGER
);
"""


class Store:
    def __init__(self, path):
        self.path = path
        self._local = threading.local()
        self.lock = threading.Lock()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        fresh = not os.path.exists(path)
        with self.lock:
            self.db.executescript(SCHEMA)
        if fresh:
            os.chmod(path, 0o600)

    @property
    def db(self):
        c = getattr(self._local, "conn", None)
        if c is None:
            c = sqlite3.connect(self.path, timeout=10)
            c.row_factory = sqlite3.Row
            self._local.conn = c
        return c

    def q(self, sql, args=()):
        return [dict(r) for r in self.db.execute(sql, args).fetchall()]

    def one(self, sql, args=()):
        r = self.db.execute(sql, args).fetchone()
        return dict(r) if r else None

    def x(self, sql, args=()):
        with self.lock:
            cur = self.db.execute(sql, args)
            self.db.commit()
            return cur.lastrowid

    # key/value JSON blobs (e.g. the Home OS shell state, synced across devices)
    def kv_get(self, key, default=None):
        r = self.one("SELECT value FROM kv WHERE key=?", (key,))
        return json.loads(r["value"]) if r else default

    def kv_set(self, key, value):
        self.x("INSERT INTO kv(key,value,updated) VALUES(?,?,?) "
               "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated=excluded.updated",
               (key, json.dumps(value), time.time()))

    def audit(self, who, what, ok=True):
        self.x("INSERT INTO audit(ts,who,what,ok) VALUES(?,?,?,?)", (time.time(), who, what[:300], int(ok)))
