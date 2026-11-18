/* Demo data for the Arena / Oracle while the real Ledger is empty.
 *
 * - The numbers come from demo-data.json: a snapshot of a public mock-shop API (dummyjson.com), fetched ONCE and stored
 *   here. Nothing is requested at runtime.
 * - It only runs while the real Ledger has no products and no sales. The moment you log a real sale it steps aside.
 * - The pill in the top-right corner says DEMO; tap it to turn the demo off (it remembers, tap again to bring it back).
 * - The ticker changes numbers in memory and on screen only. It never writes anything to the Ledger or the server.
 */
(function () {
  'use strict';
  var KEY = 'beastDemo', data = null, timer = null, S = null;
  var SOURCES = ['Reddit', 'TikTok', 'Email list', 'Direct', 'Newsletter', 'YouTube'];

  function enabled() { try { return localStorage.getItem(KEY) !== 'off'; } catch (e) { return true; } }
  var seed = 11;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function hhmm(d) { return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }

  function makeTx(i, ts) {
    var p = pick(S.products), r = rnd();
    var status = r < 0.8 ? 'paid' : r < 0.95 ? 'abandoned' : 'refunded';
    return { tx: 'demo_' + i, time: hhmm(new Date(ts)), product: p.name, amount: p.price, status: status, source: pick(SOURCES), customer: 'cust_' + Math.floor(rnd() * 9000 + 1000), ts: ts };
  }
  function funnelOf(t) {
    var type = t.status === 'paid' ? 'SALE' : t.status === 'refunded' ? 'REFUND' : 'CART ABANDON';
    return { type: type, detail: t.product + ' — ' + t.source, amount: (t.status === 'refunded' ? '-$' : '$') + t.amount.toFixed(2), ts: t.ts };
  }

  function build() {
    S = { products: data.products.slice(0, 8) };
    var now = Date.now(), tx = [], i;
    for (i = 0; i < 40; i++) tx.push(makeTx(i, now - i * 23 * 60000));
    S.tx = tx; S.n = 40;
    S.arena = { leadVelocity: 47, conversionEfficiency: 3.4, customerLTV: 61.8, monthlyNetProfit: 8420, targetMonthly: 15000,
      growthData: [3200, 3650, 4100, 3900, 4800, 5300, 5900, 6100, 6800, 7300, 7900, 8420] };
    S.sales = S.products.map(function (p, k) { var n = 20 + Math.floor(rnd() * 180); return { id: 'D' + k, name: p.name, price: p.price, sales: n, revenue: Math.round(n * p.price * 100) / 100 }; });
  }

  function publish() {
    var H = window.HomeOS;
    H.setState({
      arena: S.arena, products: S.sales,
      transactions: S.tx.map(function (t) { return { tx: t.tx, time: t.time, product: t.product, amount: t.amount, status: t.status, source: t.source, customer: t.customer }; }),
      funnel: S.tx.slice(0, 10).map(funnelOf),
      oracle: { adSpend: 1200, convRate: S.arena.conversionEfficiency, ltv: S.arena.customerLTV }
    });
    H.refresh();
  }

  function setText(id, v) { var el = document.querySelector('[data-testid="' + id + '"]'); if (el) el.textContent = v; }
  function tick() {
    if (document.hidden) return;
    var st = window.HomeOS.getState();
    if (!st || !S) return;
    var t = makeTx(S.n++, Date.now()), a = S.arena;
    S.tx.unshift(t); if (S.tx.length > 60) S.tx.pop();
    if (t.status === 'paid') { a.monthlyNetProfit += Math.round(t.amount * 0.15); a.leadVelocity += 1; }
    a.conversionEfficiency = Math.max(1.5, Math.min(6, a.conversionEfficiency + (rnd() - 0.5) * 0.12));
    a.customerLTV = Math.max(30, a.customerLTV + (rnd() - 0.5) * 0.9);
    a.growthData[a.growthData.length - 1] = a.monthlyNetProfit;
    // live objects the Arena already reads (in memory only, nothing is saved)
    st.arena = a; st.funnel = S.tx.slice(0, 10).map(funnelOf);
    setText('kpi-val-lead-velocity', String(a.leadVelocity));
    setText('kpi-val-conversion-eff', a.conversionEfficiency.toFixed(1) + '%');
    setText('kpi-val-customer-ltv', '$' + a.customerLTV.toFixed(2));
    setText('kpi-val-net-profit', '$' + a.monthlyNetProfit.toLocaleString());
  }

  function pill(on) {
    var b = document.getElementById('demo-pill');
    if (!b) {
      b = document.createElement('button'); b.id = 'demo-pill'; b.type = 'button';
      b.style.cssText = 'position:fixed;bottom:46px;right:12px;z-index:9500;font:600 11px/1 monospace;letter-spacing:.14em;padding:6px 12px;border-radius:999px;border:1px solid #cc5500;background:rgba(34,34,36,.9);color:#ffb070;cursor:pointer';
      b.onclick = function () { try { localStorage.setItem(KEY, enabled() ? 'off' : 'on'); } catch (e) {} location.reload(); };
      document.body.appendChild(b);
    }
    b.textContent = on ? 'DEMO DATA · tap to turn off' : 'DEMO OFF · tap for demo';
  }

  // Called by beastos.js after it reads the real Ledger. Returns true when the demo has taken over.
  window.BeastDemo = {
    wants: function (txs, prods) { return enabled() && !(txs && txs.length) && !(prods && prods.length); },
    apply: function () {
      var go = function () { if (!S) build(); publish(); pill(true); clearInterval(timer); timer = setInterval(tick, 4500); };
      if (data) return go();
      fetch('./demo-data.json').then(function (r) { return r.json(); }).then(function (d) { data = d; go(); }).catch(function () {});
    },
    stop: function () { clearInterval(timer); timer = null; var b = document.getElementById('demo-pill'); if (b) b.remove(); }
  };
  document.addEventListener('DOMContentLoaded', function () { if (!enabled()) pill(false); });
})();
