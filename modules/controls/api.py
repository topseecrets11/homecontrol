"""Controls: War Room's buttons as Beast OS control panels.

War Room stays the one place buttons are defined (web/actions-default.json +
your edits in user.json). Each category becomes a panel; macros are the button
groups. Runs through abyss-agent (in your desktop session), using War Room's own
runner, so keys/terminal/screen actions work exactly as they do in War Room."""
import importlib.util
import os

_here = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "abyss", "api.py")
_spec = importlib.util.spec_from_file_location("beast_os_controls_abyss", _here)
_ab = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_ab)
agent = _ab.agent

ORDER = ["Home Assistant", "TV", "Media", "Audio", "Display", "YouTube / TV remote", "You-BEAST",
         "Devices", "Job queue", "Power", "War Room", "Vault"]


def register(k):
    def panels(req):
        acts = agent("wr_list")
        groups = {}
        for a in acts:
            if a.get("category") == "Vault":            # the old vault pads are replaced by Abyss
                continue
            groups.setdefault(a.get("category") or "Other", []).append(a)
        names = sorted(groups, key=lambda n: (ORDER.index(n) if n in ORDER else 99, n))
        return {"panels": [{"name": n, "actions": groups[n]} for n in names]}

    def run(req):
        aid = str(req.json().get("id", ""))
        k.store.audit(req.who["name"], "control " + aid)
        k.emit("controls.ran", {"id": aid}, "tablet")
        return agent("wr_run", id=aid)

    k.route("GET", "/api/controls", panels, role="tablet")
    k.route("POST", "/api/controls/run", run, role="tablet")
