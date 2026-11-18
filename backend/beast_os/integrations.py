"""House integrations, lifted from beast-hub/server.py and tightened.

Changes from beast-hub:
- Home Assistant service calls go through an allowlist (config `ha_allow`).
- Artwork proxy paths are validated, so it can't be used to read HA/Jellyfin APIs.
- Secrets come from secrets.json, never from the browser.
"""
import fnmatch
import json
import re
import socket
import subprocess
import time
import urllib.parse
import urllib.request

CFG = {}          # filled by kernel.load_config()

DEFAULT_HA_ALLOW = ["light.*", "switch.turn_on", "switch.turn_off", "switch.toggle",
                    "media_player.*", "scene.turn_on", "script.turn_on", "fan.*", "cover.*"]


def run(cmd, timeout=8):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.returncode, r.stdout.strip(), r.stderr.strip()
    except Exception as e:
        return 1, "", str(e)


def http_json(url, method="GET", body=None, headers=None, timeout=6, raw=False):
    data = None
    h = dict(headers or {})
    if body is not None:
        if isinstance(body, (bytes, bytearray)):
            data = body
        else:
            data = json.dumps(body).encode()
            h.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        payload = r.read()
        if raw:
            return payload, r.headers.get("Content-Type", "application/octet-stream")
        return json.loads(payload) if payload else None


def tcp_up(host, port, timeout=0.6):
    if not host:
        return False
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


class HA:
    @staticmethod
    def ok():
        c = CFG.get("homeassistant", {})
        return bool(c.get("url") and c.get("token"))

    @staticmethod
    def req(path, method="GET", body=None, timeout=6, raw=False):
        c = CFG["homeassistant"]
        return http_json(c["url"].rstrip("/") + path, method, body,
                         {"Authorization": "Bearer " + c["token"]}, timeout, raw)

    @staticmethod
    def allowed(domain, service):
        pats = CFG.get("ha_allow") or DEFAULT_HA_ALLOW
        return any(fnmatch.fnmatchcase(f"{domain}.{service}", p) for p in pats)

    @staticmethod
    def call(domain, service, data=None):
        if not re.fullmatch(r"[a-z_]+", domain or "") or not re.fullmatch(r"[a-z_]+", service or ""):
            raise ValueError("bad service name")
        if not HA.allowed(domain, service):
            raise PermissionError(f"{domain}.{service} is not on the Home Assistant allowlist")
        return HA.req(f"/api/services/{domain}/{service}", "POST", data or {})

    @staticmethod
    def states():
        wanted = set(CFG.get("media_players", [])) | set(CFG.get("lights", [])) | set(CFG.get("entities", []))
        out = {}
        for s in HA.req("/api/states") or []:
            eid = s["entity_id"]
            if eid in wanted or (not wanted and eid.split(".")[0] in ("media_player", "light", "switch", "sensor")):
                a = s.get("attributes", {})
                out[eid] = {
                    "state": s["state"], "name": a.get("friendly_name", eid),
                    "title": a.get("media_title"),
                    "artist": a.get("media_artist") or a.get("media_series_title"),
                    "app": a.get("app_name"), "volume": a.get("volume_level"),
                    "muted": a.get("is_volume_muted"), "source": a.get("source"),
                    "sources": a.get("source_list"), "sound_mode": a.get("sound_mode"),
                    "sound_modes": a.get("sound_mode_list"), "brightness": a.get("brightness"),
                    "unit": a.get("unit_of_measurement"), "device_class": a.get("device_class"),
                    "picture": ("ha:" + a["entity_picture"]) if a.get("entity_picture") else None,
                }
        return out


class Jellyfin:
    @staticmethod
    def ok():
        c = CFG.get("jellyfin", {})
        return bool(c.get("url") and c.get("api_key"))

    @staticmethod
    def req(path, method="GET", body=None, raw=False):
        c = CFG["jellyfin"]
        sep = "&" if "?" in path else "?"
        return http_json(f"{c['url'].rstrip('/')}{path}{sep}api_key={c['api_key']}", method, body, raw=raw)

    @staticmethod
    def sessions():
        out = []
        for s in Jellyfin.req("/Sessions") or []:
            if not s.get("SupportsRemoteControl"):
                continue
            np = s.get("NowPlayingItem")
            ps = s.get("PlayState", {})
            out.append({
                "id": s["Id"], "device": s.get("DeviceName"), "client": s.get("Client"), "user": s.get("UserName"),
                "item": np and {"id": np["Id"], "name": np.get("Name"), "series": np.get("SeriesName"),
                                "artist": ", ".join(np.get("Artists", []) or []), "type": np.get("Type"),
                                "runtime": np.get("RunTimeTicks"),
                                "picture": f"jf:/Items/{np['Id']}/Images/Primary?maxHeight=300"},
                "position": ps.get("PositionTicks"), "paused": ps.get("IsPaused"),
            })
        return out

    @staticmethod
    def move(src, dst):
        s = next((x for x in Jellyfin.sessions() if x["id"] == src), None)
        if not s or not s["item"]:
            raise ValueError("source session is not playing anything")
        q = urllib.parse.urlencode({"playCommand": "PlayNow", "itemIds": s["item"]["id"],
                                    "startPositionTicks": s["position"] or 0})
        Jellyfin.req(f"/Sessions/{urllib.parse.quote(dst)}/Playing?{q}", "POST")
        Jellyfin.req(f"/Sessions/{urllib.parse.quote(src)}/Playing/Stop", "POST")


