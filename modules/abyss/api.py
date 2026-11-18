"""Abyss: the encrypted vault inside Pictures, Music, Videos, Documents and Desktop.

Keys
- One random 32-byte vault key. It is never written down in plain.
- It's wrapped three ways, any one of which unlocks:
  the pattern (4x4 grid), the text phrase (backup), the microSD key file.
  wrap = vault_key XOR scrypt(secret, salt). A check hash tells a right
  answer from a wrong one.
- The gocryptfs password for every folder is the hex of the vault key, sent to
  abyss-agent (user service) over a 0600 socket, straight into gocryptfs stdin.

Sessions
- The dashboard itself never locks. Abyss does: each device unlocks with the
  pattern and gets 6 hours. When the last session runs out, Abyss is
  unmounted and Abyss apps (Blender etc.) are closed after a save signal.
- 5 wrong tries per device = 5-minute backoff, doubling.
"""
import hashlib
import json
import mimetypes
import os
import secrets
import socket
import threading
import time

from beast_os.kernel import HOME, File, HttpError

HOME_DIR = os.path.expanduser("~")
FOLDERS = ["Pictures", "Music", "Videos", "Documents", "Desktop"]
KEYRING = os.path.join(HOME, "abyss-keyring.json")
SOCK = os.path.join(HOME, "abyss.sock")
SESSION_S = 6 * 3600
WARN_S = 5 * 60
SCRYPT = dict(n=2 ** 15, r=8, p=1, maxmem=64 * 1024 * 1024, dklen=32)
CARD_FILE = "beast-os.key"
CARD_ROOTS = ["/media/topsee_crets", "/run/media/topsee_crets"]

LOCK = threading.Lock()
SESSIONS = {}          # device name -> expires (epoch)
FAILS = {}             # device name -> (count, blocked_until)
K = None


# ---------------------------------------------------------------- agent
def agent(op, **kw):
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.settimeout(180)
    try:
        s.connect(SOCK)
    except OSError:
        raise HttpError(503, "abyss-agent isn't running (systemctl --user start abyss-agent)")
    with s:
        s.sendall(json.dumps({"op": op, **kw}).encode() + b"\n")
        data = b""
        while not data.endswith(b"\n"):
            chunk = s.recv(65536)
            if not chunk:
                break
            data += chunk
    r = json.loads(data or b"{}")
    if not r.get("ok"):
        raise HttpError(500, r.get("error", "agent error"))
    return r["result"]


# ---------------------------------------------------------------- keys
def _kdf(secret: bytes, salt: bytes):
    return hashlib.scrypt(secret, salt=salt, **SCRYPT)


def _xor(a, b):
    return bytes(x ^ y for x, y in zip(a, b))


def _wrap(key, secret):
    salt = secrets.token_bytes(16)
    return {"salt": salt.hex(), "wrapped": _xor(key, _kdf(secret, salt)).hex()}


def _unwrap(entry, secret):
    return _xor(bytes.fromhex(entry["wrapped"]), _kdf(secret, bytes.fromhex(entry["salt"])))


def _check(key):
    return hashlib.sha256(b"abyss-check" + key).hexdigest()[:16]


def keyring():
    if not os.path.exists(KEYRING):
        return None
    with open(KEYRING) as f:
        return json.load(f)


def save_keyring(kr):
    tmp = KEYRING + ".tmp"
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump(kr, f, indent=1)
    os.replace(tmp, KEYRING)


def pattern_secret(points):
    if not isinstance(points, list) or len(points) < 6 or len(set(points)) != len(points) \
            or not all(isinstance(p, int) and 0 <= p < 16 for p in points):
        raise ValueError("draw at least 6 dots, no dot twice")
    return ("pattern:" + "-".join(str(p) for p in points)).encode()


def phrase_secret(phrase):
    phrase = (phrase or "").strip()
    if len(phrase) < 12:
        raise ValueError("backup phrase needs 12+ characters")
    return ("phrase:" + phrase).encode()


def find_card():
    for root in CARD_ROOTS:
        if not os.path.isdir(root):
            continue
        for name in os.listdir(root):
            p = os.path.join(root, name, CARD_FILE)
            if os.path.isfile(p):
                return p
    return None


def card_secret(path):
    with open(path, "rb") as f:
        data = f.read(4096)
    if len(data) < 32:
        raise ValueError("card key file is damaged")
    return b"card:" + data


