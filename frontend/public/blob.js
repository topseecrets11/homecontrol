/* The blob: a soft-body goo character that lives in the corner of Beast OS.
 *
 * Physics: a ring of points with neighbour springs, shape-matching toward a
 * target pose (dome, puddle, tall, squash) and a floor. Gestures add forces
 * (an arm reaching up to click at the ceiling, a hop, a splat), so every move
 * jiggles for real. Canvas 2D, transparent, ~0.3 ms per frame.
 *
 *   BeastBlob.react('lightOn' | 'lightOff' | 'cheer' | 'poke' | 'wake' | 'sleep' |
 *                   'listen' | 'think' | 'talk' | 'idle' | 'flinch')
 *   BeastBlob.setMood({ temper, vitality, recovery })     0..10
 *   BeastBlob.setLevel(0..1)                              voice level while talking/listening
 *   BeastBlob.schedule({ wake: '07:00', bed: '23:00' })
 */
(function () {
  'use strict';
  if (window.BeastBlob) return;

  // The goo character is retired (off everywhere). To bring him back on one device, open the shell once with ?blob=on.
  var pref = (/[?&]blob=(on|off)/.exec(location.search) || [])[1];
  try { if (pref) localStorage.setItem('beastBlob', pref); else pref = localStorage.getItem('beastBlob'); } catch (e) {}
  var wanted = pref === 'on';                        // retired: off on every device. ?blob=on brings him back
  if (!wanted) {
    var nop = function () {};
    window.BeastBlob = { react: nop, setMood: nop, setLevel: nop, schedule: nop, get state() { return { state: 'off' }; } };
    return;
  }

  var W = 240, H = 280, BASE = H - 26, N = 48;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var TAU = Math.PI * 2;

  // ---- poses: w = width, ht = height above the waist, hb = below
  var POSE = {
    dome:   { w: 112, ht: 74, hb: 20 },
    puddle: { w: 176, ht: 14, hb: 7 },
    tall:   { w: 78,  ht: 132, hb: 20 },
    squash: { w: 146, ht: 42, hb: 15 },
    lean:   { w: 104, ht: 82, hb: 20 }
  };

  var cv, ctx, light;
  var P = [], V = [];
  var S = { w: 112, ht: 74, hb: 20 }, Sv = { w: 0, ht: 0, hb: 0 }, target = POSE.dome;
  var cx = W / 2, cxT = W / 2;
  var arm = { amt: 0, vel: 0, goal: 0, side: 1 };
  var mood = { temper: 6, vitality: 5, recovery: 6 };
  var hue = 0.27, hueGoal = 0.27;
  var level = 0, levelGoal = 0;
  var state = 'awake';          // awake | asleep
  var expr = 'calm';            // calm | happy | angry | yawn | squeeze | focus
  var exprUntil = 0;
  var blinkAt = 0, blinkT = 0;
  var lookX = 0, lookY = 0;
  var zs = [], puffs = [], sparks = [];
  var bubbles = [];
  var timeline = [];             // scheduled gesture steps: {at, fn}
  var sched = { wake: '07:00', bed: '23:00' };
  var lastT = 0, lastDraw = 0, activeUntil = 0;

  function now() { return performance.now(); }
  function busy(ms) { activeUntil = Math.max(activeUntil, now() + (ms || 2500)); }
  function later(ms, fn) { timeline.push({ at: now() + ms, fn: fn }); busy(ms + 1500); }

  // ---------------------------------------------------------------- setup
  function mount() {
    cv = document.createElement('canvas');
    cv.id = 'beast-blob';
    cv.width = W * DPR; cv.height = H * DPR;
    cv.style.cssText = 'position:fixed;right:14px;bottom:44px;width:' + W + 'px;height:' + H +
      'px;z-index:9000;pointer-events:none;background:transparent';
    ctx = cv.getContext('2d');
    light = document.createElement('div');
    light.style.cssText = 'position:fixed;inset:0;z-index:8999;pointer-events:none;opacity:0;transition:opacity .25s;';
    document.body.appendChild(light);
    document.body.appendChild(cv);
    for (var i = 0; i < N; i++) {
      var t = targetPoint(i);
      P.push([t[0], t[1]]); V.push([0, 0]);
    }
    for (var b = 0; b < 6; b++) bubbles.push({ a: Math.random() * TAU, r: Math.random(), s: 0.6 + Math.random(), z: 1 + Math.random() * 2.5 });
    document.addEventListener('pointerdown', onPoke, true);
    document.addEventListener('pointermove', function (e) {
      var r = cv.getBoundingClientRect();
      lookX = Math.max(-1, Math.min(1, (e.clientX - (r.left + cx)) / 400));
      lookY = Math.max(-1, Math.min(1, (e.clientY - (r.top + BASE - 60)) / 300));
    }, { passive: true });
    applySchedule(true);
    requestAnimationFrame(frame);
  }

  function targetPoint(i) {
    var a = i / N * TAU, s = Math.sin(a), c = Math.cos(a);
    var oy = s >= 0 ? s * S.hb : s * S.ht;
    // round shoulders, flatter belly on the floor
    var ox = c * S.w / 2 * (s < 0 ? 1 - 0.12 * Math.pow(-s, 3) : 1 + 0.06 * s);
    return [cx + ox, BASE - S.hb + oy];
  }

  // ---------------------------------------------------------------- physics
  function step(dt) {
    // pose spring (overshoots a little, which is the goo)
    ['w', 'ht', 'hb'].forEach(function (k) {
      var a = (target[k] - S[k]) * 38 - Sv[k] * 7.5;
      Sv[k] += a * dt; S[k] += Sv[k] * dt;
    });
    cx += (cxT - cx) * Math.min(1, dt * 3);
    // arm (a pseudopod reaching for the ceiling)
    var aa = (arm.goal - arm.amt) * 140 - arm.vel * 14;
    arm.vel += aa * dt; arm.amt += arm.vel * dt;
    level += (levelGoal - level) * Math.min(1, dt * 14);

    var angry = expr === 'angry';
    var wob = 18 + mood.vitality * 5 + (angry ? 60 : 0);
    var t = now() / 1000;
    for (var i = 0; i < N; i++) {
      var g = targetPoint(i), p = P[i], v = V[i];
      var a = i / N * TAU;
      // arm: points near the upper-right lift and stretch
      var armCenter = arm.side > 0 ? -Math.PI / 3 : -2 * Math.PI / 3;
      var d = Math.atan2(Math.sin(a - armCenter), Math.cos(a - armCenter));
      var fall = Math.exp(-d * d / 0.035);
      g[0] += arm.side * arm.amt * 22 * fall;
      g[1] -= arm.amt * 150 * fall;
      // breathing + talking
      var breathe = state === 'asleep' ? 1.5 : 2.2;
      g[1] -= Math.sin(t * breathe) * (state === 'asleep' ? 1.2 : 2.5) * Math.max(0, -Math.sin(a));
      g[0] += Math.cos(a) * level * 10; g[1] -= Math.max(0, -Math.sin(a)) * level * 14;
      // shape matching + neighbour smoothing
      var kx = (g[0] - p[0]) * 70, ky = (g[1] - p[1]) * 70;
      var prev = P[(i + N - 1) % N], next = P[(i + 1) % N];
      kx += ((prev[0] + next[0]) / 2 - p[0]) * 160;
      ky += ((prev[1] + next[1]) / 2 - p[1]) * 160;
      // living wobble, and shaking when angry
      kx += Math.sin(t * 3.1 + i * 0.7) * wob * 0.3 + (angry ? (Math.random() - 0.5) * 900 : 0);
      ky += Math.cos(t * 2.3 + i * 1.3) * wob * 0.3;
      v[0] = (v[0] + kx * dt) * Math.pow(0.02, dt);
      v[1] = (v[1] + ky * dt) * Math.pow(0.02, dt);
      p[0] += v[0] * dt; p[1] += v[1] * dt;
      if (p[1] > BASE) { p[1] = BASE; v[1] *= -0.15; v[0] *= 0.85; }
      if (p[0] < 6) p[0] = 6; if (p[0] > W - 6) p[0] = W - 6;
      if (p[1] < 8) p[1] = 8;
    }
    hue += (hueGoal - hue) * Math.min(1, dt * 2);
  }

  function impulse(fy, fxSpread) {
    for (var i = 0; i < N; i++) {
      var s = Math.sin(i / N * TAU);
      V[i][1] += fy * (s < 0 ? -s : 0.3);
      V[i][0] += (fxSpread || 0) * Math.cos(i / N * TAU);
    }
  }

  // ---------------------------------------------------------------- look
  function moodHue() {
    if (mood.temper <= 3) return 0.0;                          // red when he's fuming
    if (mood.temper < 7) return 0.62 + (0.27 - 0.62) * (mood.temper - 3) / 4;  // blue -> goo green
    return 0.27 + (0.13 - 0.27) * (mood.temper - 7) / 3;       // goo green -> gold
  }
  function hsl(h, s, l, a) { return 'hsla(' + Math.round(h * 360) + ',' + s + '%,' + l + '%,' + a + ')'; }

  function bodyPath() {
    ctx.beginPath();
    for (var i = 0; i <= N; i++) {
      var p = P[i % N], q = P[(i + 1) % N];
      var mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      if (i === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(p[0], p[1], mx, my);
    }
    ctx.closePath();
  }

  function bounds() {
    var minX = 1e9, maxX = -1e9, minY = 1e9, sx = 0, sy = 0;
    for (var i = 0; i < N; i++) {
      var p = P[i]; sx += p[0]; sy += p[1];
      if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minY) minY = p[1];
    }
    return { cx: sx / N, cy: sy / N, minX: minX, maxX: maxX, top: minY, w: maxX - minX };
  }

  function draw() {
    var t = now() / 1000;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var b = bounds();
    var h = hue, angry = expr === 'angry';

    // floor shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(b.cx, BASE + 4, b.w * 0.55, 6, 0, 0, TAU); ctx.fill();

    // body: translucent goo with a lit top and darker core
    bodyPath();
    var g = ctx.createLinearGradient(0, b.top, 0, BASE);
    g.addColorStop(0, hsl(h, 92, angry ? 58 : 66, 0.92));
    g.addColorStop(0.55, hsl(h, 88, angry ? 42 : 48, 0.86));
    g.addColorStop(1, hsl(h, 85, angry ? 26 : 30, 0.9));
    ctx.fillStyle = g;
    ctx.shadowColor = hsl(h, 100, 55, 0.55); ctx.shadowBlur = 18 + level * 20;
    ctx.fill(); ctx.shadowBlur = 0;

    // insides: drifting bubbles + inner glow, clipped to the body
    ctx.save(); bodyPath(); ctx.clip();
    var ig = ctx.createRadialGradient(b.cx, b.cy + 6, 2, b.cx, b.cy, b.w * 0.6);
    ig.addColorStop(0, hsl(h, 100, 80, 0.28 + level * 0.3)); ig.addColorStop(1, hsl(h, 100, 50, 0));
    ctx.fillStyle = ig; ctx.fillRect(0, 0, W, H);
    bubbles.forEach(function (u) {
      var yy = BASE - ((t * 9 * u.s + u.r * 200) % Math.max(20, BASE - b.top));
      var xx = b.cx + Math.sin(t * 0.8 * u.s + u.a) * b.w * 0.3;
      ctx.beginPath(); ctx.arc(xx, yy, u.z, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill();
    });
    ctx.restore();

    // rim + specular
    bodyPath(); ctx.lineWidth = 1.4; ctx.strokeStyle = hsl(h, 100, 85, 0.35); ctx.stroke();
    ctx.save(); ctx.globalAlpha = 0.55;
    var sg = ctx.createRadialGradient(b.cx - b.w * 0.2, b.top + 12, 1, b.cx - b.w * 0.2, b.top + 12, b.w * 0.28);
    sg.addColorStop(0, 'rgba(255,255,255,0.9)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(b.cx - b.w * 0.2, b.top + 13, b.w * 0.2, 9, -0.35, 0, TAU); ctx.fill();
    ctx.restore();

    face(b, t);
    effects(t);
  }

  function face(b, t) {
    var hgt = BASE - b.top;
    var ey = b.top + Math.max(10, hgt * 0.36), ex = Math.max(10, Math.min(24, b.w * 0.18));
    var fx = b.cx + lookX * 4;
    var asleep = state === 'asleep';
    var blink = t * 1000 < blinkT ? 1 : 0;
    if (t * 1000 > blinkAt) { blinkAt = t * 1000 + 2500 + Math.random() * 4000; blinkT = t * 1000 + 130; }
    var squint = expr === 'squeeze' || expr === 'happy';
    [-1, 1].forEach(function (sd) {
      var x = fx + sd * ex, y = ey + lookY * 3;
      if (asleep || blink || squint) {
        ctx.strokeStyle = 'rgba(10,20,10,0.75)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath();
        if (squint && !asleep) ctx.arc(x, y + 2, 5, Math.PI * 1.15, Math.PI * 1.85);
        else ctx.arc(x, y - 2, 5, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
        return;
      }
      var r = expr === 'focus' ? 7.5 : expr === 'yawn' ? 4 : 6.5;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath(); ctx.ellipse(x, y, r * (expr === 'angry' ? 1 : 0.85), expr === 'angry' ? r * 0.6 : r, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(8,12,10,0.95)';
      ctx.beginPath(); ctx.arc(x + lookX * 2.2, y + lookY * 1.8 + (expr === 'angry' ? 1 : 0), r * 0.45, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(x + lookX * 2.2 - 1.3, y + lookY * 1.8 - 1.6, 1.2, 0, TAU); ctx.fill();
      if (expr === 'angry') {            // brows down at the middle
        ctx.strokeStyle = 'rgba(20,0,0,0.85)'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - sd * 8, y - 11); ctx.lineTo(x + sd * 3, y - 6); ctx.stroke();
      }
    });
    // mouth only when it means something
    var my = ey + Math.max(9, hgt * 0.2);
    ctx.strokeStyle = 'rgba(10,20,10,0.7)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    if (expr === 'happy') { ctx.beginPath(); ctx.arc(fx, my - 3, 7, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
    else if (expr === 'yawn') { ctx.fillStyle = 'rgba(10,20,10,0.6)'; ctx.beginPath(); ctx.ellipse(fx, my, 5, 7 + Math.sin(t * 3) * 2, 0, 0, TAU); ctx.fill(); }
    else if (expr === 'angry') { ctx.beginPath(); ctx.moveTo(fx - 7, my + 1); ctx.lineTo(fx + 7, my - 1); ctx.stroke(); }
    else if (level > 0.15 && state !== 'asleep') { ctx.fillStyle = 'rgba(10,20,10,0.55)'; ctx.beginPath(); ctx.ellipse(fx, my, 4, 1 + level * 6, 0, 0, TAU); ctx.fill(); }
  }

  function effects(t) {
    var b = bounds();
    // Z's while asleep (letters, not emoji)
    if (state === 'asleep' && (!zs.length || t - zs[zs.length - 1].t0 > 1.7)) zs.push({ t0: t, x: b.cx + 18, y: b.top - 4 });
    zs = zs.filter(function (z) { return t - z.t0 < 3.4; });
    zs.forEach(function (z) {
      var k = (t - z.t0) / 3.4;
      ctx.fillStyle = 'rgba(220,235,220,' + (0.75 * (1 - k)) + ')';
      ctx.font = (10 + k * 12) + 'px "JetBrains Mono", monospace';
      ctx.fillText('z', z.x + Math.sin(k * 6) * 6 + k * 20, z.y - k * 70);
    });
    // steam when angry
    if (expr === 'angry' && Math.random() < 0.15) puffs.push({ t0: t, x: b.cx + (Math.random() - 0.5) * b.w * 0.4, y: b.top });
    puffs = puffs.filter(function (p) { return t - p.t0 < 1.2; });
    puffs.forEach(function (p) {
      var k = (t - p.t0) / 1.2;
      ctx.fillStyle = 'rgba(200,200,200,' + 0.35 * (1 - k) + ')';
      ctx.beginPath(); ctx.arc(p.x + Math.sin(k * 8) * 4, p.y - k * 40, 3 + k * 7, 0, TAU); ctx.fill();
    });
    // finger-click sparks at the arm tip
    sparks = sparks.filter(function (s) { return t - s.t0 < 0.5; });
    sparks.forEach(function (s) {
      var k = (t - s.t0) / 0.5;
      ctx.strokeStyle = 'rgba(255,240,180,' + (1 - k) + ')'; ctx.lineWidth = 2;
      for (var j = 0; j < 6; j++) {
        var a = j / 6 * TAU + 0.3, r1 = 4 + k * 10, r2 = 9 + k * 20;
        ctx.beginPath(); ctx.moveTo(s.x + Math.cos(a) * r1, s.y + Math.sin(a) * r1); ctx.lineTo(s.x + Math.cos(a) * r2, s.y + Math.sin(a) * r2); ctx.stroke();
      }
    });
  }

  function armTip() {
    var best = P[0];
    for (var i = 0; i < N; i++) if (P[i][1] < best[1]) best = P[i];
    return best;
  }

  function roomLight(on) {
    light.style.background = on
      ? 'radial-gradient(ellipse at 50% -10%, rgba(255,236,170,0.55), rgba(255,236,170,0.12) 45%, transparent 75%)'
      : 'radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.6) 90%)';
    light.style.opacity = '1';
    setTimeout(function () { light.style.transition = 'opacity 1.4s'; light.style.opacity = '0'; }, on ? 380 : 600);
    setTimeout(function () { light.style.transition = 'opacity .25s'; }, 2200);
  }

  // ---------------------------------------------------------------- gestures
  function setExpr(e, ms) { expr = e; exprUntil = ms ? now() + ms : 0; busy(ms || 2000); }
  function baseExpr() { return mood.temper <= 3 ? 'angry' : 'calm'; }

  var REACT = {
    lightOn: function () {
      if (state === 'asleep') { REACT.wake(); later(2600, REACT.lightOn); return; }
      arm.side = 1; arm.goal = 1; target = POSE.lean; setExpr('focus', 1300);
      later(560, function () {                         // the click
        var tip = armTip(); sparks.push({ t0: now() / 1000, x: tip[0], y: tip[1] });
        roomLight(true); arm.vel -= 6;
      });
      later(900, function () { arm.goal = 0; target = POSE.dome; setExpr('happy', 1400); impulse(-140); });
    },
    lightOff: function () {
      arm.side = -1; arm.goal = 0.8; target = POSE.lean; setExpr('focus', 1000);
      later(500, function () { var tip = armTip(); sparks.push({ t0: now() / 1000, x: tip[0], y: tip[1] }); roomLight(false); });
      later(800, function () { arm.goal = 0; target = POSE.dome; setExpr(baseExpr()); });
    },
    cheer: function () {
      if (state === 'asleep') return;
      target = POSE.squash; setExpr('happy', 1800);
      later(160, function () { target = POSE.tall; impulse(-520); });
      later(520, function () { target = POSE.squash; });
      later(760, function () { target = POSE.dome; });
    },
    poke: function () {
      if (state === 'asleep') {                        // one grumpy eye, then back to sleep
        setExpr('squeeze', 600); impulse(-120, 40); return;
      }
      target = POSE.squash; setExpr('squeeze', 700); impulse(160, 120);
      later(220, function () { target = POSE.dome; });
    },
    flinch: function () { impulse(-260, -60); setExpr('focus', 800); },
    wake: function () {
      if (state !== 'asleep') return;
      state = 'awake'; zs = [];
      target = POSE.puddle; setExpr('yawn', 1800);
      later(400, function () { target = POSE.tall; impulse(-380); });      // the big stretch up
      later(1300, function () { arm.side = 1; arm.goal = 0.6; });
      later(1700, function () { arm.goal = 0; target = POSE.dome; });
      later(2100, function () { setExpr(baseExpr()); });
    },
    sleep: function () {
      if (state === 'asleep') return;
      setExpr('yawn', 1200); target = POSE.tall;
      later(900, function () { target = POSE.puddle; impulse(700, 160); });   // blomp
      later(1200, function () { state = 'asleep'; setExpr('calm'); });
    },
    listen: function () { if (state === 'asleep') REACT.wake(); setExpr('focus', 0); target = POSE.lean; },
    think: function () { setExpr('focus', 0); target = POSE.dome; },
    talk: function () { setExpr('calm', 0); target = POSE.dome; },
    idle: function () { levelGoal = 0; target = state === 'asleep' ? POSE.puddle : POSE.dome; setExpr(baseExpr()); }
  };

  function onPoke(e) {
    if (!cv) return;
    var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (x < 0 || y < 0 || x > W || y > H) return;
    bodyPath();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (ctx.isPointInPath(x * DPR, y * DPR)) REACT.poke();
  }

  // ---------------------------------------------------------------- day / night
  function mins(hhmm) { var p = hhmm.split(':'); return +p[0] * 60 + +p[1]; }
  function shouldSleep() {
    var d = new Date(), m = d.getHours() * 60 + d.getMinutes(), w = mins(sched.wake), bd = mins(sched.bed);
    return bd > w ? (m >= bd || m < w) : (m >= bd && m < w);
  }
  function applySchedule(instant) {
    var s = shouldSleep();
    if (s && state !== 'asleep') {
      if (instant) { state = 'asleep'; target = POSE.puddle; S = { w: POSE.puddle.w, ht: POSE.puddle.ht, hb: POSE.puddle.hb }; }
      else REACT.sleep();
    } else if (!s && state === 'asleep') REACT.wake();
  }
  setInterval(function () { if (cv) applySchedule(false); }, 30000);

  // ---------------------------------------------------------------- loop
  function frame(ts) {
    requestAnimationFrame(frame);
    if (document.hidden) { lastT = ts; return; }
    var active = ts < activeUntil || level > 0.02 || expr === 'angry';
    var gap = active ? 16 : 40;                       // ~60 fps when moving, 25 fps resting
    if (ts - lastDraw < gap) return;
    var dt = Math.min(0.05, (ts - (lastT || ts)) / 1000); lastT = ts; lastDraw = ts;
    for (var i = timeline.length - 1; i >= 0; i--) if (timeline[i].at <= ts) { var f = timeline[i].fn; timeline.splice(i, 1); f(); }
    if (exprUntil && ts > exprUntil) { exprUntil = 0; expr = baseExpr(); }
    var sub = 2;
    for (var s = 0; s < sub; s++) step(dt / sub);
    draw();
  }

  window.BeastBlob = {
    react: function (name) { if (REACT[name]) { busy(); REACT[name](); } },
    setMood: function (m) {
      if (!m) return;
      mood.temper = +m.temper || 0; mood.vitality = +m.vitality || 0; mood.recovery = +m.recovery || 0;
      hueGoal = moodHue();
      if (!exprUntil) expr = baseExpr();
      busy(2000);
    },
    setLevel: function (l) { levelGoal = Math.max(0, Math.min(1, l || 0)); if (l) busy(500); },
    schedule: function (s) { sched.wake = s.wake || sched.wake; sched.bed = s.bed || sched.bed; applySchedule(false); },
    get state() { return { state: state, expr: expr, hue: hue, mood: mood }; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
