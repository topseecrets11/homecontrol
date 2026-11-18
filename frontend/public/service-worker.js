// Beast OS service worker: network-first, offline fallback for the shell only.
// Never caches /api/*, /abyss/* or anything that isn't a plain same-origin GET.
var CACHE_NAME = 'beast-os-v5';
var SHELL = ['/', '/homeos.css', '/blob.js', '/modes.js', '/beastos.js', '/homeos.js', '/icon.svg', '/manifest.json'];

self.addEventListener('install', function(event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function(c) { return c.addAll(SHELL); }));
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME; })
        .map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

function cacheable(req) {
  if (req.method !== 'GET') return false;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return false;
  return !/^\/(api|abyss|m)\//.test(url.pathname);
}

self.addEventListener('fetch', function(event) {
  var req = event.request;
  if (!cacheable(req)) return;
  event.respondWith(
    fetch(req).then(function(res) {
      if (res && res.status === 200 && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function(c) { c.put(req, copy); });
      }
      return res;
    }).catch(function() { return caches.match(req); })
  );
});
