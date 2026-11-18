"use strict";
/* Beast OS front end. Vanilla JS, no build step. State arrives over SSE from the hub. */

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- icons (stroke, 24 grid)
const P = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  play: "M7 4l13 8-13 8z",
  pause: "M7 4h4v16H7zM13 4h4v16h-4z",
  next: "M5 4l10 8-10 8zM19 4v16",
  prev: "M19 4L9 12l10 8zM5 4v16",
  stop: "M6 6h12v12H6z",
  speaker: "M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 010 6M19 6a8 8 0 010 12",
  mute: "M4 9v6h4l5 4V5L8 9zM22 9l-6 6M16 9l6 6",
  rooms: "M3 21V8l9-5 9 5v13M9 21v-6h6v6",
  cam: "M3 7h12v10H3zM15 10l6-3v10l-6-3",
  bot: "M12 3v3M6 8h12a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7a2 2 0 012-2zM9 13h.01M15 13h.01M9 17h6",
  media: "M4 5h16v14H4zM10 9l5 3-5 3z",
  film: "M4 4h16v16H4zM8 4v16M16 4v16M4 9h4M4 15h4M16 9h4M16 15h4",
  music: "M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z",
  moon: "M21 13A9 9 0 1111 3a7 7 0 0010 10z",
  power: "M12 2v10M6.3 6.3a8 8 0 1011.4 0",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  mic: "M12 3a3 3 0 013 3v6a3 3 0 01-6 0V6a3 3 0 013-3zM5 11a7 7 0 0014 0M12 18v3",
  up: "M6 15l6-6 6 6", down: "M6 9l6 6 6-6", left: "M15 6l-6 6 6 6", right: "M9 6l6 6-6 6",
  back: "M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3",
  wake: "M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8",
  move: "M5 12h14M13 6l6 6-6 6",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0012 3z",
  volup: "M4 9v6h4l5 4V5L8 9zM17 12h5M19.5 9.5v5", voldn: "M4 9v6h4l5 4V5L8 9zM17 12h5",
};
const ico = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${P[n] || P.bolt}"/></svg>`;

// ---------- state + api
let S = null;
let view = "home";
let dragging = false;
const ROOM = localStorage.getItem("beast.room") || "lounge";

async function act(payload, okMsg) {
  try {
    const r = await fetch("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "failed");
    if (okMsg) toast(okMsg);
    return j;
  } catch (e) { toast(e.message, true); throw e; }
}

let toastT;
function toast(msg, err) {
  const t = $("#toast");
  t.textContent = msg; t.className = "show" + (err ? " err" : "");
  clearTimeout(toastT); toastT = setTimeout(() => (t.className = ""), 2600);
}

function connect() {
  fetch("/api/state").then((r) => r.json()).then((j) => { if (j.ok && j.state) { S = j.state; if (!dragging) render(); } }).catch(() => {});
  const es = new EventSource("/api/events");
  let alive = setTimeout(() => $("#offline").classList.add("show"), 5000);
  es.onmessage = (e) => {
    clearTimeout(alive);
    alive = setTimeout(() => $("#offline").classList.add("show"), 35000);
    $("#offline").classList.remove("show");
    const m = JSON.parse(e.data);
    if (m.topic !== "beast.state") return;
    S = m.data;
    if (!dragging) render();
  };
  es.onerror = () => { $("#offline").classList.add("show"); };
}

// ---------- dock / navigation
const VIEWS = [["home", "Home", "home"], ["media", "Media", "media"], ["audio", "Audio", "speaker"],
               ["rooms", "Rooms", "rooms"], ["cams", "Cams", "cam"], ["hermes", "Hermes", "bot"]];
$("#dock").innerHTML = VIEWS.map(([id, label, i]) => `<button data-go="${esc(id)}">${ico(i)}${label}</button>`).join("");
function go(v) {
  view = v;
  document.querySelectorAll(".view").forEach((el) => el.classList.toggle("active", el.dataset.view === v));
  document.querySelectorAll("#dock button").forEach((b) => b.classList.toggle("on", b.dataset.go === v));
  if (S) render();
}
$("#dock").addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b) go(b.dataset.go); });
go("home");

// ---------- clock
function tick() {
  const d = new Date();
  const hm = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  $("#clock").textContent = hm; $("#clock-mini").textContent = hm;
  $("#date").textContent = d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
}
tick(); setInterval(tick, 10000);

// ---------- render
function render() {
  renderChips();
  if (view === "home") renderHome();
  if (view === "media") renderMedia();
  if (view === "audio") renderAudio();
  if (view === "rooms") renderRooms();
  if (view === "cams") renderCams();
}

