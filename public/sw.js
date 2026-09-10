// Only the public offline notice is cached. Personal data and authenticated API responses never are.
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches.open("cookwell-offline-v1").then((c) => c.add("/offline.html")),
  ),
);
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate")
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/offline.html")),
    );
});
