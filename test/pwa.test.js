// U8 - Tests de la logica PWA (registro, precache, version, plantilla del SW).

import test from "node:test";
import assert from "node:assert/strict";

import {
  shouldRegister,
  buildPrecacheList,
  cacheVersion,
  registerServiceWorker,
  SW_FILE,
} from "../src/ui/pwa.js";
import { serviceWorkerSource } from "../src/ui/sw-template.js";

test("shouldRegister: solo en produccion", () => {
  assert.equal(shouldRegister("production"), true);
  assert.equal(shouldRegister("development"), false);
  assert.equal(shouldRegister(""), false);
  assert.equal(shouldRegister(undefined), false);
});

test("buildPrecacheList: normaliza a rutas relativas", () => {
  const list = buildPrecacheList(["index.html", "./assets/a.js", "/assets/b.css"]);
  assert.deepEqual(list, ["./assets/a.js", "./assets/b.css", "./index.html"]);
});

test("buildPrecacheList: descarta el propio SW y los sourcemaps", () => {
  const list = buildPrecacheList(["index.html", SW_FILE, "assets/a.js.map", "assets/a.js"]);
  assert.ok(!list.includes(`./${SW_FILE}`), "el SW no se precachea a si mismo");
  assert.ok(!list.some((f) => f.endsWith(".map")), "sin sourcemaps");
  assert.deepEqual(list, ["./assets/a.js", "./index.html"]);
});

test("buildPrecacheList: deduplica y ordena (resultado estable)", () => {
  const list = buildPrecacheList(["b.js", "a.js", "b.js"]);
  assert.deepEqual(list, ["./a.js", "./b.js"]);
});

test("buildPrecacheList: ignora entradas vacias", () => {
  assert.deepEqual(buildPrecacheList(["", "./", "a.js"]), ["./a.js"]);
});

test("cacheVersion: estable para la misma lista, distinta si cambia", () => {
  const a = cacheVersion(["./a.js", "./index.html"]);
  const b = cacheVersion(["./a.js", "./index.html"]);
  const c = cacheVersion(["./a.js", "./index.html", "./new.css"]);
  assert.equal(a, b);
  assert.notEqual(a, c, "un archivo nuevo cambia la version");
});

test("cacheVersion: empieza con v", () => {
  assert.match(cacheVersion(["./a.js"]), /^v/);
});

test("serviceWorkerSource: incluye la version y el precache", () => {
  const source = serviceWorkerSource({ precache: ["./index.html", "./assets/a.js"], version: "v1" });
  assert.match(source, /const VERSION = "v1"/);
  assert.match(source, /"\.\/index\.html"/);
  assert.match(source, /"\.\/assets\/a\.js"/);
});

test("serviceWorkerSource: network-first para navegacion, cache-first para assets", () => {
  const source = serviceWorkerSource({ precache: [], version: "v1" });
  assert.match(source, /install/);
  assert.match(source, /activate/);
  assert.match(source, /fetch/);
  // el HTML usa fetch() primero
  assert.match(source, /isNavigation/);
  assert.match(source, /caches\.match/);
  // limpia caches viejos
  assert.match(source, /caches\.delete/);
});

test("serviceWorkerSource: el fallback offline apunta al index precacheado", () => {
  const source = serviceWorkerSource({ precache: ["./index.html"], version: "v1" });
  // El fallback usa ./index.html (el archivo precacheado), no solo ./, porque la
  // lista guarda el archivo y una navegacion en frio offline no encontraria el
  // directorio.
  assert.match(source, /caches\.match\("\.\/index\.html"\)/);
});

test("registerServiceWorker: no registra fuera de produccion", async () => {
  let called = false;
  const container = { serviceWorker: { register: async () => { called = true; } } };
  const result = await registerServiceWorker({ mode: "development", container });
  assert.equal(result, null);
  assert.equal(called, false, "no debe registrar en dev");
});

test("registerServiceWorker: registra en produccion", async () => {
  let registered = null;
  const container = { serviceWorker: { register: async (url) => { registered = url; return { scope: "x" }; } } };
  const result = await registerServiceWorker({ mode: "production", container });
  assert.ok(result);
  assert.ok(registered, "debe llamar a register");
});

test("registerServiceWorker: falla en silencio si el navegador no lo soporta", async () => {
  const result = await registerServiceWorker({ mode: "production", container: {} });
  assert.equal(result, null);
});

test("registerServiceWorker: no propaga errores de registro", async () => {
  const container = { serviceWorker: { register: async () => { throw new Error("boom"); } } };
  const result = await registerServiceWorker({ mode: "production", container });
  assert.equal(result, null, "un fallo del SW no puede romper la app");
});
