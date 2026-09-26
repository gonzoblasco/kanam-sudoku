// U8 - Configuracion de Vite.
//
// Dos cosas importantes para el deploy en GitHub Pages:
// 1. `base` relativo (`./`), para que el sitio funcione bajo el subpath del
//    proyecto (`/<repo>/`), no solo en la raiz del dominio.
// 2. Un plugin chico que, al terminar el build, escribe `sw.js` con la lista de
//    precache real (los archivos hasheados que Vite genero) y su version. No se
//    usa un plugin de PWA externo: el proyecto es cero dependencias de runtime y
//    el SW se escribe a mano.

import { defineConfig } from "vite";
import { buildPrecacheList, cacheVersion, SW_FILE } from "./src/ui/pwa.js";
import { serviceWorkerSource } from "./src/ui/sw-template.js";

/**
 * Emite el service worker en el build, con la lista de archivos real.
 * @returns {import("vite").Plugin}
 */
function serviceWorkerPlugin() {
  let outDir = "dist";
  let base = "./";

  return {
    name: "kanam-service-worker",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
      base = config.base;
    },
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle);
      // Los assets que se emiten en este bundle (js, css ya incluyen su hash) mas
      // el HTML y los archivos publicos que Vite copia aparte.
      const precache = buildPrecacheList([
        "index.html",
        "manifest.webmanifest",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-512.png",
        ...files,
      ]);
      const source = serviceWorkerSource({ precache, version: cacheVersion(precache) });
      this.emitFile({ type: "asset", fileName: SW_FILE, source });
    },
  };
}

export default defineConfig({
  // Relativo: funciona en la raiz y bajo el subpath de GitHub Pages.
  base: "./",
  build: {
    outDir: "dist",
    // Assets con hash para poder cachearlos cache-first sin riesgo.
    assetsDir: "assets",
  },
  plugins: [serviceWorkerPlugin()],
});
