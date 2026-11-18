"""Plug-and-play module registry.

A module is a folder in modules/<id>/ with a module.json:

  {
    "id": "mood",                      # folder name, [a-z0-9-]
    "title": "Mood",
    "tab": {"label": "MOOD", "icon": "◐", "order": 40, "view": "page"},   # optional sidebar tab
    "role": "tablet",                  # minimum role to see/use it (guest|tablet|owner)
    "web": "web",                      # optional static folder, served at /m/<id>/
    "upstream": "http://127.0.0.1:8765",   # optional: reverse-proxied at /m/<id>/
    "enabled": true
  }

and optionally api.py with `register(kernel)`, which adds routes with
kernel.route(...). A module that fails to load is logged and skipped; it can
never take the kernel down. Drop a folder in to add a module, remove it to
take it away.
"""
import importlib.util
import json
import os
import re
import traceback

ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,31}$")


class Module:
    def __init__(self, path, meta):
        self.path = path
        self.meta = meta
        self.id = meta["id"]
        self.role = meta.get("role", "owner")
        self.web = os.path.join(path, meta["web"]) if meta.get("web") else None
        self.upstream = meta.get("upstream")
        self.error = None

    def public(self):
        return {"id": self.id, "title": self.meta.get("title", self.id), "tab": self.meta.get("tab"),
                "role": self.role, "web": bool(self.web), "proxied": bool(self.upstream),
                "error": self.error}


def load_all(modules_dir, kernel, log):
    found = []
    if not os.path.isdir(modules_dir):
        return found
    for name in sorted(os.listdir(modules_dir)):
        path = os.path.join(modules_dir, name)
        mpath = os.path.join(path, "module.json")
        if not os.path.isfile(mpath):
            continue
        try:
            with open(mpath) as f:
                meta = json.load(f)
            if meta.get("id") != name or not ID_RE.match(name):
                raise ValueError("module.json id must match its folder name")
            if meta.get("enabled") is False:
                continue
            mod = Module(path, meta)
            api = os.path.join(path, "api.py")
            if os.path.isfile(api):
                spec = importlib.util.spec_from_file_location(f"beast_os_mod_{name.replace('-', '_')}", api)
                m = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(m)
                if hasattr(m, "register"):
                    kernel.current_module = mod
                    m.register(kernel)
                    kernel.current_module = None
            found.append(mod)
            log(f"module {name} loaded")
        except Exception as e:
            log(f"module {name} FAILED: {e}")
            traceback.print_exc()
    return found
