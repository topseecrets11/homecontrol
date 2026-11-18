"""Studio: your animation and asset tools as one place in Beast OS.
Frame Grabber (grab / label / cut out / filter / upscale + gallery), the Rig
Gallery (assets, rigs, poses, sequences, Lottie). Each starts on demand on
Beast, loopback only, and stops itself when idle. Owner only (desktop work)."""
import importlib.util
import os

_here = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "abyss", "api.py")
_spec = importlib.util.spec_from_file_location("beast_os_studio_abyss", _here)
_ab = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_ab)

TOOLS = ("framegrabber", "riggallery")


def register(k):
    def open_tool(req):
        b = req.json()
        if b.get("tool") not in TOOLS:
            raise ValueError("unknown tool")
        return _ab.agent("studio_open", tool=b["tool"], view=b.get("view", ""))

    k.route("POST", "/api/studio/open", open_tool, role="owner")
