"""Beast OS kernel: one small stdlib process that serves the shell, the
modules and the API. Run with `bin/beast-os serve`.

Layout:
  frontend/public/      the Home OS shell (frozen design), served at /
  modules/<id>/         plug-in modules (see registry.py)
  $BEAST_OS_HOME        ~/.config/beast-os: beast.json, secrets.json, beast-os.db
"""
import json
import mimetypes
import os
import posixpath
import queue
import threading
import time
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from . import integrations, registry
from .auth import COOKIE, ROLES, Auth, same_origin
from .store import Store

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SHELL = os.path.join(REPO, "frontend", "public")
MODULES = os.path.join(REPO, "modules")
HOME = os.environ.get("BEAST_OS_HOME", os.path.expanduser("~/.config/beast-os"))

MAX_JSON = 1 << 20          # 1 MB for JSON bodies
MAX_UPLOAD = 64 << 20       # per-route override for uploads / voice

CSP = ("default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob: data:; "
       "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; "
       "script-src 'self' 'unsafe-inline'; worker-src 'self' blob:; connect-src 'self'; "
       "frame-src 'self'{frames}; frame-ancestors 'self'; base-uri 'none'; form-action 'self'")

PUBLIC_PATHS = {"/pair", "/api/pair", "/icon.svg", "/manifest.json", "/favicon.ico"}


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def load_config():
    cfg = {}
    for name in ("beast.json", "secrets.json"):
        p = os.path.join(HOME, name)
        if os.path.exists(p):
            with open(p) as f:
                _deep_merge(cfg, json.load(f))
    integrations.CFG.clear()
    integrations.CFG.update(cfg)
    return cfg


def _deep_merge(a, b):
    for k, v in b.items():
        if isinstance(v, dict) and isinstance(a.get(k), dict):
            _deep_merge(a[k], v)
        else:
            a[k] = v


class HttpError(Exception):
    def __init__(self, code, msg):
        super().__init__(msg)
        self.code = code


class Request:
    def __init__(self, handler, path, query, who, params=None):
        self.h = handler
        self.path = path
        self.query = query
        self.who = who
        self.params = params or {}
        self._body = None

    def arg(self, name, default=None):
        return self.query.get(name, [default])[0]

    def body(self, limit=MAX_JSON):
        if self._body is None:
            n = int(self.h.headers.get("Content-Length") or 0)
            if n > limit:
                raise HttpError(413, "body too large")
            self._body = self.h.rfile.read(n) if n else b""
        return self._body

    def json(self):
        ctype = self.h.headers.get("Content-Type", "")
        if not ctype.startswith("application/json"):
            raise HttpError(415, "send application/json")
        try:
            return json.loads(self.body() or b"{}")
        except ValueError:
            raise HttpError(400, "bad JSON")


class Raw:
    """Return from a route to send bytes instead of JSON."""
    def __init__(self, data, ctype, cache="no-store"):
        self.data, self.ctype, self.cache = data, ctype, cache


class File:
    """Return from a route to stream a file from disk (supports Range, for video)."""
    def __init__(self, path, ctype, cache="no-store"):
        self.path, self.ctype, self.cache = path, ctype, cache


