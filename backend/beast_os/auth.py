"""Device pairing, tokens and roles.

Every device (Beast's own window included) pairs once with a 6-digit code made
on Beast with `beast-os pair`. The device gets a random token, kept in an
HttpOnly SameSite=Strict cookie (browsers) or sent as a Bearer header
(Termux/scripts). Only sha256(token) is stored. Loopback is NOT trusted on its
own, because the tablet's SSH tunnel also arrives from 127.0.0.1.

Roles: owner > tablet > guest.
"""
import hashlib
import secrets
import threading
import time

ROLES = {"guest": 0, "tablet": 1, "owner": 2}
COOKIE = "bos"
CODE_TTL = 300          # pairing code lifetime, seconds
MAX_ATTEMPTS = 5        # bad pairing attempts per IP per window
WINDOW = 600


def _h(s):
    return hashlib.sha256(s.encode()).hexdigest()


class Auth:
    def __init__(self, store):
        self.s = store
        self._fails = {}
        self._lock = threading.Lock()

    # ---- pairing
    def new_code(self, role="owner", name=None):
        if role not in ROLES:
            raise ValueError("role must be one of " + ", ".join(ROLES))
        code = f"{secrets.randbelow(10**6):06d}"
        self.s.x("DELETE FROM pair_codes WHERE expires < ?", (time.time(),))
        self.s.x("INSERT OR REPLACE INTO pair_codes(code_hash,role,name,expires) VALUES(?,?,?,?)",
                 (_h(code), role, name, time.time() + CODE_TTL))
        return code

    def throttled(self, ip):
        with self._lock:
            now = time.time()
            hits = [t for t in self._fails.get(ip, []) if now - t < WINDOW]
            self._fails[ip] = hits
            return len(hits) >= MAX_ATTEMPTS

    def redeem(self, code, device_name, ip):
        if self.throttled(ip):
            return None, "too many attempts, wait 10 minutes"
        code = (code or "").strip()
        row = self.s.one("SELECT * FROM pair_codes WHERE code_hash=? AND expires>=?", (_h(code), time.time()))
        if not row:
            with self._lock:
                self._fails.setdefault(ip, []).append(time.time())
            return None, "wrong or expired code"
        self.s.x("DELETE FROM pair_codes WHERE code_hash=?", (row["code_hash"],))
        token = secrets.token_urlsafe(32)
        name = (device_name or row["name"] or "device")[:60]
        self.s.x("INSERT INTO devices(token_hash,name,role,created,last_seen) VALUES(?,?,?,?,?)",
                 (_h(token), name, row["role"], time.time(), time.time()))
        self.s.audit(name, "paired as " + row["role"])
        return {"token": token, "role": row["role"], "name": name}, None

    # ---- per-request
    def identify(self, headers):
        tok = None
        a = headers.get("Authorization", "")
        if a.startswith("Bearer "):
            tok = a[7:].strip()
        if not tok:
            for part in headers.get("Cookie", "").split(";"):
                k, _, v = part.strip().partition("=")
                if k == COOKIE:
                    tok = v
        if not tok:
            return None
        row = self.s.one("SELECT name, role, last_seen FROM devices WHERE token_hash=?", (_h(tok),))
        if row and time.time() - (row["last_seen"] or 0) > 60:
            self.s.x("UPDATE devices SET last_seen=? WHERE token_hash=?", (time.time(), _h(tok)))
        return row

    @staticmethod
    def allows(who, need):
        return bool(who) and ROLES.get(who["role"], -1) >= ROLES[need]

    def revoke(self, name):
        return self.s.x("DELETE FROM devices WHERE name=?", (name,))

    def devices(self):
        return self.s.q("SELECT name, role, created, last_seen FROM devices ORDER BY created")


def same_origin(headers):
    """Reject cross-site writes. Browsers send Origin on POST; scripts send none."""
    origin = headers.get("Origin")
    site = headers.get("Sec-Fetch-Site")
    if site and site not in ("same-origin", "none"):
        return False
    if not origin:
        return True
    host = headers.get("Host", "")
    return origin.split("://", 1)[-1] == host
