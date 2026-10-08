// LokWerk300 service worker: caches the app shell + pinned library files so the
// app still opens and runs (React/Babel/Supabase-client available) without a
// network connection, e.g. in a tunnel. It never caches calls to the
// Supabase project itself (auth/rest/functions) - those must always be live,
// since they carry the actual questions, progress and login data.

const CACHE_NAME = "lokwerk300-shell-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png",
  "./favicon-32.png",
  "./favicon-16.png",
];

const LIBRARY_URLS = [
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.25.6/babel.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm",
];

const SUPABASE_PROJECT_HOST = "nsidzovmagohzuwvikev.supabase.co";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache
        .addAll(APP_SHELL)
        .catch(() => {})
        .then(() =>
          Promise.all(
            LIBRARY_URLS.map((url) =>
              fetch(url, { mode: "cors" })
                .then((res) => {
                  if (res && res.ok) return cache.put(url, res);
                })
                .catch(() => {})
            )
          )
        );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // Never intercept the live Supabase API (auth, rest, edge functions, storage) -
  // questions, progress and login must always go to the network.
  if (url.indexOf(SUPABASE_PROJECT_HOST) !== -1) {
    return;
  }
  // Only handle simple GET requests; let everything else pass through untouched.
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      // Stale-while-revalidate: serve the cached copy instantly if we have one,
      // and refresh the cache quietly in the background for next time.
      return cached || network;
    })
  );
});