class Kernel:
    def __init__(self):
        os.makedirs(HOME, mode=0o700, exist_ok=True)
        self.cfg = load_config()
        self.store = Store(os.path.join(HOME, "beast-os.db"))
        self.auth = Auth(self.store)
        self.routes = {}            # (method, path) -> (fn, role, opts)
        self.prefix_routes = []     # (method, prefix, fn, role, opts)
        self.subs = set()
        self.subs_lock = threading.Lock()
        self.current_module = None
        self.modules = registry.load_all(MODULES, self, log)
        self.by_id = {m.id: m for m in self.modules}
        # modules may show a loopback-only app (e.g. War Room on 127.0.0.1:8765) in their tab
        frames = set()
        for m in self.modules:
            src = (m.meta.get("tab") or {}).get("src", "")
            if src.startswith("http://127.0.0.1:"):
                frames.add("/".join(src.split("/", 3)[:3]))
        frames = sorted(frames)
        self.csp = CSP.format(frames="".join(" " + f for f in frames))
        # pick up config/secret changes (e.g. a new HA token) without a restart
        self._cfg_mtime = self._cfg_stamp()
        every(10, self._watch_config)

    def _cfg_stamp(self):
        return tuple(os.path.getmtime(os.path.join(HOME, n)) if os.path.exists(os.path.join(HOME, n)) else 0
                     for n in ("beast.json", "secrets.json"))

    def _watch_config(self):
        st = self._cfg_stamp()
        if st != self._cfg_mtime:
            self._cfg_mtime = st
            self.reload_config()
            log("config reloaded")

    # ---- module API
    def route(self, method, path, fn, role="owner", prefix=False, max_body=MAX_JSON, stream=False):
        opts = {"max_body": max_body, "stream": stream, "module": self.current_module and self.current_module.id}
        if prefix:
            self.prefix_routes.append((method, path, fn, role, opts))
        else:
            self.routes[(method, path)] = (fn, role, opts)

    def emit(self, topic, data, role="guest"):
        msg = json.dumps({"topic": topic, "data": data})
        with self.subs_lock:
            for q, r in list(self.subs):
                if ROLES[r] >= ROLES[role]:
                    q.put(msg)

    def every(self, seconds, fn):
        every(seconds, fn)

    def reload_config(self):
        self.cfg = load_config()

    # ---- modes: vault (everything), normal (no Abyss), guest (house + toys only)
    MODES = ("vault", "normal", "guest")
    hooks = {}              # set by modules: verify_pattern, open_vault, close_vault

    def mode(self):
        m = self.store.kv_get("mode", "vault")
        return m if m in self.MODES else "vault"

    def module_ok(self, mod_id, mode=None):
        mod = self.by_id.get(mod_id)
        if not mod:
            return True
        return (mode or self.mode()) in mod.meta.get("modes", ["vault", "normal"])

    def set_mode(self, new, who, pattern=None):
        if new not in self.MODES:
            raise ValueError("mode must be vault, normal or guest")
        old = self.mode()
        rank = {"guest": 0, "normal": 1, "vault": 2}
        if rank[new] > rank[old]:
            verify = self.hooks.get("verify_pattern")
            res = verify(pattern) if verify else "unset"
            if res == "unset":           # no Abyss pattern yet: only the owner's device can switch up
                if who["role"] != "owner":
                    raise PermissionError("owner only")
            elif res is None:
                raise PermissionError("draw your pattern to switch up")
        if new != "vault" and self.hooks.get("close_vault"):
            self.hooks["close_vault"]()
        if new == "vault" and self.hooks.get("open_vault") and pattern:
            self.hooks["open_vault"](who, pattern)
        self.store.kv_set("mode", new)
        self.store.audit(who["name"], f"mode {old} -> {new}")
        self.emit("mode", {"mode": new, "by": who["name"]}, "guest")
        return new

    def visible_modules(self, who):
        mode = self.mode()
        return [m.public() for m in self.modules if self.auth.allows(who, m.role) and self.module_ok(m.id, mode)]

    def find_route(self, method, path):
        r = self.routes.get((method, path))
        if r:
            return r + ({},)
        for m, prefix, fn, role, opts in self.prefix_routes:
            if m == method and path.startswith(prefix):
                return fn, role, opts, {"rest": path[len(prefix):]}
        return None


KERNEL = None


