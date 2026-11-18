"""Prompt catalog: your go-to prompts with addresses filled in from
endpoints.json ({{event.ssh}}, {{ha.url}} ...). Lives in
~/.config/beast-os/prompts.json (private). "Send" types the prompt into the
`claude` tmux session on Beast, for the tablet/phone Termux workflow."""
import json
import os
import re
import shutil
import subprocess

from beast_os.kernel import HOME

HERE = os.path.dirname(os.path.abspath(__file__))
VAR = re.compile(r"\{\{\s*([a-z0-9_]+)\.([a-z0-9_]+)\s*\}\}")


def _load(name, fallback=None):
    p = os.path.join(HOME, name)
    if not os.path.exists(p) and fallback:
        shutil.copy(fallback, p)
        os.chmod(p, 0o600)
    with open(p) as f:
        return json.load(f)


def render(text, ep):
    def sub(m):
        v = ep.get(m.group(1), {}).get(m.group(2))
        return str(v) if v is not None else m.group(0)
    return VAR.sub(sub, text)


def catalog():
    ep = _load("endpoints.json")
    data = _load("prompts.json", os.path.join(HERE, "prompts.example.json"))
    return [{**p, "rendered": render(p["text"], ep)} for p in data.get("prompts", [])]


def register(k):
    def list_(req):
        return {"prompts": catalog()}

    def send(req):
        pid = req.json().get("id")
        p = next((x for x in catalog() if x["id"] == pid), None)
        if not p:
            raise ValueError("no such prompt")
        target = "claude"
        if subprocess.run(["tmux", "has-session", "-t", target], capture_output=True).returncode != 0:
            raise RuntimeError("no `claude` tmux session on Beast. Start one with: tmux new -s claude")
        subprocess.run(["tmux", "send-keys", "-t", target, "-l", p["rendered"]], check=True)
        return {"sent": pid}

    k.route("GET", "/api/prompts", list_, role="tablet")
    k.route("POST", "/api/prompts/send", send, role="owner")