function renderChips() {
  const dev = (id) => S.devices.find((d) => d.id === id);
  const chips = [["BEAST", true], ["HORIZON", dev("eh")?.online], ["HA", S.ha.online && S.ha.configured], ["HERMES", S.hermes.configured]];
  $("#chips").innerHTML = chips.map(([n, on]) => `<span class="chip ${on ? "on" : ""}">${esc(n)}</span>`).join("");
}

// all "now playing" things: HA media players + Jellyfin sessions
function players() {
  const out = [];
  for (const [id, e] of Object.entries(S.ha.entities || {})) {
    if (!id.startsWith("media_player.")) continue;
    out.push({ kind: "ha", id, name: e.name, state: e.state, title: e.title, sub: e.artist || e.app || e.source,
               picture: e.picture, volume: e.volume, sources: e.sources, source: e.source, sound_modes: e.sound_modes, sound_mode: e.sound_mode });
  }
  for (const s of S.jellyfin.sessions || []) {
    out.push({ kind: "jf", id: s.id, name: s.device, state: s.item ? (s.paused ? "paused" : "playing") : "idle",
               title: s.item?.series ? `${s.item.series} · ${s.item.name}` : s.item?.name, sub: s.item?.artist || s.client,
               picture: s.item?.picture, pos: s.position, len: s.item?.runtime });
  }
  return out;
}
const imgUrl = (src) => (src ? `/api/img?src=${encodeURIComponent(src)}` : "");

function npCard(p, full) {
  const live = p.state === "playing";
  const art = p.picture ? `style="background-image:url('${imgUrl(p.picture)}')"` : "";
  const ctrl = p.kind === "ha"
    ? `<button class="btn" data-media="${esc(p.id)}" data-cmd="media_previous_track">${ico("prev")}</button>
       <button class="btn hot wide" data-media="${esc(p.id)}" data-cmd="media_play_pause">${ico(live ? "pause" : "play")}</button>
       <button class="btn" data-media="${esc(p.id)}" data-cmd="media_next_track">${ico("next")}</button>
       <button class="btn" data-media="${esc(p.id)}" data-cmd="turn_off">${ico("power")}</button>`
    : `<button class="btn" data-jf="${esc(p.id)}" data-cmd="PreviousTrack">${ico("prev")}</button>
       <button class="btn hot wide" data-jf="${esc(p.id)}" data-cmd="PlayPause">${ico(live ? "pause" : "play")}</button>
       <button class="btn" data-jf="${esc(p.id)}" data-cmd="NextTrack">${ico("next")}</button>
       <button class="btn" data-jf="${esc(p.id)}" data-cmd="Stop">${ico("stop")}</button>`;
  let extra = "";
  if (full && p.kind === "ha" && p.volume != null) {
    extra += `<input type="range" min="0" max="100" value="${Math.round(p.volume * 100)}" data-havol="${esc(p.id)}" style="--p:${Math.round(p.volume * 100)}%">`;
  }
  if (full && p.kind === "ha" && p.sound_modes?.length) {
    extra += `<div class="seg" style="margin-top:8px">${p.sound_modes.slice(0, 5).map((m) =>
      `<button class="${m === p.sound_mode ? "on" : ""}" data-soundmode="${esc(p.id)}" data-mode="${esc(m)}">${esc(m)}</button>`).join("")}</div>`;
  }
  if (full && p.kind === "jf" && p.title) {
    const targets = (S.jellyfin.sessions || []).filter((s) => s.id !== p.id);
    if (targets.length) extra += `<h2>Send to</h2><div class="controls" style="flex-wrap:wrap">${targets.map((t) =>
      `<button class="btn" data-move="${esc(p.id)}" data-to="${esc(t.id)}">${ico("move")}&nbsp;${esc(t.device)}</button>`).join("")}</div>`;
  }
  return `<div class="card">
    <div class="np"><div class="art" ${art}>${p.picture ? "" : ico("music")}</div>
      <div class="grow"><span class="badge ${live ? "live" : ""}">${esc(p.state)}</span>
        <div class="t1" style="margin-top:6px">${esc(p.title || p.name)}</div>
        <div class="t2">${esc(p.title ? `${p.sub || ""} · ${p.name}` : p.sub || "")}</div></div></div>
    <div class="controls">${ctrl}</div>${extra}</div>`;
}