class Handler(BaseHTTPRequestHandler):
    server_version = "BeastOS"
    sys_version = ""
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        pass

    # ---- responses
    def _common_headers(self, cache="no-store"):
        self.send_header("Cache-Control", cache)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Content-Security-Policy", KERNEL.csp)

    def send_json(self, obj, code=200, extra=None):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self._common_headers()
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(b)

    def send_bytes(self, data, ctype, cache="no-store", code=200):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self._common_headers(cache)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def send_file(self, f):
        size = os.path.getsize(f.path)
        start, end, code = 0, size - 1, 200
        rng = self.headers.get("Range", "")
        if rng.startswith("bytes=") and size:
            a, _, b = rng[6:].split(",")[0].partition("-")
            try:
                if a:
                    start = int(a)
                    end = min(int(b), size - 1) if b else size - 1
                else:
                    start = max(0, size - int(b))
                if start > end:
                    raise ValueError
                code = 206
            except ValueError:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
        self.send_response(code)
        self.send_header("Content-Type", f.ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1 if size else 0))
        if code == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self._common_headers(f.cache)
        self.end_headers()
        if self.command == "HEAD" or not size:
            return
        with open(f.path, "rb") as fh:
            fh.seek(start)
            left = end - start + 1
            while left > 0:
                chunk = fh.read(min(1 << 20, left))
                if not chunk:
                    break
                self.wfile.write(chunk)
                left -= len(chunk)

    def redirect(self, to):
        self.send_response(302)
        self.send_header("Location", to)
        self.send_header("Content-Length", "0")
        self._common_headers()
        self.end_headers()

    def fail(self, code, msg):
        if self.path.startswith("/api/") or self.command != "GET":
            return self.send_json({"ok": False, "error": msg}, code)
        self.send_bytes(f"{code} {msg}".encode(), "text/plain; charset=utf-8", code=code)

    # ---- dispatch
    def do_HEAD(self):
        self.dispatch("GET")

    def do_GET(self):
        self.dispatch("GET")

    def do_POST(self):
        self.dispatch("POST")

    def do_PUT(self):
        self.dispatch("PUT")

    def do_DELETE(self):
        self.dispatch("DELETE")

    def dispatch(self, method):
        k = KERNEL
        try:
            raw_path, _, qs = self.path.partition("?")
            path = posixpath.normpath(urllib.parse.unquote(raw_path)) if raw_path != "/" else "/"
            if raw_path.endswith("/") and path != "/":
                path += "/"
            query = urllib.parse.parse_qs(qs)
            who = k.auth.identify(self.headers)

            if method != "GET" and not same_origin(self.headers):
                return self.fail(403, "cross-site request refused")

            # pairing (public)
            if path == "/pair" and method == "GET":
                return self.send_bytes(PAIR_PAGE, "text/html; charset=utf-8")
            if path == "/api/pair" and method == "POST":
                return self.pair(Request(self, path, query, who))

            if not who:
                if path.startswith("/api/") or method != "GET":
                    return self.fail(401, "pair this device first: run `beast-os pair` on Beast")
                if path in PUBLIC_PATHS:
                    return self.static(SHELL, path)
                return self.redirect("/pair")

            # modes: guest clamps every device to guest powers; switching up needs the pattern
            mode = k.mode()
            if path == "/api/mode":
                if method == "POST":
                    if not k.auth.allows(who, "tablet"):
                        return self.fail(403, "not allowed for this device")
                    b = Request(self, path, query, who).json()
                    return self.send_json({"ok": True, "mode": k.set_mode(b.get("mode"), who, b.get("pattern"))})
                return self.send_json({"ok": True, "mode": mode})
            if mode == "guest":
                who = dict(who, role="guest")

            # kernel routes
            if path == "/api/me":
                return self.send_json({"name": who["name"], "role": who["role"], "mode": mode})
            if path == "/api/modules":
                return self.send_json({"modules": k.visible_modules(who)})
            if path == "/api/events":
                return self.events(who)
            if path == "/api/homeos/state":
                return self.homeos_state(method, Request(self, path, query, who))

            r = k.find_route(method, path)
            if r:
                fn, role, opts, params = r
                if not k.auth.allows(who, role):
                    return self.fail(403, "not allowed in this mode" if mode == "guest" else "not allowed for this device")
                if opts.get("module") and not k.module_ok(opts["module"], mode):
                    return self.fail(423, f"not available in {mode} mode")
                req = Request(self, path, query, who, params)
                if int(self.headers.get("Content-Length") or 0) > opts["max_body"]:
                    raise HttpError(413, "body too large")
                req.max_body = opts["max_body"]
                out = fn(req)
                if opts["stream"]:
                    return
                if isinstance(out, Raw):
                    return self.send_bytes(out.data, out.ctype, out.cache)
                if isinstance(out, File):
                    return self.send_file(out)
                return self.send_json({"ok": True, **(out or {})})

            # module static / proxy:  /m/<id>/...
            if path.startswith("/m/"):
                mid, _, rest = path[3:].partition("/")
                mod = k.by_id.get(mid)
                if not mod or not k.auth.allows(who, mod.role) or not k.module_ok(mid, mode):
                    return self.fail(404, "no such module")
                if mod.upstream:
                    return self.proxy(mod.upstream, "/" + rest, qs, method)
                if mod.web and method == "GET":
                    return self.static(mod.web, "/" + rest)
                return self.fail(404, "not found")

            # the tablet kiosk is hard-wired to /local/deck/
            if path.startswith("/local/deck/") and "beast" in k.by_id and k.by_id["beast"].web:
                return self.static(k.by_id["beast"].web, path[len("/local/deck"):])

            if method == "GET":
                return self.static(SHELL, path)
            return self.fail(404, "not found")
        except HttpError as e:
            return self.fail(e.code, str(e))
        except PermissionError as e:
            return self.fail(403, str(e))
        except (ValueError, KeyError) as e:
            return self.fail(400, str(e))
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception as e:
            log("error", self.command, self.path.split("?")[0], repr(e))
            return self.fail(500, "internal error")

    # ---- kernel handlers
    def pair(self, req):
        body = req.json()
        ip = self.client_address[0]
        res, err = KERNEL.auth.redeem(str(body.get("code", "")), str(body.get("name", ""))[:60], ip)
        if err:
            return self.send_json({"ok": False, "error": err}, 403)
        cookie = f"{COOKIE}={res['token']}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000"
        # token is also returned once, for Termux/scripts that use a Bearer header
        return self.send_json({"ok": True, "role": res["role"], "name": res["name"], "token": res["token"]},
                              extra={"Set-Cookie": cookie})

    def homeos_state(self, method, req):
        if not KERNEL.auth.allows(req.who, "tablet"):
            return self.fail(403, "not allowed for this device")
        if method == "GET":
            return self.send_json({"ok": True, "state": KERNEL.store.kv_get("homeos")})
        if method == "PUT":
            st = req.json().get("state")
            if not isinstance(st, dict):
                raise HttpError(400, "state must be an object")
            st.get("config", {}).pop("stripeKey", None)
            KERNEL.store.kv_set("homeos", st)
            KERNEL.emit("homeos.state", {"by": req.who["name"]}, "tablet")
            return self.send_json({"ok": True})
        return self.fail(405, "method not allowed")

    def events(self, who):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        q = queue.Queue(maxsize=200)
        entry = (q, who["role"])
        with KERNEL.subs_lock:
            KERNEL.subs.add(entry)
        try:
            self.wfile.write(b"retry: 3000\n\n")
            self.wfile.flush()
            while True:
                try:
                    msg = q.get(timeout=15)
                    self.wfile.write(f"data: {msg}\n\n".encode())
                except queue.Empty:
                    self.wfile.write(b": ping\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            with KERNEL.subs_lock:
                KERNEL.subs.discard(entry)
            self.close_connection = True

    def static(self, root, path):
        if path.endswith("/"):
            path += "index.html"
        full = os.path.realpath(os.path.join(root, path.lstrip("/")))
        if not (full == os.path.realpath(root) or full.startswith(os.path.realpath(root) + os.sep)):
            return self.fail(404, "not found")
        if os.path.isdir(full):
            full = os.path.join(full, "index.html")
        if not os.path.isfile(full):
            return self.fail(404, "not found")
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        with open(full, "rb") as f:
            data = f.read()
        self.send_bytes(data, ctype, "no-cache")

    def proxy(self, upstream, path, qs, method):
        url = upstream.rstrip("/") + path + ("?" + qs if qs else "")
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_JSON:
            return self.fail(413, "body too large")
        body = self.rfile.read(n) if n else None
        hdrs = {k: v for k, v in self.headers.items()
                if k.lower() in ("content-type", "accept", "accept-language")}
        req = urllib.request.Request(url, data=body, method=method, headers=hdrs)
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                data = r.read()
                return self.send_bytes(data, r.headers.get("Content-Type", "application/octet-stream"), "no-store", r.status)
        except urllib.error.HTTPError as e:
            return self.send_bytes(e.read(), e.headers.get("Content-Type", "text/plain"), "no-store", e.code)
        except OSError:
            return self.fail(502, "module is not running")


PAIR_PAGE = rb"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Beast OS: pair</title>
<style>
:root{--bg:#050607;--ink:#d8e6d8;--dim:#6f7d72;--acc:#32cd32}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 40%,#0b1a10,#050607 70%);
color:var(--ink);font-family:'JetBrains Mono','DejaVu Sans Mono',monospace}
form{width:min(340px,calc(100vw - 32px));padding:24px;border:1px solid rgba(120,255,140,.18);border-radius:12px;background:rgba(10,14,12,.7)}
h1{margin:0 0 4px;font-size:15px;letter-spacing:.3em;color:var(--acc)}p{color:var(--dim);font-size:12px;line-height:1.5}
input,button{width:100%;box-sizing:border-box;font:inherit;padding:10px;margin-top:10px;border-radius:8px;border:1px solid rgba(120,255,140,.25);background:#0a0f0c;color:var(--ink)}
input#code{font-size:28px;letter-spacing:.4em;text-align:center}button{cursor:pointer;color:var(--acc)}#msg{min-height:1.4em;color:#ff7a7a;font-size:12px}
</style></head><body><form id="f"><h1>BEAST OS</h1>
<p>On Beast, run <b>beast-os pair</b> and type the 6-digit code here. This device is remembered.</p>
<input id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required>
<input id="name" placeholder="Name this device (e.g. Tablet)" maxlength="60">
<button>PAIR</button><div id="msg"></div></form>
<script>
var F=document.getElementById('f');
F.onsubmit=function(e){e.preventDefault();
fetch('/api/pair',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({code:document.getElementById('code').value,name:document.getElementById('name').value})})
.then(function(r){return r.json()}).then(function(j){if(j.ok){location.href='/'}else{document.getElementById('msg').textContent=j.error}})
.catch(function(){document.getElementById('msg').textContent='Beast did not answer'})};
var m=/code=(\d{6})/.exec(location.hash);if(m){history.replaceState(null,'','/pair');
document.getElementById('code').value=m[1];document.getElementById('name').value=(/name=([^&]+)/.exec(location.hash)||[])[1]||'';
if(document.getElementById('name').value){document.getElementById('name').value=decodeURIComponent(document.getElementById('name').value)}
F.requestSubmit?F.requestSubmit():F.onsubmit(new Event('submit'))}
</script></body></html>"""


def serve(host="0.0.0.0", port=None):
    global KERNEL
    KERNEL = Kernel()
    port = port or KERNEL.cfg.get("port", 8080)
    srv = ThreadingHTTPServer((host, port), Handler)
    srv.daemon_threads = True
    log(f"Beast OS on http://{host}:{port}  ({len(KERNEL.modules)} modules, home {HOME})")
    threading.Thread(target=_tick, daemon=True).start()
    srv.serve_forever()


def _tick():
    """Background ticks for modules that registered a ticker."""
    while True:
        for fn, every, last in list(TICKERS):
            if time.time() - last[0] >= every:
                last[0] = time.time()
                try:
                    fn()
                except Exception as e:
                    log("ticker error", repr(e))
        time.sleep(1)


TICKERS = []


def every(seconds, fn):
    TICKERS.append((fn, seconds, [0.0]))
