"""Beast controls: house state, scenes, audio, Jellyfin, HA, ADB, WoL, Hermes voice.

Ported from beast-hub. Keeps beast-hub's endpoints (/api/state, /api/action,
/api/voice, /api/img) so its dashboard and the tablet kiosk work unchanged.
Guests may read state and use lights/media; everything else needs tablet+.
"""
import base64
import json
import threading
import urllib.parse
import uuid

from beast_os import integrations as I
from beast_os.kernel import Raw, HttpError

STATE = {}
LOCK = threading.Lock()
K = None

GUEST_ACTIONS = {"light.toggle", "media", "jf.cmd"}


def _hostport(url):
    u = urllib.parse.urlparse(url)
    return u.hostname, u.port or (443 if u.scheme == "https" else 80)


def safe(fn, default=None):
    try:
        return fn()
    except Exception as e:
        return {"error": str(e)} if default is None else default


def build_state():
    cfg = I.CFG
    devs = []
    for d in cfg.get("devices", []):
        port = {"adb": 5555}.get(d.get("type"), d.get("port", 22))
        devs.append({**{k: v for k, v in d.items() if k not in ("mac", "host")}, "wol": bool(d.get("mac")),
                     "online": d.get("type") == "local" or I.tcp_up(d.get("host"), port)})
    ha_url = cfg.get("homeassistant", {}).get("url", "")
    hp = urllib.parse.urlparse(ha_url)
    return {
        "devices": devs,
        "audio": safe(I.Audio.state),
        "ha": {"configured": I.HA.ok(), "online": I.tcp_up(hp.hostname, hp.port or 8123) if ha_url else False,
               "entities": safe(I.HA.states, {}) if I.HA.ok() else {}},
        "jellyfin": {"configured": I.Jellyfin.ok(),
                     "sessions": safe(I.Jellyfin.sessions, []) if I.Jellyfin.ok() else []},
        "hermes": {"configured": I.Hermes.ok(), "voice": bool(cfg.get("stt", {}).get("url"))},
        "scenes": {k: {"name": v["name"], "icon": v.get("icon", "bolt"), "hue": v.get("hue")}
                   for k, v in cfg.get("scenes", {}).items()},
        "cameras": cfg.get("cameras", []),
        "remotes": [d["id"] for d in cfg.get("devices", []) if d.get("type") == "adb"],
    }


_beats = [0]


def refresh(force=False):
    new = build_state()
    with LOCK:
        changed = new != STATE
        STATE.clear()
        STATE.update(new)
    _beats[0] += 1
    if changed or force or _beats[0] % 10 == 0:      # heartbeat about every 20 s
        K.emit("beast.state", new, "guest")


