// Thermcon's published page: opens even without a connection (it then says the
// device is out of reach), and always tries the network first so updates arrive.
const CACHE = "thermcon-v2";
const FILES = ["./", "index.html", "manifest.json", "apple-touch-icon.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;  // ThingSpeak, EMQX: straight through
  e.respondWith(fetch(e.request)
    .then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return r;
    })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});

// A notification from the device (see push.c): {"title", "body", "tag", "ts"}.
// One of a kind replaces the last, and still sounds.
self.addEventListener("push", (e) => {
  let m = {};
  try {
    m = e.data ? e.data.json() : {};
  } catch (err) {
    m = { body: e.data ? e.data.text() : "" };
  }
  e.waitUntil(self.registration.showNotification(m.title || "Thermcon", {
    body: m.body || "",
    tag: m.tag || "thermcon",
    renotify: true,
    icon: "icon-192.png",
    badge: "icon-192.png",
    timestamp: m.ts ? m.ts * 1000 : Date.now(),
  }));
});

// A tap opens the app, or brings it forward if it is open.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if ("focus" in c) return c.focus();
    return self.clients.openWindow(self.registration.scope);
  }));
});
