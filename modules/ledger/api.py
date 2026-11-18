"""The Ledger: real products and transactions, tagged by venture
(digital, testtag, deals). Arena KPIs are computed from it, so zero sales
shows as zero, and the shell's nudge/lockout modes react to the truth."""
import time

VENTURES = ("digital", "testtag", "deals")
STATUSES = ("paid", "refunded", "abandoned", "pending")


def _venture(v):
    v = v or "digital"
    if v not in VENTURES:
        raise ValueError("venture must be one of " + ", ".join(VENTURES))
    return v


def summary(s):
    now = time.time()
    month0 = time.mktime(time.strptime(time.strftime("%Y-%m-01"), "%Y-%m-%d"))
    out = {}
    for v in VENTURES:
        paid = s.one("SELECT COUNT(*) n, COALESCE(SUM(amount),0) total FROM ledger_tx WHERE venture=? AND status='paid' AND ts>=?",
                     (v, month0))
        allpaid = s.one("SELECT COUNT(DISTINCT customer) c, COALESCE(SUM(amount),0) t FROM ledger_tx WHERE venture=? AND status='paid'", (v,))
        attempts = s.one("SELECT COUNT(*) n FROM ledger_tx WHERE venture=? AND ts>=?", (v, now - 30 * 86400))["n"]
        paid30 = s.one("SELECT COUNT(*) n FROM ledger_tx WHERE venture=? AND status='paid' AND ts>=?", (v, now - 30 * 86400))["n"]
        months = []
        for i in range(11, -1, -1):
            t = time.localtime(now - i * 30.4 * 86400)
            key = time.strftime("%Y-%m", t)
            r = s.one("SELECT COALESCE(SUM(amount),0) t FROM ledger_tx WHERE venture=? AND status='paid' "
                      "AND strftime('%Y-%m', ts, 'unixepoch', 'localtime')=?", (v, key))
            months.append(round(r["t"], 2))
        out[v] = {
            "monthNet": round(paid["total"], 2), "monthSales": paid["n"],
            "conversion": round(100 * paid30 / attempts, 2) if attempts else 0.0,
            "ltv": round(allpaid["t"] / allpaid["c"], 2) if allpaid["c"] else 0.0,
            "growth": months,
        }
    total = {"monthNet": round(sum(x["monthNet"] for x in out.values()), 2),
             "growth": [round(sum(out[v]["growth"][i] for v in VENTURES), 2) for i in range(12)]}
    return {"ventures": out, "total": total}


def register(k):
    s = k.store

    def products(req):
        return {"products": s.q("SELECT p.*, (SELECT COUNT(*) FROM ledger_tx t WHERE t.product_id=p.id AND t.status='paid') sales, "
                                "(SELECT COALESCE(SUM(amount),0) FROM ledger_tx t WHERE t.product_id=p.id AND t.status='paid') revenue "
                                "FROM ledger_products p ORDER BY p.created")}

    def add_product(req):
        b = req.json()
        name = str(b["name"]).strip()[:120]
        if not name:
            raise ValueError("name required")
        pid = s.x("INSERT INTO ledger_products(name,price,venture,created) VALUES(?,?,?,?)",
                  (name, float(b.get("price", 0)), _venture(b.get("venture")), time.time()))
        k.emit("ledger.changed", {}, "tablet")
        return {"id": pid}

    def txs(req):
        lim = max(1, min(500, int(req.arg("limit", 100))))
        return {"transactions": s.q("SELECT * FROM ledger_tx ORDER BY ts DESC LIMIT ?", (lim,))}

    def add_tx(req):
        b = req.json()
        status = b.get("status", "paid")
        if status not in STATUSES:
            raise ValueError("status must be one of " + ", ".join(STATUSES))
        pid = b.get("product_id")
        prod = s.one("SELECT * FROM ledger_products WHERE id=?", (int(pid),)) if pid else None
        tid = s.x("INSERT INTO ledger_tx(ts,product_id,product,amount,status,source,customer,venture) VALUES(?,?,?,?,?,?,?,?)",
                  (float(b.get("ts") or time.time()), prod and prod["id"], (prod and prod["name"]) or str(b.get("product", ""))[:120],
                   float(b["amount"]), status, str(b.get("source", ""))[:80], str(b.get("customer", ""))[:80],
                   _venture(b.get("venture") or (prod and prod["venture"]))))
        k.emit("ledger.changed", {}, "tablet")
        return {"id": tid}

    def market(req):
        return {"market": s.q("SELECT * FROM market ORDER BY venture, metric")}

    k.route("GET", "/api/ledger/summary", lambda req: summary(s), role="tablet")
    k.route("GET", "/api/ledger/products", products, role="tablet")
    k.route("POST", "/api/ledger/products", add_product, role="owner")
    k.route("GET", "/api/ledger/transactions", txs, role="tablet")
    k.route("POST", "/api/ledger/transactions", add_tx, role="owner")
    k.route("GET", "/api/ledger/market", market, role="tablet")
