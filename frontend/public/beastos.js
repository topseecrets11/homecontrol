/* Beast OS bridge: connects the Home OS shell (homeos.js, design frozen) to the
 * Beast OS kernel. It
 *  - keeps the shell state in sync across devices (kernel SQLite, not just this browser)
 *  - adds plug-in modules from /api/modules to the sidebar
 *  - feeds the Arena from the Ledger and the Node from the house, live over SSE
 *  - sends wellbeing check-ins to the Mood module
 */
(function () {
  'use strict';
  var KEY = 'homeOS';
  var pushTimer = null;
  var lastCheckIn = null;
  var me = null;
  var bootAt = Date.now();

  function api(path, opts) {
    opts = opts || {};
    opts.credentials = 'same-origin';
    if (opts.body && typeof opts.body !== 'string') {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = JSON.stringify(opts.body);
    }
    return fetch(path, opts).then(function (r) {
      if (r.status === 401) { location.href = '/pair'; throw new Error('unpaired'); }
      return r.json();
    });
  }

  function local() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }

  // ---- state sync -------------------------------------------------------
  function pull(cb) {
    var done = false;
    function finish() { if (!done) { done = true; cb(); } }
    setTimeout(finish, 2500);
    api('/api/homeos/state').then(function (j) {
      var srv = j && j.state, mine = local();
      if (srv && (!mine || (srv._savedAt || 0) > (mine._savedAt || 0))) {
        localStorage.setItem(KEY, JSON.stringify(srv));
      }
      var cur = local();
      lastCheckIn = cur && cur.wellbeing ? cur.wellbeing.lastCheckIn : null;
    }).catch(function () {}).then(finish);
  }

  function onState(next) {
    // Only a submitted check-in is a mood reading; "Skip for now" isn't logged.
    var w = next.wellbeing;
    if (w && w.lastCheckIn && w.lastCheckIn !== lastCheckIn && !w.skipped && Date.now() - bootAt > 1500) {
      lastCheckIn = w.lastCheckIn;
      api('/api/mood/checkin', { method: 'POST', body: {
        recovery: next.wellbeing.recovery, vitality: next.wellbeing.vitality, temper: next.wellbeing.temper
      } }).catch(function () {});
    }
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      api('/api/homeos/state', { method: 'PUT', body: { state: next } }).catch(function () {});
    }, 800);
  }

  // ---- plug-in modules --------------------------------------------------
  function frameModule(m) {
    var frame = null;
    return {
      title: m.tab.label || m.title.toUpperCase(),
      virgil: m.title + ' online.',
      mount: function () {
        var H = window.HomeOS.h;
        frame = H('iframe', { src: m.tab.src || ('/m/' + m.id + '/'), title: m.title,
          className: 'beastos-frame', 'data-testid': 'module-' + m.id,
          allow: 'microphone; fullscreen; clipboard-write' });
        return H('div', { className: 'module-container beastos-module' }, frame);
      },
      unmount: function () { if (frame) frame.src = 'about:blank'; frame = null; }
    };
  }

  function loadModules() {
    api('/api/modules').then(function (j) {
      (j.modules || []).filter(function (m) { return m.tab && !m.error; })
        .sort(function (a, b) { return (a.tab.order || 99) - (b.tab.order || 99); })
        .forEach(function (m) { window.HomeOS.register('MOD_' + m.id.toUpperCase(), frameModule(m)); });
    }).catch(function () {});
  }

  // ---- live data --------------------------------------------------------
  function hhmm(ts) { return ts * 1000; }

  function loadLedger() {
    Promise.all([api('/api/ledger/summary'), api('/api/ledger/products'), api('/api/ledger/transactions?limit=50')])
      .then(function (r) {
        var sum = r[0], prods = r[1].products || [], txs = r[2].transactions || [];
        if (window.BeastDemo && window.BeastDemo.wants(txs, prods)) { window.BeastDemo.apply(); return; }   // empty Ledger: show the demo
        if (window.BeastDemo) window.BeastDemo.stop();
        var all = sum.ventures || {};
        var conv = 0, ltv = 0, n = 0;
        Object.keys(all).forEach(function (v) { if (all[v].monthSales) { conv += all[v].conversion; ltv += all[v].ltv; n++; } });
        var weekAgo = Date.now() / 1000 - 7 * 86400;
        var st = window.HomeOS.getState() || {};
        var arena = Object.assign({}, st.arena || {}, {
          leadVelocity: txs.filter(function (t) { return t.ts >= weekAgo; }).length,
          conversionEfficiency: n ? conv / n : 0,
          customerLTV: n ? ltv / n : 0,
          monthlyNetProfit: (sum.total && sum.total.monthNet) || 0,
          growthData: (sum.total && sum.total.growth) || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        });
        window.HomeOS.setState({
          arena: arena,
          products: prods.map(function (p) { return { id: 'P' + p.id, name: p.name, price: p.price, sales: p.sales, revenue: p.revenue }; }),
          transactions: txs.map(function (t) {
            var d = new Date(t.ts * 1000);
            return { tx: 'tx_' + t.id, time: ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2),
              product: t.product, amount: t.amount, status: t.status, source: t.source || '', customer: t.customer || '' };
          }),
          funnel: txs.slice(0, 10).map(function (t) {
            var type = t.status === 'paid' ? 'SALE' : t.status === 'refunded' ? 'REFUND' : t.status === 'abandoned' ? 'CART ABANDON' : 'PENDING';
            var amt = (t.status === 'refunded' ? '-$' : '$') + Number(t.amount).toFixed(2);
            return { type: type, detail: (t.product || 'item') + (t.source ? ' — ' + t.source : ''), amount: amt, ts: hhmm(t.ts) };
          })
        });
        window.HomeOS.refresh();
      }).catch(function () {});
  }

  function applyHouse(S) {
    var st = window.HomeOS.getState() || {};
    var env = JSON.parse(JSON.stringify(st.environment || {}));
    var t0 = performance.now();
    env.network = { status: S.ha && S.ha.online ? 'ONLINE' : 'HA OFFLINE', latencyMs: null };
    var ents = (S.ha && S.ha.entities) || {};
    (env.devices || []).forEach(function (d) {
      if (d.entity && ents[d.entity]) d.state = ents[d.entity].state === 'on' ? 'on' : 'off';
    });
    api('/api/me').then(function () {
      env.network.latencyMs = Math.round(performance.now() - t0);
      window.HomeOS.setState({ environment: env });
      if ((window.HomeOS.getState() || {}).activeModule === 'NODE') window.HomeOS.refresh();
    }).catch(function () {});
  }

  function blob(name) { if (window.BeastBlob) window.BeastBlob.react(name); }

  function deviceToggle(d) {
    blob(d.state === 'on' ? 'lightOff' : 'lightOn');      // he clicks first, the light follows
    var domain = d.entity.split('.')[0];
    api('/api/action', { method: 'POST', body: { action: 'ha', domain: domain, service: 'toggle', data: { entity_id: d.entity } } })
      .catch(function () {});
  }

  function listen() {
    var es = new EventSource('/api/events');
    var lastHouse = 0, lights = null;
    es.onmessage = function (e) {
      var m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (window.BeastModes) window.BeastModes.onEvent(m);
      if (m.topic === 'beast.state') {
        // a light or switch changing anywhere in the house -> the blob reacts
        var ents = (m.data.ha && m.data.ha.entities) || {}, seen = {};
        Object.keys(ents).forEach(function (id) {
          if (!/^(light|switch)\./.test(id)) return;
          seen[id] = ents[id].state;
          if (lights && lights[id] && lights[id] !== ents[id].state) blob(ents[id].state === 'on' ? 'lightOn' : 'lightOff');
        });
        lights = seen;
      }
      if (m.topic === 'mood.checkin' && window.BeastBlob) {
        window.BeastBlob.setMood(m.data);
        blob(m.data.temper >= 6 ? 'cheer' : 'flinch');
      }
      if (m.topic === 'virgil.state') blob({ listening: 'listen', thinking: 'think', speaking: 'talk' }[m.data.state] || 'idle');
      if (m.topic === 'ledger.changed') { loadLedger(); blob('cheer'); }
      else if (m.topic === 'beast.state' && Date.now() - lastHouse > 20000) { lastHouse = Date.now(); applyHouse(m.data); }
      else if (m.topic === 'homeos.state' && m.data && m.data.by !== me) pull(function () { window.HomeOS.refresh(); });
    };
  }

  window.BeastOS = { pull: pull, onState: onState, deviceToggle: deviceToggle };

  function start() {
    if (!window.HomeOS) return setTimeout(start, 50);
    api('/api/me').then(function (j) { me = j.name; }).catch(function () {});
    if (window.BeastModes) window.BeastModes.start();
    loadModules();
    loadLedger();
    var st0 = window.HomeOS.getState() || {};
    if (window.BeastBlob) {
      if (st0.wellbeing) window.BeastBlob.setMood(st0.wellbeing);
      window.BeastBlob.schedule(st0.blob || { wake: '07:00', bed: '23:00' });
    }
    api('/api/state').then(function (j) { if (j.state) applyHouse(j.state); }).catch(function () {});
    listen();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 0); });
  else setTimeout(start, 0);
})();
