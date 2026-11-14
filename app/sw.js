/* Kochbuddy – Service Worker.
   Alles kommt frisch vom GitHub-Repo (Plan, Rezepte und der App-Code selbst). Der Speicher auf dem Handy ist nur
   der Rückfall ohne Netz bzw. bei sehr langsamem WLAN. Schriften und Icons ändern sich nie und kommen aus dem Speicher. */
const VERSION = "kochbuddy-4";
const SHELL = [
  "./", "index.html", "app.css", "app.js", "manifest.webmanifest", "favicon.svg",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/badge-96.png",
  "fonts/atkinson-hyperlegible-latin-400-normal.woff2", "fonts/atkinson-hyperlegible-latin-700-normal.woff2",
  "fonts/bricolage-grotesque-latin-var.woff2",
  "fonts/ibm-plex-mono-latin-600-normal.woff2",
];
const SLOW_MS = 4000; // so lange wird aufs Netz gewartet, wenn schon eine gespeicherte Fassung da ist

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.all(SHELL.map((u) => fetch(u, { cache: "no-cache" }).then((r) => (r.ok ? c.put(u, r) : null)).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("kochbuddy-") && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(url, fallbackUrl) {
  const net = fetch(url, { cache: "no-cache", credentials: "same-origin" }).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(url, copy)); }
    return res;
  });
  const stored = caches.match(url, { ignoreSearch: true }).then((hit) => hit || (fallbackUrl ? caches.match(fallbackUrl) : undefined));
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (!done && r) { done = true; resolve(r); } };
    const slow = setTimeout(() => stored.then(finish), SLOW_MS);
    net.then((res) => { clearTimeout(slow); if (res.ok || done) finish(res); else stored.then((hit) => finish(hit || res)); })
      .catch(() => { clearTimeout(slow); stored.then((hit) => { if (!done) { done = true; resolve(hit || Response.error()); } }); });
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (/\/(fonts|icons)\//.test(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
    return;
  }
  url.hash = "";
  e.respondWith(networkFirst(url.href, req.mode === "navigate" ? "index.html" : null));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) return c.focus();
      return self.clients.openWindow("./");
    })
  );
});