# ---------------------------------------------------------------- sessions
def session_left(who):
    with LOCK:
        exp = SESSIONS.get(who["name"], 0)
    return max(0, int(exp - time.time()))


def require_session(req):
    if not session_left(req.who):
        raise HttpError(423, "Abyss is locked on this device. Draw your pattern.")


def any_session():
    now = time.time()
    with LOCK:
        for k in [k for k, v in SESSIONS.items() if v <= now]:
            SESSIONS.pop(k)
        return bool(SESSIONS), (min(SESSIONS.values()) if SESSIONS else 0)


def throttle(who):
    c, until = FAILS.get(who, (0, 0))
    if until > time.time():
        raise HttpError(429, f"too many tries, wait {int(until - time.time())}s")


def failed(who):
    c, _ = FAILS.get(who, (0, 0))
    c += 1
    FAILS[who] = (c, time.time() + (300 * 2 ** (c // 5 - 1) if c % 5 == 0 else 0))


def tick():
    live, soonest = any_session()
    try:
        st = agent("status")
    except Exception:
        return
    mounted = any(v["mounted"] for v in st.values())
    if mounted and not live:
        agent("umount")
        K.emit("abyss.locked", {"reason": "6 hours are up"}, "owner")
        K.store.audit("abyss", "auto-locked")
    elif live and soonest - time.time() < WARN_S:
        K.emit("abyss.warning", {"locks_in": int(soonest - time.time())}, "owner")


# ---------------------------------------------------------------- files
def safe_path(rel):
    rel = (rel or "").strip("/")
    folder, _, rest = rel.partition("/")
    if folder not in FOLDERS:
        raise ValueError("unknown Abyss folder")
    root = os.path.realpath(os.path.join(HOME_DIR, folder, "Abyss"))
    full = os.path.realpath(os.path.join(root, rest))
    if full != root and not full.startswith(root + os.sep):
        raise ValueError("bad path")
    if not os.path.ismount(root):
        raise HttpError(423, "Abyss is locked")
    return full


def category(name):
    t = (mimetypes.guess_type(name)[0] or "").split("/")[0]
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext in ("blend", "blend1"):
        return "3d"
    return {"image": "image", "video": "video", "audio": "audio", "text": "doc"}.get(t, "doc" if ext in ("pdf", "md", "txt", "doc", "docx", "odt") else "other")


# ---------------------------------------------------------------- routes
def register(k):
    global K
    K = k

    def status(req):
        kr = keyring()
        try:
            st = agent("status")
        except HttpError as e:
            st = {"error": str(e)}
        return {"setup": bool(kr), "methods": sorted((kr or {}).get("wraps", {}).keys()),
                "session_left": session_left(req.who), "folders": st, "card_present": bool(find_card())}

    def setup(req):
        if keyring():
            raise HttpError(409, "Abyss is already set up")
        b = req.json()
        key = secrets.token_bytes(32)
        wraps = {"pattern": _wrap(key, pattern_secret(b.get("pattern"))),
                 "phrase": _wrap(key, phrase_secret(b.get("phrase")))}
        save_keyring({"v": 1, "check": _check(key), "wraps": wraps, "created": time.time()})
        res = agent("init", password=key.hex())
        agent("mount", password=key.hex())
        with LOCK:
            SESSIONS[req.who["name"]] = time.time() + SESSION_S
        k.store.audit(req.who["name"], "abyss set up")
        return {"folders": res}

    def unlock(req):
        name = req.who["name"]
        throttle(name)
        kr = keyring()
        if not kr:
            raise HttpError(409, "set Abyss up first")
        b = req.json()
        how = b.get("method", "pattern")
        try:
            if how == "pattern":
                secret = pattern_secret(b.get("pattern"))
            elif how == "phrase":
                secret = phrase_secret(b.get("phrase"))
            elif how == "card":
                p = find_card()
                if not p:
                    raise ValueError("no Abyss key card found. Insert the microSD")
                secret = card_secret(p)
            else:
                raise ValueError("unknown method")
            key = _unwrap(kr["wraps"][how], secret)
        except (ValueError, KeyError):
            failed(name)
            k.store.audit(name, f"abyss unlock failed ({how})", ok=False)
            raise HttpError(403, "that's not it")
        if _check(key) != kr["check"]:
            failed(name)
            k.store.audit(name, f"abyss unlock failed ({how})", ok=False)
            raise HttpError(403, "that's not it")
        FAILS.pop(name, None)
        res = agent("mount", password=key.hex())
        with LOCK:
            SESSIONS[name] = time.time() + SESSION_S
        k.store.audit(name, f"abyss unlocked ({how})")
        k.emit("abyss.unlocked", {"by": name}, "owner")
        return {"folders": res, "session_left": SESSION_S}

    def add_card(req):
        """Write a fresh key file onto the inserted microSD and add it as an unlock method.
        Needs an open session (you proved who you are with the pattern first)."""
        require_session(req)
        b = req.json()
        kr = keyring()
        key = _unwrap(kr["wraps"]["pattern"], pattern_secret(b.get("pattern")))
        if _check(key) != kr["check"]:
            raise HttpError(403, "pattern doesn't match")
        roots = [os.path.join(r, n) for r in CARD_ROOTS if os.path.isdir(r) for n in os.listdir(r)]
        target = b.get("mount") or (roots[0] if len(roots) == 1 else None)
        if not target or target not in roots:
            raise ValueError("insert one microSD (found: %s)" % ", ".join(roots or ["none"]))
        data = secrets.token_bytes(64)
        with open(os.path.join(target, CARD_FILE), "wb") as f:
            f.write(data)
        kr["wraps"]["card"] = _wrap(key, b"card:" + data)
        save_keyring(kr)
        return {"card": target}

    def lock(req):
        with LOCK:
            SESSIONS.clear()
        res = agent("umount")
        k.store.audit(req.who["name"], "abyss locked")
        k.emit("abyss.locked", {"by": req.who["name"]}, "owner")
        return {"folders": res}

    def list_(req):
        require_session(req)
        rel = req.arg("path", "")
        if not rel:
            return {"path": "", "entries": [{"name": f, "dir": True, "category": "folder"} for f in FOLDERS]}
        full = safe_path(rel)
        out = []
        for e in sorted(os.scandir(full), key=lambda e: (not e.is_dir(), e.name.lower())):
            if e.name.startswith("."):
                continue
            st = e.stat()
            out.append({"name": e.name, "dir": e.is_dir(), "size": st.st_size, "mtime": st.st_mtime,
                        "category": "folder" if e.is_dir() else category(e.name)})
        return {"path": rel.strip("/"), "entries": out}

    def file_(req):
        require_session(req)
        full = safe_path(req.arg("path", ""))
        if not os.path.isfile(full):
            raise HttpError(404, "not found")
        return File(full, mimetypes.guess_type(full)[0] or "application/octet-stream", "no-store")

    def upload(req):
        require_session(req)
        folder = req.arg("folder", "")
        name = os.path.basename(req.arg("name", "") or "")
        if not name or name.startswith("."):
            raise ValueError("bad file name")
        full = safe_path(folder + "/" + name)
        if os.path.exists(full):
            base, ext = os.path.splitext(full)
            full = f"{base}-{int(time.time())}{ext}"
        left = int(req.h.headers.get("Content-Length") or 0)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        tmp = full + ".part"
        with open(tmp, "wb") as f:           # streamed: big videos never sit in memory
            while left > 0:
                chunk = req.h.rfile.read(min(1 << 20, left))
                if not chunk:
                    break
                f.write(chunk)
                left -= len(chunk)
        if left:
            os.unlink(tmp)
            raise HttpError(400, "upload cut short")
        os.replace(tmp, full)
        k.store.audit(req.who["name"], "abyss upload " + os.path.basename(full))
        return {"saved": os.path.relpath(full, HOME_DIR)}

    def mkdir(req):
        require_session(req)
        full = safe_path(req.json().get("path", ""))
        os.makedirs(full, mode=0o700, exist_ok=True)
        return {}

    def run(req):
        require_session(req)
        b = req.json()
        return agent("run", app=b.get("app"), sub=b.get("sub", ""), net="none")

    k.route("GET", "/api/abyss/status", status, role="tablet")
    k.route("POST", "/api/abyss/setup", setup, role="owner")
    k.route("POST", "/api/abyss/unlock", unlock, role="tablet")
    k.route("POST", "/api/abyss/lock", lock, role="tablet")
    k.route("POST", "/api/abyss/card", add_card, role="owner")
    k.route("GET", "/api/abyss/list", list_, role="tablet")
    k.route("GET", "/api/abyss/file", file_, role="tablet")
    k.route("POST", "/api/abyss/upload", upload, role="tablet", max_body=8 << 30)
    k.route("POST", "/api/abyss/mkdir", mkdir, role="tablet")
    k.route("POST", "/api/abyss/run", run, role="owner")
    k.every(60, tick)
