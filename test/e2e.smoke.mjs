// Smoke test end-to-end del juego con un navegador real.
//
// No es parte de `npm test` (que corre el motor puro con node --test): este
// archivo necesita un Chromium instalado y un servidor. Se corre a mano:
//
//   PLAYWRIGHT_PATH=/ruta/a/playwright-core node test/e2e.smoke.mjs
//
// Verifica el camino completo que un jugador recorre: cargar la app, elegir
// nivel, generar partida, pedir pista, escribir con el teclado, deshacer,
// ganar de verdad y que las estadisticas y la persistencia queden bien.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(HERE, "..", "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
};

/** Servidor estatico minimo sobre dist/. */
function serve(root) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    let path = normalize(decodeURIComponent(url.pathname));
    if (path.endsWith("/")) path += "index.html";
    const file = join(root, path);
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

const checks = [];
function check(name, condition, detail = "") {
  checks.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? "✔" : "✘"} ${name}${detail ? ` -> ${detail}` : ""}`);
}

const { chromium } = await import(process.env.PLAYWRIGHT_PATH ?? "playwright-core");

const { server, port } = await serve(ROOT);
const base = `http://127.0.0.1:${port}`;
// El binario se puede fijar por env: la version de playwright instalada puede
// no coincidir con la del cache de navegadores de la maquina.
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const context = await browser.newContext();
const page = await context.newPage();

const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(String(e)));

try {
  await page.goto(`${base}/`, { waitUntil: "load" });
  await page.waitForSelector('.cell[data-index="80"]', { timeout: 15000 });

  check("la app carga y dibuja 81 celdas", (await page.locator(".cell").count()) === 81);
  check("el selector ofrece 3 niveles", (await page.locator("#nivel option").count()) === 3);

  // --- partida nueva en nivel medio ---
  await page.selectOption("#nivel", "medio");
  await page.getByRole("button", { name: "Partida nueva" }).click();
  await page.waitForTimeout(400);

  const givens = await page.locator('.cell[data-state="dada"]').count();
  check("el tablero arranca con celdas dadas", givens > 0, `${givens} dadas`);

  // --- pista: debe explicar, no solo revelar ---
  await page.getByRole("button", { name: "Pista" }).click();
  await page.waitForTimeout(200);
  const hintText = (await page.locator(".hint-text").textContent())?.trim() ?? "";
  check("la pista devuelve un texto", hintText.length > 0, hintText.slice(0, 80));
  const highlighted = await page.locator(".cell[data-hint]").count();
  check("la pista resalta celdas", highlighted > 0, `${highlighted} celdas`);

  // --- input por teclado ---
  const empty = await page.evaluate(() =>
    [...document.querySelectorAll(".cell")].findIndex((c) => c.dataset.state === "vacia"),
  );
  check("hay celdas vacias para jugar", empty >= 0, `indice ${empty}`);

  await page.locator(`.cell[data-index="${empty}"]`).click();
  await page.keyboard.press("5");
  await page.waitForTimeout(150);
  const typed = (await page.locator(`.cell[data-index="${empty}"]`).textContent())?.trim();
  check("el teclado escribe un numero", typed === "5", `contenido "${typed}"`);

  // --- deshacer ---
  await page.getByRole("button", { name: "Deshacer" }).click();
  await page.waitForTimeout(150);
  const undone = (await page.locator(`.cell[data-index="${empty}"]`).textContent())?.trim();
  check("deshacer revierte la jugada", undone === "", `contenido "${undone}"`);

  // --- persistencia: la partida guardada se puede leer y recuperar ---
  const saved = await page.evaluate(() => {
    const raw = localStorage.getItem("kanam.sudoku.game");
    return raw ? JSON.parse(raw) : null;
  });
  check("la partida se guarda en localStorage", saved != null && Array.isArray(saved.values));
  check("el puzzle guardado tiene 81 celdas", saved?.puzzle?.length === 81);

  // --- resolver de verdad: el solver del core da la solucion ---
  const { parse } = await import("../src/core/board.js");
  const { solve } = await import("../src/core/solver.js");
  const solution = solve(parse(saved.puzzle));
  check("el solver resuelve el puzzle guardado", solution?.status === "solved", solution?.status);

  if (solution?.status === "solved") {
    // Se escribe la solucion celda a celda con el TECLADO, como un jugador.
    for (let i = 0; i < 81; i += 1) {
      const value = solution.solution[i];
      const isGiven = saved.values[i] !== 0 && saved.values[i] !== undefined;
      const alreadyThere = (await page.locator(`.cell[data-index="${i}"]`).textContent())?.trim() === String(value);
      if (isGiven || alreadyThere) continue;
      await page.locator(`.cell[data-index="${i}"]`).click();
      await page.keyboard.press(String(value));
    }
    await page.waitForTimeout(300);

    const status = (await page.locator(".status").textContent())?.trim() ?? "";
    check("la app detecta la victoria", status.startsWith("Resuelto"), status.slice(0, 60));
    check("el tablero queda completo", (await page.locator('.cell[data-state="vacia"]').count()) === 0);

    // --- estadisticas: la victoria queda registrada ---
    const stats = await page.evaluate(() => {
      const raw = localStorage.getItem("kanam.sudoku.stats");
      return raw ? JSON.parse(raw) : null;
    });
    check("la victoria entra a las estadisticas", stats?.won === 1, `won=${stats?.won}`);
    check("la partida ganada queda en el historial", (stats?.results?.length ?? 0) >= 1);
    check("el mejor tiempo se registro", typeof stats?.best?.medio === "number", `medio=${stats?.best?.medio}`);
  }

  // --- recuperacion: recargar y retomar la partida ---
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector('.cell[data-index="80"]', { timeout: 15000 });
  const loadedCells = await page.locator('.cell[data-state="cargada"]').count();
  check("al recargar se recupera la partida", loadedCells >= 1, `${loadedCells} celdas cargadas`);

  check("sin errores de consola", consoleErrors.length === 0, consoleErrors.join(" | "));
} finally {
  await browser.close();
  server.close();
}

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks OK`);
if (failed.length > 0) {
  console.error("Fallaron:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
