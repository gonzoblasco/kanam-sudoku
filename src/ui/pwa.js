// U8 - PWA: registro del service worker y armado del precache.
//
// Logica pura, sin DOM ni red: la usa tanto la app (`main.js`) como el plugin de
// build (`vite.config.js`) para generar la lista de precache. Se testea con
// `node --test`.

/** Ruta del service worker, relativa al documento (funciona bajo subpath). */
export const SW_URL = "./sw.js";

/** Nombre del archivo del SW dentro del build. */
export const SW_FILE = "sw.js";

/**
 * true solo en produccion. En desarrollo no se registra: el SW pelea con el HMR
 * de Vite (sirve assets viejos y rompe la recarga).
 *
 * @param {string} mode "production" | "development" | otro
 */
export function shouldRegister(mode) {
  return mode === "production";
}

/**
 * Arma la lista de precache a partir de los archivos del build.
 *
 * - Normaliza a rutas relativas (`./...`), para que funcione bajo subpath.
 * - Descarta el propio SW (nunca se precachea a si mismo) y los sourcemaps.
 * - Deduplica y ordena, para que el resultado sea estable entre builds.
 *
 * @param {string[]} files rutas de archivo relativas a la raiz del build
 * @param {{swFile?: string}} [options]
 * @returns {string[]}
 */
export function buildPrecacheList(files, options = {}) {
  const swFile = options.swFile ?? SW_FILE;
  const seen = new Set();
  const out = [];
  for (const file of files) {
    const normalized = String(file).replace(/^\.?\//, "");
    if (!normalized) continue;
    if (normalized === swFile) continue;
    if (normalized.endsWith(".map")) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(`./${normalized}`);
  }
  return out.sort();
}

/**
 * Version del cache a partir de la lista de precache. Cambia cuando cambia
 * cualquier archivo, y solo entonces: evita servir un HTML viejo para siempre.
 *
 * @param {string[]} precache
 * @returns {string}
 */
export function cacheVersion(precache) {
  let hash = 0;
  for (const entry of precache) {
    for (let i = 0; i < entry.length; i++) {
      hash = (hash * 31 + entry.charCodeAt(i)) | 0;
    }
  }
  return `v${(hash >>> 0).toString(36)}`;
}

/**
 * Registra el service worker si corresponde. No hace nada fuera de produccion ni
 * si el navegador no lo soporta (falla en silencio: la app funciona igual).
 *
 * @param {{mode: string, container?: object}} options
 * @returns {Promise<object|null>}
 */
export async function registerServiceWorker(options = {}) {
  const { mode, container = globalThis.navigator } = options;
  if (!shouldRegister(mode)) return null;
  if (!container || !("serviceWorker" in container)) return null;

  try {
    const url = new URL(SW_URL, globalThis.document?.baseURI ?? "http://localhost/");
    return await container.serviceWorker.register(url);
  } catch {
    // Sin SW la app sigue andando; no se rompe la carga por esto.
    return null;
  }
}
