/* Beast OS modes: VAULT (everything), NORMAL (Abyss hidden + locked), GUEST
 * (house controls and the blob only; your work is hidden). Switching down is one
 * tap (someone walks in). Switching up needs your pattern. */
(function () {
  'use strict';
  var MODE = 'vault';
  var WORK = ['ARENA', 'SANCTUM', 'ORACLE'];        // original modules hidden from guests

  function api(path, body) {
    return fetch(path, { method: body ? 'POST' : 'GET', credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json(); });
  }

  // ---- pattern pad (same 4x4 grid as Abyss) ----
  function patternPad(title, cb) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.86);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font-family:JetBrains Mono,monospace;color:#d8e6d8';
    var h = document.createElement('div'); h.textContent = title; h.style.cssText = 'letter-spacing:.3em;font-size:13px;color:#ffd400';
    var cv = document.createElement('canvas'); var S = 280; cv.style.cssText = 'width:280px;height:280px;touch-action:none;border:1px solid rgba(255,212,0,.25);border-radius:16px';
    var d = Math.min(window.devicePixelRatio || 1, 2); cv.width = S * d; cv.height = S * d;
    var msg = document.createElement('div'); msg.style.cssText = 'min-height:1.2em;font-size:12px;color:#ff6b6b';
    var cancel = document.createElement('button'); cancel.textContent = 'Cancel';
    cancel.style.cssText = 'font:inherit;font-size:12px;padding:7px 12px;border-radius:8px;border:1px solid #333;background:#111;color:#d8e6d8;cursor:pointer';
    wrap.appendChild(h); wrap.appendChild(cv); wrap.appendChild(msg); wrap.appendChild(cancel);
    document.body.appendChild(wrap);
    var ctx = cv.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0);
    var dots = [], seq = [], drawing = false, cur = null, ghost = false, pad = S * 0.14, step = (S - 2 * pad) / 3;
    for (var y = 0; y < 4; y++) for (var x = 0; x < 4; x++) dots.push([pad + x * step, pad + y * step]);
    function draw() {
      ctx.clearRect(0, 0, S, S);
      if (seq.length && !ghost) { ctx.strokeStyle = 'rgba(255,212,0,.85)'; ctx.lineWidth = 4; ctx.lineCap = ctx.lineJoin = 'round'; ctx.beginPath();
        seq.forEach(function (i, k) { var p = dots[i]; k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
        if (drawing && cur) ctx.lineTo(cur[0], cur[1]); ctx.stroke(); }
      dots.forEach(function (p, i) { ctx.beginPath(); ctx.arc(p[0], p[1], !ghost && seq.indexOf(i) >= 0 ? 8 : 5, 0, 6.283);
        ctx.fillStyle = !ghost && seq.indexOf(i) >= 0 ? '#ffd400' : 'rgba(216,230,216,.35)'; ctx.fill(); });
    }
    function pt(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    function hit(p) { for (var i = 0; i < dots.length; i++) if (Math.hypot(dots[i][0] - p[0], dots[i][1] - p[1]) < 22 && seq.indexOf(i) < 0) return i; return -1; }
    cv.onpointerdown = function (e) { drawing = true; seq = []; ghost = false; msg.textContent = ''; cv.setPointerCapture(e.pointerId); var i = hit(pt(e)); if (i >= 0) seq.push(i); draw(); };
    cv.onpointermove = function (e) {
      if (!drawing) return; cur = pt(e); var i = hit(cur); if (i >= 0) seq.push(i);
      // more than one grid space past the last dot: the trail vanishes (still recorded)
      if (seq.length) { var l = dots[seq[seq.length - 1]]; if (Math.max(Math.abs(cur[0] - l[0]), Math.abs(cur[1] - l[1])) > step) ghost = true; }
      draw();
    };
    cv.onpointerup = function () {
      drawing = false; cur = null; var p = seq.slice(); seq = []; ghost = false; draw();   // nothing stays on the grid
      if (p.length) cb(p, function (err) { if (err) msg.textContent = err; else close(); });
    };
    function close() { wrap.remove(); }
    cancel.onclick = close;
    draw();
  }

  function setMode(m) {
    var rank = { guest: 0, normal: 1, vault: 2 };
    if (rank[m] <= rank[MODE]) {
      return api('/api/mode', { mode: m }).then(function (j) { if (!j.ok) alert(j.error); });
    }
    patternPad(m.toUpperCase() + ' MODE · DRAW YOUR PATTERN', function (p, done) {
      api('/api/mode', { mode: m, pattern: p }).then(function (j) {
        if (j.ok) done(); else done(j.error || 'not that one');
      });
    });
  }

  function pill() {
    var host = document.querySelector('.hdr-right');
    if (!host || document.getElementById('mode-pill')) return;
    var b = document.createElement('button');
    b.id = 'mode-pill';
    b.style.cssText = 'margin-right:14px;font:inherit;font-size:10px;letter-spacing:.2em;padding:4px 10px;border-radius:999px;cursor:pointer;background:transparent;' +
      (MODE === 'vault' ? 'border:1px solid #ffd400;color:#ffd400' : MODE === 'normal' ? 'border:1px solid #555;color:#aaa' : 'border:1px solid #32cd32;color:#32cd32');
    b.textContent = MODE.toUpperCase();
    b.title = 'Vault: everything · Normal: Abyss hidden · Guest: house + blob only';
    b.onclick = function () {
      var menu = document.createElement('div');
      menu.style.cssText = 'position:fixed;top:44px;right:90px;z-index:10000;background:#111;border:1px solid #333;border-radius:10px;padding:6px;display:flex;flex-direction:column;gap:4px;font-family:JetBrains Mono,monospace';
      [['vault', 'VAULT · everything'], ['normal', 'NORMAL · no Abyss'], ['guest', 'GUEST · house + blob']].forEach(function (o) {
        var x = document.createElement('button'); x.textContent = (o[0] === MODE ? '● ' : '○ ') + o[1];
        x.style.cssText = 'font:inherit;font-size:11px;text-align:left;padding:7px 10px;border:0;border-radius:6px;background:transparent;color:#d8e6d8;cursor:pointer';
        x.onmouseenter = function () { x.style.background = '#1d1d1d'; }; x.onmouseleave = function () { x.style.background = 'transparent'; };
        x.onclick = function () { menu.remove(); if (o[0] !== MODE) setMode(o[0]); };
        menu.appendChild(x);
      });
      document.body.appendChild(menu);
      setTimeout(function () { document.addEventListener('click', function off(e) { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', off); } }); }, 0);
    };
    host.insertBefore(b, host.firstChild);
  }

  function applyGuest() {
    if (MODE !== 'guest') return;
    WORK.forEach(function (m) { var b = document.querySelector('.nav-btn[data-module="' + m + '"]'); if (b) b.style.display = 'none'; });
    var s = document.getElementById('settings-btn'); if (s) s.style.display = 'none';
    var st = window.HomeOS && window.HomeOS.getState();
    if (st && WORK.indexOf(st.activeModule) >= 0) window.HomeOS.navigate('NODE');
  }

  window.BeastModes = {
    get mode() { return MODE; },
    start: function () {
      api('/api/mode').then(function (j) { MODE = j.mode || 'vault'; document.documentElement.dataset.mode = MODE; pill(); applyGuest(); });
    },
    onEvent: function (m) { if (m.topic === 'mode' && m.data.mode !== MODE) location.reload(); }
  };
})();
