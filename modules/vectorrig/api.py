"""VectorRig: crop sprite sheets into parts, cut out, trace to flat vector, normalise
to the character style, add joint caps, validate, export. Projects live in
Pictures/Abyss/VectorRig/<project>. Vault mode + Abyss session only."""
import importlib.util
import json
import mimetypes
import os
import re
import shutil
import time

from beast_os.kernel import File, HttpError

_here = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "abyss", "api.py")
_spec = importlib.util.spec_from_file_location("beast_os_vectorrig_abyss", _here)
_ab = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_ab)

NAME = re.compile(r"^[\w .'\-]{1,48}$")
FILES = ("raw.png", "cut.png", "traced.svg", "final.svg")
K = {}


def _session(req):
    s = K["k"].hooks.get("session_left")
    if s and s(req.who) <= 0:
        raise HttpError(423, "Unlock Abyss first (Abyss tab → your pattern). VectorRig projects live inside it.")


def _root():
    r = _ab.safe_path("Pictures/VectorRig")
    os.makedirs(r, mode=0o700, exist_ok=True)
    return r


def _name(n, what="name"):
    n = (n or "").strip()
    if not NAME.match(n) or n.strip(". ") != n:
        raise ValueError(f"{what}: letters, numbers, spaces, - _ . '")
    return n


def _proj(n):
    d = os.path.join(_root(), _name(n, "project"))
    for sub in ("sheets", "parts"):
        os.makedirs(os.path.join(d, sub), mode=0o700, exist_ok=True)
    return d


def _stream_to(req, path, limit=64 << 20):
    left = int(req.h.headers.get("Content-Length") or 0)
    if left > limit:
        raise HttpError(413, "file too big")
    with open(path, "wb") as f:
        while left > 0:
            c = req.h.rfile.read(min(1 << 20, left))
            if not c:
                break
            f.write(c)
            left -= len(c)


def _part_info(d, part):
    pd = os.path.join(d, "parts", part)
    meta = {}
    if os.path.exists(os.path.join(pd, "meta.json")):
        meta = json.load(open(os.path.join(pd, "meta.json")))
    return {"name": part, "files": [f for f in FILES if os.path.exists(os.path.join(pd, f))], "meta": meta,
            "modified": os.path.getmtime(pd)}


def register(k):
    K["k"] = k

    def projects(req):
        _session(req)
        return {"projects": sorted(n for n in os.listdir(_root()) if os.path.isdir(os.path.join(_root(), n)))}

    def project(req):
        _session(req)
        d = _proj(req.arg("name"))
        sheets = sorted(os.listdir(os.path.join(d, "sheets")))
        parts = [_part_info(d, p) for p in sorted(os.listdir(os.path.join(d, "parts")))]
        return {"sheets": sheets, "parts": parts}

    def upload(req):
        _session(req)
        d = _proj(req.arg("project"))
        kind = req.arg("kind")
        if kind == "sheet":
            fn = os.path.basename(req.arg("name", "sheet.png"))
            if not re.match(r"^[\w .\-]{1,80}\.(png|jpe?g|webp)$", fn, re.I):
                raise ValueError("PNG, JPG or WEBP")
            _stream_to(req, os.path.join(d, "sheets", fn))
            return {"sheet": fn}
        if kind == "part":
            part = _name(req.arg("name"), "part name")
            pd = os.path.join(d, "parts", part)
            os.makedirs(pd, mode=0o700, exist_ok=True)
            for f in FILES[1:]:                     # a new crop makes later steps stale
                if os.path.exists(os.path.join(pd, f)):
                    os.unlink(os.path.join(pd, f))
            _stream_to(req, os.path.join(pd, "raw.png"))
            return {"part": _part_info(d, part)}
        raise ValueError("kind is sheet or part")

    def step(req):
        _session(req)
        b = req.json()
        d = _proj(b.get("project"))
        part = _name(b.get("part"), "part")
        pd = os.path.join(d, "parts", part)
        s = b.get("step")
        o = b.get("options") or {}
        src = {"bg": "raw.png", "trace": "cut.png" if os.path.exists(os.path.join(pd, "cut.png")) else "raw.png",
               "normalize": "traced.svg", "pad": "final.svg", "validate": "final.svg"}.get(s)
        if not src:
            raise ValueError("unknown step")
        if s == "pad" and not os.path.exists(os.path.join(pd, "final.svg")):
            src = "traced.svg"
        if s == "validate" and not os.path.exists(os.path.join(pd, "final.svg")):
            src = "traced.svg"
        if not os.path.exists(os.path.join(pd, src)):
            raise ValueError(f"do the step before this one first ({src} missing)")
        out = {"bg": "cut.png", "trace": "traced.svg", "normalize": "final.svg", "pad": "final.svg"}.get(s)
        args = {"in": os.path.join(pd, src)}
        if out:
            args["out"] = os.path.join(pd, out)
        for key in ("colours", "detail", "stroke", "palette", "tolerance", "radius", "model"):
            if key in o and isinstance(o[key], (int, float, str)):
                args[key] = o[key]
        if s == "pad":
            meta = _part_info(d, part)["meta"]
            args["joints"] = meta.get("joints", [])
        res = _ab.agent("vr", step=s, args=args)
        if s == "normalize" or s == "trace":       # a fresh trace/normalise drops old padding (it's re-applied)
            pass
        res.update(part=_part_info(d, part))
        return res

    def meta(req):
        _session(req)
        b = req.json()
        d = _proj(b.get("project"))
        part = _name(b.get("part"), "part")
        pd = os.path.join(d, "parts", part)
        if not os.path.isdir(pd):
            raise HttpError(404, "no such part")
        joints = [{"x": float(j["x"]), "y": float(j["y"]), "name": str(j.get("name", "joint"))[:24]}
                  for j in (b.get("joints") or [])[:32]]
        m = {"joints": joints, "updated": time.time()}
        json.dump(m, open(os.path.join(pd, "meta.json"), "w"))
        return {"part": _part_info(d, part)}

    def delete_part(req):
        _session(req)
        b = req.json()
        pd = os.path.join(_proj(b.get("project")), "parts", _name(b.get("part"), "part"))
        if os.path.isdir(pd):
            shutil.rmtree(pd)
        return {}

    def file_(req):
        _session(req)
        d = os.path.realpath(_proj(req.arg("project")))
        f = os.path.realpath(os.path.join(d, req.arg("path", "")))
        if not f.startswith(d + os.sep) or not os.path.isfile(f):
            raise HttpError(404, "not found")
        ct = "image/svg+xml" if f.endswith(".svg") else (mimetypes.guess_type(f)[0] or "application/octet-stream")
        return File(f, ct, "no-store")

    k.route("GET", "/api/vectorrig/projects", projects, role="owner")
    k.route("GET", "/api/vectorrig/project", project, role="owner")
    k.route("POST", "/api/vectorrig/upload", upload, role="owner", max_body=64 << 20)
    k.route("POST", "/api/vectorrig/step", step, role="owner")
    k.route("POST", "/api/vectorrig/meta", meta, role="owner")
    k.route("POST", "/api/vectorrig/delete", delete_part, role="owner")
    k.route("GET", "/api/vectorrig/file", file_, role="owner")
