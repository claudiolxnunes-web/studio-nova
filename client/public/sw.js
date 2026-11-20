/* Studio Nova PWA service worker.
 * App shell and static assets are cached; API calls always go to the network.
 */
const CACHE = "studio-nova-v3";
const SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isBypassed(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/src/") ||
    url.pathname.startsWith("/@") ||
    url.pathname.startsWith("/__") ||
    url.pathname.includes("hot-update") ||
    url.pathname.endsWith(".map")
  );
}

function isStatic(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/avatars/") ||
    url.pathname.startsWith("/models/") ||
    url.pathname.startsWith("/mediapipe/") ||
    /\.(?:css|js|mjs|png|jpe?g|webp|gif|svg|woff2?|ttf|otf|wasm|task)$/i.test(
      url.pathname,
    )
  );
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isBypassed(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put("/", copy)).catch(() => undefined);
          return response;
        })
        .catch(async () => {
          return (
            (await caches.match("/")) ??
            (await caches.match("/index.html")) ??
            new Response("Studio Nova offline", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }),
    );
    return;
  }

  if (!isStatic(url)) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      });
    }),
  );
});
