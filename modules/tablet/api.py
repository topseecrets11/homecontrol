"""Tablet: lets a paired tablet register its Termux SSH key with Beast.

The key is locked down: LAN only, no agent/X11 forwarding, and tunnels only
to Beast OS (8090/8080). A shell is allowed so `cc` can attach to Claude Code
in tmux. Needs a paired device (a code from `beast-os pair --role tablet`)."""
import os
import re

KEY_RE = re.compile(r"^ssh-ed25519 [A-Za-z0-9+/=]{60,100}( [\w@.\-]{1,64})?$")
AUTH = os.path.expanduser("~/.ssh/authorized_keys")
OPTS = 'from="192.168.1.0/24",no-agent-forwarding,no-X11-forwarding,permitopen="127.0.0.1:8090",permitopen="127.0.0.1:8080"'


def register(k):
    def add_key(req):
        key = str(req.json().get("pubkey", "")).strip()
        if not KEY_RE.match(key):
            raise ValueError("send an ed25519 public key")
        os.makedirs(os.path.dirname(AUTH), mode=0o700, exist_ok=True)
        body = key.split()[1]
        existing = open(AUTH).read() if os.path.exists(AUTH) else ""
        if body in existing:
            return {"added": False, "note": "already there"}
        with open(AUTH, "a") as f:
            f.write(f"{OPTS} {key}\n")
        os.chmod(AUTH, 0o600)
        k.store.audit(req.who["name"], "tablet ssh key added")
        return {"added": True}

    k.route("POST", "/api/tablet/sshkey", add_key, role="tablet")