function renderHome() {
  $("#scenes").innerHTML = Object.entries(S.scenes).map(([id, sc]) =>
    `<button class="scene ${sc.hue == null ? "gray" : ""}" style="--h:${Number(sc.hue) || 0}" data-scene="${esc(id)}">${ico(sc.icon)}<span>${esc(sc.name)}</span></button>`).join("");
  const ps = players();
  const best = ps.find((p) => p.state === "playing") || ps.find((p) => p.state === "paused");
  $("#np-home").innerHTML = best ? npCard(best, false)
    : `<div class="empty">Nothing playing${S.ha.configured || S.jellyfin.configured ? "" : "<br><small>Connect <b>Home Assistant</b> / <b>Jellyfin</b> in config.json</small>"}</div>`;
  renderModes("#mode-home");
}

function renderModes(sel) {
  const a = S.audio;
  $(sel).innerHTML = (a.modes || []).map((m) => `<button class="${m === a.mode ? "on" : ""}" data-amode="${esc(m)}">${esc(m)}</button>`).join("");
}

function renderMedia() {
  const ps = players().sort((a, b) => (b.state === "playing") - (a.state === "playing"));
  $("#media-list").innerHTML = ps.length ? ps.map((p) => npCard(p, true)).join("")
    : `<div class="empty">No players found.<br><small>Add media_player entities in Home Assistant, or set the Jellyfin API key.</small></div>`;
}

function renderAudio() {
  renderModes("#mode-audio");
  $("#sinks").innerHTML = (S.audio.sinks || []).map((s) => `<div class="card">
    <div class="row"><div class="grow"><div class="t1">${esc(s.label.replace(/ (Controller|High Definition Audio|Audio Controller)/g, ""))}</div>
      <div class="t2">${s.channels}ch${s.default ? " · active output" : ""}</div></div>
      <button class="btn ${s.muted ? "hot" : ""}" data-mute="${esc(s.name)}">${ico(s.muted ? "mute" : "speaker")}</button>
      ${s.default ? "" : `<button class="btn" data-default="${esc(s.name)}">USE</button>`}</div>
    <input type="range" min="0" max="150" value="${s.volume}" data-vol="${esc(s.name)}" style="--p:${(s.volume / 150) * 100}%"></div>`).join("");
}

let remote = localStorage.getItem("beast.remote");
function renderRooms() {
  const lights = Object.entries(S.ha.entities || {}).filter(([id]) => id.startsWith("light."));
  let h = S.devices.map((d) => `<div class="card"><div class="row">
      <div class="grow"><div class="t1">${esc(d.name)}</div><div class="t2">${esc(d.room || "")} · ${esc(d.role || d.type)}</div></div>
      <span class="badge ${d.online ? "live" : ""}">${d.online ? "online" : d.host || d.type === "local" ? "offline" : "not set"}</span>
      ${d.wol && !d.online ? `<button class="btn" data-wol="${d.id}">${ico("wake")}</button>` : ""}
      ${d.type === "adb" && d.host ? `<button class="btn ${remote === d.id ? "hot" : ""}" data-remote="${d.id}">REMOTE</button>` : ""}
    </div></div>`).join("");

  if (remote && S.remotes.includes(remote)) {
    const k = (key, icon, cls = "") => `<button class="btn ${cls}" data-key="${key}">${icon ? ico(icon) : "OK"}</button>`;
    h += `<h2>Remote · ${esc(S.devices.find((d) => d.id === remote)?.name)}</h2><div class="card">
      <div class="dpad"><span></span>${k(19, "up")}<span></span>${k(21, "left")}${k(23, "", "ok")}${k(22, "right")}<span></span>${k(20, "down")}<span></span></div>
      <div class="controls">${k(4, "back")}${k(3, "home")}${k(85, "play", "wide")}${k(25, "voldn")}${k(24, "volup")}${k(26, "power")}</div></div>`;
  }
  if (lights.length) {
    h += `<h2>Lights</h2>` + lights.map(([id, l]) => `<div class="card row"><div class="grow t1">${esc(l.name)}</div>
      <button class="btn ${l.state === "on" ? "hot" : ""}" data-light="${esc(id)}">${ico("bulb")}</button></div>`).join("");
  }
  $("#rooms").innerHTML = h;
}

let camTimer;
function renderCams() {
  const cams = S.cameras || [];
  const el = $("#cams");
  if (!cams.length) { el.innerHTML = `<div class="empty">No cameras yet.<br><small>Add go2rtc / Frigate snapshot or MJPEG URLs to <b>cameras</b> in config.json</small></div>`; return; }
  if (el.dataset.n == cams.length) return; // keep streams running, don't rebuild
  el.dataset.n = cams.length;
  el.innerHTML = cams.map((c, i) => `<div class="cam"><img data-cam="${i}" src="${esc(c.url)}" alt=""><span>${esc(c.name)}</span></div>`).join("");
  clearInterval(camTimer);
  camTimer = setInterval(() => {   // snapshot-style URLs refresh; MJPEG ones just keep streaming
    if (view !== "cams") return;
    cams.forEach((c, i) => { if (c.snapshot) $(`[data-cam="${i}"]`).src = c.url + (c.url.includes("?") ? "&" : "?") + "t=" + Date.now(); });
  }, 2000);
}

