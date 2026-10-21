# Kanam SUDOKU

<!-- project: github.com/gonzoblasco/kanam-sudoku -->

Sudoku web offline-first, con motor de puzzles propio y hints que explican la
tecnica en vez de revelar el numero.

## Stack

- Vanilla JS (ES modules)
- Vite (build + dev server + base PWA)
- Cero dependencias de runtime
- `node --test` para el motor

## Empezar

```bash
npm install
npm run dev      # servidor de desarrollo
npm test         # tests del motor
npm run build    # build de produccion
```

## Test end-to-end (navegador real)

`npm test` corre el motor puro con `node --test` y no necesita navegador. El
smoke test e2e si: levanta `dist/` y juega una partida entera en Chromium
(teclado, pista, deshacer, victoria, estadisticas y recuperacion al recargar).

```bash
npm run build
PLAYWRIGHT_PATH=/ruta/a/playwright-core \
CHROMIUM_PATH=/ruta/a/chrome-headless-shell \
node test/e2e.smoke.mjs
```

`PLAYWRIGHT_PATH` y `CHROMIUM_PATH` son opcionales: si no se pasan, se usan los
valores por defecto de la maquina. El test sale con codigo 1 si un check falla.

## Estructura

```
src/
  core/      motor puro: solver, generador, validador, tecnicas
  ui/        tablero, input, render
  store/     persistencia local (localStorage)
test/        tests del motor
.knowledge/  memoria del proyecto (brief, spec, status)
```
