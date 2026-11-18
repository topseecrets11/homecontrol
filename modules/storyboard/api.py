"""Storyboard: node-based storytelling canvas (from the Frame Grabber Studio
design, section 7). Projects live inside Abyss (Documents/Abyss/Storyboards),
so they're encrypted and only open in Vault mode with an Abyss session.

v1: content nodes, wires, views, snapshots, pictures. Process nodes that run
Frame Grabber pipelines come next."""
import importlib.util
import json
import mimetypes
import os
import re
import time

from beast_os.kernel import File, HttpError

_here = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "abyss", "api.py")
_spec = importlib.util.spec_from_file_location("beast_os_storyboard_abyss", _here)
_ab = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_ab)

NAME_RE = re.compile(r"^[\w .'\-]{1,60}$")
MAX_GRAPH = 8 << 20


def _session(req):
    """Abyss sessions live in the abyss module instance the kernel loaded; ask the kernel's copy."""
    sess = KMOD.get("session_left")
    if sess and sess(req.who) <= 0:
        raise HttpError(423, "Unlock Abyss first (Abyss tab → your pattern). Storyboards live inside it.")


def _root():
    root = _ab.safe_path("Documents/Storyboards")
    os.makedirs(root, mode=0o700, exist_ok=True)
    return root


def _proj(name):
    if not NAME_RE.match(name or "") or name.strip(" .") != name:
        raise ValueError("project names: letters, numbers, spaces, - _ . '")
    d = os.path.join(_root(), name)
    return d


KMOD = {}


def register(k):
    KMOD["session_left"] = k.hooks.get("session_left")

    def projects(req):
        _session(req)
        out = []
        for n in sorted(os.listdir(_root())):
            f = os.path.join(_root(), n, "graph.json")
            if os.path.isfile(f):
                out.append({"name": n, "modified": os.path.getmtime(f)})
        return {"projects": out}

    def load(req):
        _session(req)
        f = os.path.join(_proj(req.arg("name", "")), "graph.json")
        if not os.path.isfile(f):
            raise HttpError(404, "no such storyboard")
        with open(f) as fh:
            return {"graph": json.load(fh)}

    def save(req):
        _session(req)
        b = req.json() if int(req.h.headers.get("Content-Length") or 0) < MAX_GRAPH else None
        if not b:
            raise HttpError(413, "storyboard too big")
        d = _proj(b.get("name", ""))
        g = b.get("graph")
        if not isinstance(g, dict):
            raise ValueError("graph must be an object")
        os.makedirs(os.path.join(d, "pictures"), mode=0o700, exist_ok=True)
        if b.get("snapshot"):
            g.setdefault("snapshots", []).append({"at": time.time(), "label": str(b["snapshot"])[:60],
                                                  "nodes": g.get("nodes", []), "wires": g.get("wires", [])})
            g["snapshots"] = g["snapshots"][-20:]
        tmp = os.path.join(d, "graph.json.tmp")
        with open(tmp, "w") as fh:
            json.dump(g, fh)
        os.replace(tmp, os.path.join(d, "graph.json"))
        return {"saved": time.time()}

    def picture_up(req):
        _session(req)
        d = os.path.join(_proj(req.arg("project", "")), "pictures")
        os.makedirs(d, mode=0o700, exist_ok=True)
        name = os.path.basename(req.arg("name", "") or "picture.png")
        if not re.match(r"^[\w .\-]{1,80}\.(png|jpe?g|gif|webp|svg)$", name, re.I):
            raise ValueError("pictures only (png, jpg, gif, webp, svg)")
        base, ext = os.path.splitext(name)
        name = f"{int(time.time() * 1000)}-{base}{ext}"
        left = int(req.h.headers.get("Content-Length") or 0)
        if left > 64 << 20:
            raise HttpError(413, "picture too big")
        with open(os.path.join(d, name), "wb") as fh:
            while left > 0:
                c = req.h.rfile.read(min(1 << 20, left))
                if not c:
                    break
                fh.write(c)
                left -= len(c)
        return {"file": name}

    def picture(req):
        _session(req)
        d = os.path.join(_proj(req.arg("project", "")), "pictures")
        f = os.path.realpath(os.path.join(d, os.path.basename(req.arg("file", ""))))
        if not f.startswith(os.path.realpath(d) + os.sep) or not os.path.isfile(f):
            raise HttpError(404, "not found")
        return File(f, mimetypes.guess_type(f)[0] or "application/octet-stream", "private, max-age=600")

    k.route("GET", "/api/storyboard/projects", projects, role="owner")
    k.route("GET", "/api/storyboard/project", load, role="owner")
    k.route("PUT", "/api/storyboard/project", save, role="owner", max_body=MAX_GRAPH)
    k.route("POST", "/api/storyboard/picture", picture_up, role="owner", max_body=64 << 20)
    k.route("GET", "/api/storyboard/picture", picture, role="owner")
