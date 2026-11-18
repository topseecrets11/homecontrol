"""KDE Connect: your phone, from Beast OS. Uses kdeconnect-cli and the session
D-Bus (the kernel unit sets DBUS_SESSION_BUS_ADDRESS). Owner only.

Ping, ring (find my phone), battery, send text/URL/file, SMS, notifications,
take a photo on the phone (saved into Abyss when it's open)."""
import os
import re
import shutil
import subprocess
import time

from beast_os.kernel import HttpError

ID_RE = re.compile(r"^[A-Za-z0-9_]{6,64}$")
HOME_DIR = os.path.expanduser("~")


def cli(*args, timeout=15):
    if not shutil.which("kdeconnect-cli"):
        raise HttpError(503, "KDE Connect isn't installed on Beast yet")
    r = subprocess.run(["kdeconnect-cli", *args], capture_output=True, text=True, timeout=timeout)
    if r.returncode:
        raise HttpError(502, (r.stderr or r.stdout).strip()[:200] or "kdeconnect-cli failed")
    return r.stdout


def dbus_prop(dev, iface_path, iface, prop):
    r = subprocess.run(["gdbus", "call", "--session", "--dest", "org.kde.kdeconnect",
                        "--object-path", f"/modules/kdeconnect/devices/{dev}/{iface_path}",
                        "--method", "org.freedesktop.DBus.Properties.Get", iface, prop],
                       capture_output=True, text=True, timeout=5)
    m = re.search(r"<(.+)>", r.stdout)
    return m.group(1).strip("'") if m else None


def devices():
    out = []
    try:
        ids = cli("-a", "--id-only").split()
        names = cli("-a", "--name-only").splitlines()
    except HttpError:
        raise
    for i, dev in enumerate(ids):
        charge = dbus_prop(dev, "battery", "org.kde.kdeconnect.device.battery", "charge")
        charging = dbus_prop(dev, "battery", "org.kde.kdeconnect.device.battery", "isCharging")
        out.append({"id": dev, "name": names[i] if i < len(names) else dev,
                    "battery": int(charge) if charge and charge.lstrip("-").isdigit() else None,
                    "charging": charging == "true"})
    return out


def dev_id(b):
    d = str(b.get("device", ""))
    if not ID_RE.match(d):
        raise ValueError("pick a device")
    return d


def register(k):
    def list_(req):
        return {"devices": devices()}

    def action(req):
        b = req.json()
        d = dev_id(b)
        a = b.get("action")
        if a == "ping":
            cli("-d", d, "--ping-msg", "Beast OS says hi")
        elif a == "ring":
            cli("-d", d, "--ring")
        elif a == "text":
            cli("-d", d, "--share-text", str(b["text"])[:4000])
        elif a == "url":
            url = str(b["url"])
            if not re.match(r"^https?://", url):
                raise ValueError("http(s) links only")
            cli("-d", d, "--share", url)
        elif a == "sms":
            num = str(b["to"]).replace(" ", "")
            if not re.match(r"^\+?[0-9]{6,15}$", num):
                raise ValueError("bad phone number")
            cli("-d", d, "--send-sms", str(b["text"])[:1000], "--destination", num)
        elif a == "photo":
            dest_dir = os.path.join(HOME_DIR, ".local", "share", "beast-os", "abyss", "Pictures")
            if not os.path.ismount(dest_dir):
                raise HttpError(423, "Open Abyss first, so the photo lands encrypted")
            os.makedirs(os.path.join(dest_dir, "Phone"), exist_ok=True)
            path = os.path.join(dest_dir, "Phone", time.strftime("phone-%Y%m%d-%H%M%S.jpg"))
            cli("-d", d, "--photo", path, timeout=60)
            return {"saved": "Pictures/Abyss/Phone/" + os.path.basename(path)}
        elif a == "notifications":
            return {"notifications": cli("-d", d, "--list-notifications").splitlines()[:50]}
        else:
            raise ValueError("unknown action")
        k.store.audit(req.who["name"], f"kdeconnect {a}")
        return {}

    k.route("GET", "/api/kdeconnect/devices", list_, role="owner")
    k.route("POST", "/api/kdeconnect/action", action, role="owner")