def do_action(p, who_role):
    a = p.get("action")
    if who_role == "guest" and a not in GUEST_ACTIONS:
        raise PermissionError("guests can only use lights and media")
    devs = {d["id"]: d for d in I.CFG.get("devices", [])}
    out = {}
    if a == "audio.mode":
        I.Audio.set_mode(p["mode"])
    elif a == "audio.volume":
        sink = p.get("sink", "@DEFAULT_SINK@")
        if not I.Audio.sink_ok(sink):
            raise ValueError("unknown sink")
        I.run(["pactl", "set-sink-volume", sink, f"{max(0, min(150, int(p['level'])))}%"])
    elif a == "audio.mute":
        sink = p.get("sink", "@DEFAULT_SINK@")
        if not I.Audio.sink_ok(sink):
            raise ValueError("unknown sink")
        I.run(["pactl", "set-sink-mute", sink, "toggle"])
    elif a == "audio.default":
        if not I.Audio.sink_ok(p["sink"]):
            raise ValueError("unknown sink")
        I.run(["pactl", "set-default-sink", p["sink"]])
    elif a == "ha":
        I.HA.call(p["domain"], p["service"], p.get("data"))
    elif a == "media":
        I.HA.call("media_player", p["cmd"], {"entity_id": p["entity"], **p.get("data", {})})
    elif a == "light.toggle":
        I.HA.call("light", "toggle", {"entity_id": p["entity"]})
    elif a == "jf.cmd":
        if p["cmd"] not in ("PlayPause", "Pause", "Unpause", "Stop", "NextTrack", "PreviousTrack"):
            raise ValueError("unknown Jellyfin command")
        I.Jellyfin.req(f"/Sessions/{urllib.parse.quote(p['session'])}/Playing/{p['cmd']}", "POST")
    elif a == "jf.move":
        I.Jellyfin.move(p["from"], p["to"])
    elif a == "wol":
        I.wol(devs[p["device"]]["mac"])
    elif a == "adb.key":
        I.ADB.cmd(devs[p["device"]], "shell", "input", "keyevent", str(int(p["key"])))
    elif a == "adb.app":
        pkg = str(p["package"])
        if not all(c.isalnum() or c in "._" for c in pkg):
            raise ValueError("bad package name")
        I.ADB.cmd(devs[p["device"]], "shell", "monkey", "-p", pkg, "-c", "android.intent.category.LAUNCHER", "1")
    elif a == "scene":
        sc = I.CFG["scenes"][p["id"]]
        errors = []
        for step in sc["steps"]:
            if "wait" in step:
                import time
                time.sleep(min(10, float(step["wait"])))
                continue
            try:
                do_action(step, "owner")
            except Exception as e:
                errors.append(f"{step.get('action')}: {e}")
        if errors:
            raise RuntimeError("; ".join(errors))
    elif a == "hermes":
        out = {"reply": I.Hermes.chat(str(p["text"]), p.get("room"))}
    elif a == "hermes.reset":
        I.Hermes.HISTORY.clear()
    elif a == "reload":
        if who_role != "owner":
            raise PermissionError("owner only")
        K.reload_config()
    else:
        raise ValueError(f"unknown action {a!r}")
    threading.Thread(target=refresh, args=(True,), daemon=True).start()
    return out


def transcribe(audio, ctype):
    c = I.CFG.get("stt", {})
    if not c.get("url"):
        raise RuntimeError("speech-to-text isn't set up yet")
    b = uuid.uuid4().hex
    ext = "webm" if "webm" in ctype else "ogg" if "ogg" in ctype else "wav"
    body = (f"--{b}\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\n{c.get('model', 'whisper-1')}\r\n"
            f"--{b}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"voice.{ext}\"\r\n"
            f"Content-Type: {ctype}\r\n\r\n").encode() + audio + f"\r\n--{b}--\r\n".encode()
    r = I.http_json(c["url"].rstrip("/") + "/audio/transcriptions", "POST", body,
                    {"Content-Type": f"multipart/form-data; boundary={b}"}, timeout=60)
    return r.get("text", "").strip()


def speak(text):
    c = I.CFG.get("tts", {})
    if not c.get("url"):
        return None, None
    return I.http_json(c["url"].rstrip("/") + "/audio/speech", "POST",
                       {"model": c.get("model", "tts-1"), "voice": c.get("voice", "alloy"), "input": text},
                       timeout=60, raw=True)


def register(k):
    global K
    K = k

    def state(req):
        with LOCK:
            return {"state": dict(STATE)}

    def action(req):
        return do_action(req.json(), req.who["role"])

    def voice(req):
        audio = req.body(16 << 20)
        text = transcribe(audio, req.h.headers.get("Content-Type", "audio/webm"))
        if not text:
            return {"heard": "", "reply": ""}
        K.emit("virgil.state", {"state": "thinking", "heard": text}, "tablet")
        reply = I.Hermes.chat(text, req.arg("room"))
        audio_out, ctype = speak(reply)
        K.emit("virgil.state", {"state": "speaking", "reply": reply}, "tablet")
        return {"heard": text, "reply": reply,
                "audio": audio_out and f"data:{ctype};base64,{base64.b64encode(audio_out).decode()}"}

    def img(req):
        try:
            data, ctype = I.artwork(req.arg("src", ""))
        except PermissionError:
            raise HttpError(404, "not found")
        except OSError:
            raise HttpError(502, "artwork unavailable")
        if not ctype.startswith("image/"):
            raise HttpError(404, "not found")
        return Raw(data, ctype, "private, max-age=60")

    k.route("GET", "/api/state", state, role="guest")
    k.route("POST", "/api/action", action, role="guest")
    k.route("POST", "/api/voice", voice, role="tablet", max_body=16 << 20)
    k.route("GET", "/api/img", img, role="guest")
    k.every(2, refresh)