// ---------- interactions (one delegated handler)
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const d = b.dataset;
  if (d.scene) {
    b.classList.add("busy");
    try { await act({ action: "scene", id: d.scene }, `${S.scenes[d.scene].name} engaged`); } finally { b.classList.remove("busy"); }
  } else if (d.amode) act({ action: "audio.mode", mode: d.amode }, `Audio: ${d.amode}`);
  else if (d.media) act({ action: "media", entity: d.media, cmd: d.cmd });
  else if (d.jf) act({ action: "jf.cmd", session: d.jf, cmd: d.cmd });
  else if (d.move) act({ action: "jf.move", from: d.move, to: d.to }, "Moved");
  else if (d.soundmode) act({ action: "media", entity: d.soundmode, cmd: "select_sound_mode", data: { sound_mode: d.mode } }, d.mode);
  else if (d.mute) act({ action: "audio.mute", sink: d.mute });
  else if (d.default) act({ action: "audio.default", sink: d.default }, "Output switched");
  else if (d.wol) act({ action: "wol", device: d.wol }, "Wake packet sent");
  else if (d.light) act({ action: "light.toggle", entity: d.light });
  else if (d.remote) { remote = remote === d.remote ? null : d.remote; localStorage.setItem("beast.remote", remote || ""); renderRooms(); }
  else if (d.key) act({ action: "adb.key", device: remote, key: +d.key });
});

// sliders: pause re-render while dragging, send on release
document.addEventListener("input", (e) => {
  const r = e.target;
  if (r.type !== "range") return;
  dragging = true;
  r.style.setProperty("--p", ((r.value - r.min) / (r.max - r.min)) * 100 + "%");
});
document.addEventListener("change", (e) => {
  const r = e.target;
  if (r.type !== "range") return;
  dragging = false;
  if (r.dataset.vol) act({ action: "audio.volume", sink: r.dataset.vol, level: +r.value });
  if (r.dataset.havol) act({ action: "media", entity: r.dataset.havol, cmd: "volume_set", data: { volume_level: r.value / 100 } });
});

// ---------- Hermes
const chat = $("#chat");
function say(text, who) {
  const m = document.createElement("div");
  m.className = "msg " + who; m.textContent = text; chat.appendChild(m); chat.scrollTop = chat.scrollHeight;
  return m;
}
say("Hermes online. Type, or hold the mic.", "sys");
$("#mic").innerHTML = ico("mic");

$("#ask").addEventListener("submit", async (e) => {
  e.preventDefault();
  const i = $("#ask-text"); const text = i.value.trim(); if (!text) return;
  i.value = ""; i.blur(); say(text, "me");
  const wait = say("…", "bot");
  try { wait.textContent = (await act({ action: "hermes", text, room: ROOM })).reply; }
  catch (err) { wait.remove(); }
});

let rec, chunks = [];
async function micDown(e) {
  e.preventDefault();
  if (!navigator.mediaDevices?.getUserMedia) return toast("Mic needs a secure origin — open via localhost (see README)", true);
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    rec = new MediaRecorder(stream); chunks = [];
    rec.ondataavailable = (ev) => chunks.push(ev.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      if (blob.size < 2000) return;
      const wait = say("listening…", "sys");
      try {
        const r = await fetch(`/api/voice?room=${ROOM}`, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
        const j = await r.json(); wait.remove();
        if (!j.ok) throw new Error(j.error);
        if (j.heard) say(j.heard, "me");
        if (j.reply) say(j.reply, "bot");
        if (j.audio) new Audio(j.audio).play();
      } catch (err) { wait.remove(); toast(err.message, true); }
    };
    rec.start(); $("#mic").classList.add("rec");
  } catch (err) { toast("Mic blocked: " + err.message, true); }
}
function micUp() { if (rec && rec.state === "recording") rec.stop(); $("#mic").classList.remove("rec"); }
$("#mic").addEventListener("pointerdown", micDown);
["pointerup", "pointerleave", "pointercancel"].forEach((ev) => $("#mic").addEventListener(ev, micUp));

// ---------- boot
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
document.addEventListener("contextmenu", (e) => e.preventDefault());
connect();