# Only artwork paths may be proxied.
IMG_HA = re.compile(r"^/api/(media_player_proxy|camera_proxy|image_proxy)/[\w.\-]+(\?[\w=&%.\-]*)?$")
IMG_JF = re.compile(r"^/Items/[0-9a-fA-F\-]{8,40}/Images/(Primary|Backdrop|Thumb)(\?[\w=&%.\-]*)?$")


def artwork(src):
    if src.startswith("ha:") and HA.ok() and IMG_HA.match(src[3:]):
        return HA.req(src[3:], raw=True)
    if src.startswith("jf:") and Jellyfin.ok() and IMG_JF.match(src[3:]):
        return Jellyfin.req(src[3:], raw=True)
    raise PermissionError("not an artwork path")


class Audio:
    @staticmethod
    def state():
        _, out, _ = run(["pactl", "-f", "json", "list", "sinks"])
        _, default, _ = run(["pactl", "get-default-sink"])
        sinks = []
        for s in json.loads(out or "[]"):
            vols = [int(v["value_percent"].rstrip("%")) for v in s.get("volume", {}).values()]
            sinks.append({"name": s["name"], "label": s.get("description", s["name"]),
                          "volume": round(sum(vols) / len(vols)) if vols else 0,
                          "muted": s.get("mute"), "default": s["name"] == default,
                          "channels": len(s.get("channel_map", "").split(","))})
        mode = None
        card = CFG.get("audio", {}).get("card")
        if card:
            _, cards, _ = run(["pactl", "-f", "json", "list", "cards"])
            for c in json.loads(cards or "[]"):
                if c["name"] == card:
                    active = c.get("active_profile")
                    mode = next((k for k, v in CFG["audio"]["profiles"].items() if v == active), active)
        return {"sinks": sinks, "mode": mode, "modes": list(CFG.get("audio", {}).get("profiles", {}))}

    @staticmethod
    def set_mode(mode):
        a = CFG["audio"]
        if mode not in a.get("profiles", {}):
            raise ValueError("unknown audio mode")
        rc, _, err = run(["pactl", "set-card-profile", a["card"], a["profiles"][mode]])
        if rc:
            raise RuntimeError(err)
        time.sleep(0.4)
        for s in Audio.state()["sinks"]:
            if a["card"].replace("alsa_card.", "") in s["name"]:
                run(["pactl", "set-default-sink", s["name"]])

    @staticmethod
    def sink_ok(name):
        return name == "@DEFAULT_SINK@" or any(s["name"] == name for s in Audio.state()["sinks"])


class ADB:
    @staticmethod
    def cmd(dev, *args):
        host = dev.get("host") or ""
        if not host:
            raise ValueError("device has no address yet")
        s = host if ":" in host else f"{host}:5555"
        run(["adb", "connect", s], timeout=4)
        rc, out, err = run(["adb", "-s", s, *args], timeout=8)
        if rc:
            raise RuntimeError(err or out)
        return out


def wol(mac, broadcast="255.255.255.255"):
    m = bytes.fromhex(mac.replace(":", "").replace("-", ""))
    if len(m) != 6:
        raise ValueError("bad MAC")
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        s.sendto(b"\xff" * 6 + m * 16, (broadcast, 9))


class Hermes:
    """Local brain through Ollama's OpenAI-compatible API on 127.0.0.1."""
    HISTORY = []

    @staticmethod
    def ok():
        c = CFG.get("llm", {})
        if not c.get("url"):
            return False
        u = urllib.parse.urlparse(c["url"])
        return tcp_up(u.hostname, u.port or 80)

    @staticmethod
    def chat(text, room=None):
        c = CFG["llm"]
        Hermes.HISTORY.append({"role": "user", "content": text[:4000]})
        Hermes.HISTORY[:] = Hermes.HISTORY[-12:]
        sys_prompt = c.get("system", "") + (f" The user is in the {room}." if room else "")
        r = http_json(c["url"].rstrip("/") + "/chat/completions", "POST",
                      {"model": c.get("model", "hermes3:3b"),
                       "messages": [{"role": "system", "content": sys_prompt}] + Hermes.HISTORY},
                      {"Authorization": "Bearer " + (c.get("api_key") or "local")}, timeout=120)
        reply = r["choices"][0]["message"]["content"].strip()
        Hermes.HISTORY.append({"role": "assistant", "content": reply})
        return reply
