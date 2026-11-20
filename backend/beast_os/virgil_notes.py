"""Virgil's notebook: what Virgil knows about the Beast ecosystem.

The notebook is a private markdown file (default ~/.config/beast-os/virgil/notes.md,
override with config llm.notes). Text before the first "## " heading is the core:
it goes into every system prompt, so keep it short. Each "## Heading" section after
it is a note; only the notes that match a question are sent with that question.

Hermes runs on Beast's CPU and reads roughly 30 tokens a second, so sending the
whole notebook every time would cost a minute or more per reply. The core stays
the same across turns, which lets Ollama reuse it from cache.
"""
import os
import re

DEFAULT_PATH = "~/.config/beast-os/virgil/notes.md"

STOP = set("""
a an and are as at be but by can could did do does doing for from had has have how i if in
into is it its me my no not of on or our should so that the their them then there these they
this to up us was we were what when where which who why will with would you your yours
please tell know about virgil virge hey ok okay just get got need want any some all
""".split())

_cache = {"key": None, "core": "", "notes": []}


def _stem(w):
    for suf in ("ing", "ed", "es", "s"):
        if len(w) > len(suf) + 3 and w.endswith(suf):
            return w[: -len(suf)]
    return w


def words(text):
    return {_stem(w) for w in re.findall(r"[a-z0-9][a-z0-9.+-]*", text.lower())
            if len(w) > 1 and w not in STOP}


def parse(text):
    parts = re.split(r"(?m)^## +", text)
    core = parts[0].strip()
    notes = []
    for p in parts[1:]:
        title, _, body = p.partition("\n")
        notes.append({"title": title.strip(), "body": body.strip(),
                      "tw": words(title), "bw": words(body)})
    return core, notes


def load(path=None):
    path = os.path.expanduser(path or DEFAULT_PATH)
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        return "", []
    key = (path, mtime)
    if _cache["key"] != key:
        with open(path, encoding="utf-8") as f:
            _cache["core"], _cache["notes"] = parse(f.read())
        _cache["key"] = key
    return _cache["core"], _cache["notes"]


def lookup(question, notes, budget=1200, limit=2):
    """Best-matching notes for a question, within `budget` characters."""
    q = words(question)
    if not q:
        return []
    scored = []
    for n in notes:
        s = 3 * len(q & n["tw"]) + len(q & n["bw"])
        if s:
            scored.append((s, n))
    scored.sort(key=lambda x: -x[0])
    out, used = [], 0
    # A weak runner-up (e.g. "working" matching a "work" note) is noise; drop it.
    scored = [x for x in scored if x[0] * 2 >= scored[0][0]] if scored else []
    for _, n in scored[:limit]:
        block = f"{n['title']}: {n['body']}"
        if used + len(block) > budget:
            block = block[: max(0, budget - used)].rsplit(" ", 1)[0]
        if block:
            out.append(block)
            used += len(block)
        if used >= budget:
            break
    return out


def context_for(question, cfg):
    """(core, notes_block) for Hermes. Both are empty strings if there's no notebook."""
    core, notes = load(cfg.get("notes"))
    hits = lookup(question, notes, cfg.get("notes_budget", 1200))
    block = ""
    if hits:
        block = "From your notebook (use if relevant):\n- " + "\n- ".join(hits) + "\n\n"
    return core, block
