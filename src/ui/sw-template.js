// U8 - Plantilla del service worker.
//
// Es una funcion pura que devuelve el texto del SW: el plugin de build
// (`vite.config.js`) le inyecta la lista de precache real y la version. Se
// mantiene aparte para poder testear que la estrategia es la correcta sin un
// navegador.
//
// Estrategia (regla del proyecto):
// - HTML / navegacion: network-first. La version nueva se ve apenas hay red; si
//   no hay red, cae al cache. Evita servir un HTML viejo para siempre.
// - Assets hasheados (js, css, iconos): cache-first. Su nombre cambia cuando
//   cambia el contenido, asi que el cache no puede quedar desactualizado.

/**
 * @param {{precache: string[], version: string}} options
 * @returns {string} codigo fuente del service worker
 */
export function serviceWorkerSource({ precache, version }) {
  const list = JSON.stringify(precache, null, 2);
  return `// Generado por el build. No editar a mano.
const VERSION = ${JSON.stringify(version)};
const CACHE = "kanam-sudoku-" + VERSION;
const PRECACHE = ${list};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  // Borra los caches de versiones anteriores.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isNavigation(request) {
  if (request.mode === "navigate") return true;
  const url = new URL(request.url);
  return url.pathname.endsWith("/") || url.pathname.endsWith(".html");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Network-first para el HTML: la version nueva gana si hay red.
  if (isNavigation(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          // Sin red: se busca la request exacta y, si no esta, el index
          // precacheado. El fallback apunta a "./index.html" y no a "./": la
          // lista de precache guarda el archivo, no el directorio, y con "./"
          // una navegacion en frio (primera vez offline) no encontraba nada.
          caches
            .match(request)
            .then((hit) => hit || caches.match("./index.html"))
            .then((hit) => hit || caches.match("./"))
            .then((hit) => hit || Response.error()),
        ),
    );
    return;
  }

  // Cache-first para el resto (assets hasheados).
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      });
    }),
  );
});
`;
}
