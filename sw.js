/* Vazhedan service worker: lets the app open without the internet and install on a phone.
   Same-origin files only. Network first (the browser's own HTTP cache keeps re-checks cheap), the stored copy when
   offline or when the network is slower than WAIT ms. Skipped: other sites, audio (range requests) and mt/
   (the translator keeps its own cache, vazhedan-mt-1). */
var CACHE = "vazhedan-app-1";
var WAIT = 4000;
var CORE = ["./", "index.html", "fonts/fonts.css", "manifest.webmanifest", "icons/icon-192.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf("vazhedan-app-") === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function skip(req, url) {
  if (req.method !== "GET" || url.origin !== self.location.origin) return true;
  if (req.headers.has("range") || /\.(mp3|m4a|ogg|wav|mp4)$/i.test(url.pathname)) return true;
  var rel = url.pathname.slice(new URL(self.registration.scope).pathname.length);
  return /^mt\//.test(rel) || /^sw\.js$/.test(rel);
}

self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (skip(req, url)) return;
  var nav = req.mode === "navigate";
  var key = nav ? "index.html" : req;
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(key, { ignoreSearch: nav }).then(function (old) {
      var net = fetch(req).then(function (res) {
        if (res && res.ok && res.type === "basic") { var copy = res.clone(); c.put(key, copy).catch(function () {}); }
        return res;
      });
      if (!old) return net;
      var t = new Promise(function (ok) { setTimeout(function () { ok(old); }, WAIT); });
      e.waitUntil(net.catch(function () {}));
      return Promise.race([net.catch(function () { return old; }), t]);
    });
  }));
});
