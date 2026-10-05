// Offline support: keeps a copy of the app's files so it opens without internet after the first visit.
// The store's data is never here; it lives in the browser's IndexedDB.
const CACHE = "invoices-v1";
const PAGES = ["/", "/pos", "/products", "/products/new", "/products/item", "/products/labels", "/inventory",
  "/customers", "/customers/new", "/customers/item", "/invoices", "/invoices/item", "/tiktok", "/settings",
  "/settings/backup", "/settings/csv", "/sql-wasm.wasm"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // Best effort: a page that fails to download is cached later, when visited.
  event.waitUntil(caches.open(CACHE).then((c) => Promise.all(PAGES.map((p) => c.add(p).catch(() => {})))));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Build files never change (their names contain a hash): cache first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res))),
    );
    return;
  }

  // Everything else: fresh from the network when online, the saved copy when offline.
  event.respondWith(
    fetch(req)
      .then((res) => put(req, res))
      .catch(async () => (await caches.match(req)) || (await caches.match(req, { ignoreSearch: true })) ||
        (req.mode === "navigate" ? caches.match("/") : Response.error())),
  );
});

function put(req, res) {
  if (res.ok && res.type === "basic") {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
}
