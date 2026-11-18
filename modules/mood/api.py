"""Mood check-ins (recovery / vitality / temper + words). Feeds the mood blob,
the wellbeing overlay and the lockout nudges."""
import time


def _num(v):
    v = float(v)
    if not 0 <= v <= 10:
        raise ValueError("values are 0 to 10")
    return v


def register(k):
    s = k.store

    def checkin(req):
        b = req.json()
        row = (time.time(), _num(b["recovery"]), _num(b["vitality"]), _num(b["temper"]), str(b.get("words", ""))[:500])
        rid = s.x("INSERT INTO mood_checkins(ts,recovery,vitality,temper,words) VALUES(?,?,?,?,?)", row)
        k.emit("mood.checkin", {"id": rid, "ts": row[0], "recovery": row[1], "vitality": row[2], "temper": row[3]}, "tablet")
        return {"id": rid}

    def history(req):
        days = max(1, min(365, int(req.arg("days", 30))))
        rows = s.q("SELECT id, ts, recovery, vitality, temper, words FROM mood_checkins WHERE ts>=? ORDER BY ts",
                   (time.time() - days * 86400,))
        streak, day = 0, time.strftime("%Y-%m-%d")
        seen = {time.strftime("%Y-%m-%d", time.localtime(r["ts"])) for r in rows}
        t = time.time()
        while time.strftime("%Y-%m-%d", time.localtime(t)) in seen:
            streak += 1
            t -= 86400
        return {"checkins": rows, "streak": streak, "today": day in seen}

    k.route("POST", "/api/mood/checkin", checkin, role="tablet")
    k.route("GET", "/api/mood/history", history, role="tablet")
