// Cache the app shell so the tablet paints instantly, even before the hub answers.
const C = "beast-v1";
const SHELL = ["./", "index.html", "app.css", "app.js", "icon.svg", "manifest.json"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(C).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (u.pathname.startsWith("/api/") || e.request.method !== "GET") return;
  // network first (so UI edits on Beast land immediately), cache fallback when offline
  e.respondWith(fetch(e.request).then((r) => {
    const copy = r.clone(); caches.open(C).then((c) => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request)));
});
