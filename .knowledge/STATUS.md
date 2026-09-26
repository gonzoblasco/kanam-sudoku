# STATUS - Kanam SUDOKU

<!-- project: github.com/gonzoblasco/kanam-sudoku -->

## Fase actual

Definition en curso (2026-09-26). U1 (motor puro), U2 (generador + primitivas +
rater base), U3a (tier 2 + motor de explicaciones), U4 (UI jugable), U5+U6
(notas, undo/redo, timer, estadisticas, persistencia y dificultad) y U7+U8 (hints
en UI + PWA offline con deploy preparado) entregadas y testeadas.

## Que funciona

- **U1 - Modelo de tablero + solver + validador** (`src/core/`):
  - `board.js`: 81 celdas en una tira, regiones (filas/columnas/cajas),
    consultas de valor/dada/vacia, fila/columna/caja de un indice, vecinos
    (20 celdas por celda, precalculados), candidatos legales por celda,
    parse/serialize de string de 81 caracteres (`0` o `.` = vacio, `1`-`9` = dado).
  - `validator.js`: conflictos concretos (tipo, region, valor y celdas), no un
    booleano. Incluye `findConflicts`, `conflictCells`, `conflictIndex`,
    `conflictedUnits`, `isValid`, `isSolved`.
  - `solver.js`: backtracking con heuristica MRV (celda con menos candidatos
    primero) y mascaras de bits por region. `solve` devuelve
    `solved | invalid | unsolvable` sin colgarse. `countSolutions(board, cap)`
    con corte (cap = 2 para "hay solucion unica?").
- **U2 - Generador + primitivas + rater base** (`src/core/`):
  - `random.js`: PRNG mulberry32 (`createRng`, `shuffle`, `deriveSeed`). El
    motor no usa `Math.random`: la misma semilla da el mismo puzzle.
  - `analysis.js`: primitivas compartidas con U3. `AnalysisState` con
    `candidates[81]` en bitmask de 9 bits (`bit (d-1)`, research 6.1),
    `cellCount`, `digitCount`, `unitDigitCells`, `unitMissingDigits`,
    `unitEmptyCells`, y las 27 `UNITS` / `UNITS_OF_CELL` / `PEERS`.
    `applyDeduction` actualiza de forma incremental (colocar quita candidatos de
    los peers sin recalcular de cero, para no perder eliminaciones previas).
  - `techniques.js`: detectores tier 0 a 2 (`full_house`, `hidden_single`,
    `naked_single`, `locked_candidates_pointing`, `locked_candidates_claiming`,
    `naked_pair`, `hidden_pair`, `naked_triple`, `hidden_triple`, `naked_quad`,
    `x_wing`, `swordfish`, `xy_wing`, `xyz_wing`) mas `findDeduction` (orden por
    ER) y `verifyDeduction` (justificacion real).
  - `explain.js` (U3a): motor de explicaciones. `explain(deduction)` construye el
    `text` en español desde `evidence` (no es un string fijo por tecnica): nombra
    la unidad y los digitos reales de cada paso. Cubre tier 0, 1 y 2.
  - Contrato de deduccion documentado en `src/core/DEDUCTION.md`.
  - `rater.js`: `ratePuzzle` devuelve `{difficulty, maxTier, steps, solved,
    techniqueCounts, unsolvedTier}`. La escalera reconoce los 4 niveles de la
    spec: tier 0 = facil, 1 = medio, 2 = dificil, 3 = experto. Si no resuelve con
    el tier permitido, `solved: false` y `unsolvedTier`, sin tier inventado.
  - `generator.js`: grilla completa con MRV + quita con verificacion
    `countSolutions(puzzle, 2) === 1` despues de cada quita. `generatePuzzle`
    intenta semillas derivadas hasta que el tier medido coincide con el nivel
    pedido; si no, devuelve `matched: false` sin mentir sobre el nivel.
- **U4 - UI del tablero** (`src/ui/`, `index.html`):
  - `navigation.js`: movimiento por flechas como logica pura (`move`, `moveByKey`,
    `ARROW_KEYS`). Da la vuelta en los bordes sin salir de la fila/columna.
  - `state.js`: `GameState` envuelve un `Board` (copia propia, no comparte estado
    con el tablero de origen). `stateOf` responde dada / cargada / vacia;
    `conflictingCells` usa `conflictCells` del core, asi marca **todas** las
    celdas que chocan, no solo la ultima cargada; `isWon` detecta la victoria.
    Una celda dada nunca se pisa: lo garantiza `Board.set`.
  - `a11y.js`: arma el `aria-label` de cada celda con fila, columna, caja, valor y
    estado, para que un lector de pantalla entienda el tablero sin verlo. El
    conflicto y la seleccion se anuncian en texto (NFR-4).
  - `render.js`: `role=grid` / `role=row` / `role=gridcell`, un `aria-label` por
    celda, input completo (flechas, 1-9, Suprimir/Retroceso, click), region de
    estado con `aria-live`, seleccion visible y aviso de victoria.
  - `styles.css`: contraste, foco visible, bordes gruesos cada 3 celdas, y ningun
    estado que dependa solo del color (dadas por peso, seleccion por contorno,
    conflicto por borde interior + subrayado ondulado + `aria-invalid`). Respeta
    `prefers-reduced-motion`.
  - `index.html` + `main.js`: entrada de Vite que monta el juego en `#app`.
- **U5 - Notas y undo/redo** (`src/ui/`):
  - `notes.js`: mascara de 9 bits de candidatos por celda (misma convencion que
    `analysis.js`). `autoNotes` usa el motor de candidatos real, no recalcula la
    logica.
  - `history.js`: pila de snapshots con puntero. Deshacer/rehacer restauran
    valores y notas exactos. Tope `LIMIT = 1000` entradas; al pasarse se descarta
    la mas vieja. Una mutacion nueva descarta la rama de rehacer.
  - `state.js`: `GameState` ahora tiene notas e historial. Decide: las notas de
    una celda **se conservan** bajo un valor cargado y quedan ocultas; al borrar
    el valor, vuelven. Alternativa descartada: borrarlas al cargar, que hacia
    vacia la regla FR-3 ("borrar un numero no rompe las notas"). El puzzle
    persistido guarda **solo las dadas**, para que al restaurar no se confunda un
    valor del jugador con una dada.
  - `a11y.js`: el `aria-label` de una celda vacia incluye
    "anotaciones: 2, 5 y 7"; no se anuncia en celdas con valor.
- **U6 - Timer, estadisticas, persistencia y dificultad** (`src/ui/`):
  - `timer.js`: tiempo de juego, no de pared. Pausar congela lo acumulado, asi
    el tiempo en pausa no suma; detenerse al resolver es definitivo. Reloj
    inyectado (`now`), asi los tests no esperan. Serializa el tiempo **efectivo**,
    no el tramo interno.
  - `persistence.js`: todo payload lleva `schemaVersion` + migracion (hoy 0 -> 1)
    y rechazo de version futura. `localStorage` corrupto o ausente no lanza:
    arranca limpio y lo reporta (`recovered`). Estadisticas: mejor tiempo por
    nivel, jugadas, ganadas y racha, con `recordWin` como **unico** mutador.
  - `session.js`: une partida, cronometro, estadisticas y almacenamiento;
    restaura la partida en curso al reabrir; expone partida nueva, reiniciar,
    pausa, undo/redo y abandonar. Almacenamiento y generador inyectados.
  - `render.js`: `N` alterna modo nota (1-9 marca candidatos), botones de
    auto-anotar y borrar anotaciones, Deshacer/Rehacer (y Ctrl+Z / Ctrl+Shift+Z)
    con `aria-disabled` cuando no hay nada que hacer, Pausar/Continuar, Partida
    nueva y Reiniciar. Selector de dificultad (facil/medio/dificil) que genera
    con `generatePuzzle`. Las notas se dibujan como mini-rejilla 3x3 en la celda.
- **Firma comun:** `solve` y `countSolutions` aceptan `Board | number[]` y no
  mutan la entrada (fix del 2026-09-26 sobre una inconsistencia de firma:
  `countSolutions` solo tomaba `number[]`).
- Tests: 253 pasando con `node --test` (`board`, `validator`, `solver`, `random`,
  `analysis`, `techniques`, `rater`, `generator`, `navigation`, `state`, `a11y`,
  `notes`, `history`, `timer`, `persistence`, `session`, `hints`, `pwa`). Incluye
  unicidad real (40 puzzles generados, cada uno verificado con el solver),
  determinismo por semilla, un puzzle por tier resuelto por el rater, un test por
  tecnica de tier 2, tests del `text` del hint, tests de logica de UI, la ida y
  vuelta de undo (20 mutaciones mixtas -> estado inicial exacto), la pausa que no
  acumula, la migracion de esquema viejo, el `localStorage` corrupto, las stats
  que no se ensucian al abandonar, el resaltado del hint tolerante a `unit: null`
  y `byDigit` vacio, y la logica de precache/version/registro del SW.
- Cero dependencias de runtime. `vite` **7.3.6** como devDependency (verificado:
  `npm install` y `npm run build` corren de verdad). El DOM no se testea en
  `node --test` (no se sumo jsdom): la logica de UI se extrajo a funciones puras.
  El service worker se escribe a mano, sin plugin de PWA.

## Que esta bloqueado

- (nada)

## Proximo

1. U3b: familia tier 3 (unique rectangle, simple colors, X-Chain, Skyscraper,
   2-String Kite, W-Wing, Jellyfish, XY-Chain) y su `text`. Mismo patron que
   U3a: detector + `verifyDeduction` + explicacion parametrizada.
2. Deploy: solo falta habilitar Pages en el repo (ver Decisiones abiertas).

## Decisiones abiertas

- Visibilidad del repo (publico/privado).
- **Deploy: preparado, sin habilitar (U8).** Falta un paso humano: en GitHub,
  Settings -> Pages -> Build and deployment -> Source: **GitHub Actions**. Recien
  ahi el workflow `.github/workflows/deploy.yml` puede publicar. No se habilito
  ni se deployo nada.
- **Version de `vite`: resuelto (U4).** Quedo en `^7.3.6`, la version que se
  instalo y con la que `npm install` y `npm run build` se verificaron. El rango
  viejo `^7.0.0` nunca se habia probado.
- **Tier de `hidden_triple`: resuelto (U3a).** Va a tier 2, por la tabla de
  niveles del research 4.2 y la regla de SPEC 7bis: el tier lo fija la tabla, no
  el ER. El ER (4.0) se mantiene y solo ordena la evaluacion dentro del catalogo.
- **Metas de huecos:** calibradas empiricamente (facil 40, medio 57, dificil 58).
  La dificultad final la decide el rater, no la meta: la meta es solo el punto de
  partida de la quita. En dificil, 10 de 12 semillas matchearon con maxAttempts 40;
  el generador reintenta con semillas derivadas y no miente si no matchea.

- La UI separa logica pura de DOM: `navigation.js`, `state.js`, `a11y.js`,
  `notes.js`, `history.js`, `timer.js`, `persistence.js`, `session.js`, `hints.js`
  y `pwa.js` no tocan el DOM y se testean con `node --test`; `render.js` solo
  cablea. El DOM no se testea en `node --test` (no se sumo jsdom, por la
  restriccion de cero dependencias nuevas).
- U7: la pista **no aplica** la jugada. `hintFor` toma la deduccion mas simple con
  `findDeduction` (acotada por la dificultad via `hintMaxTier`) y la re-verifica
  con `verifyDeduction`. El `text` es el del motor, tal cual; la UI no escribe
  copy propio. Pedir una pista **no** es una mutacion: no entra al historial de
  undo, solo incrementa `hintsUsed` (que si se persiste).
- U7: el resaltado vive en atributos (`data-hint="cell"` / `"unit"`) ademas del
  color: las celdas del evidence llevan contorno grueso y un punto marcador, las
  de la unidad un fondo tenue. `hintHighlight` tolera `unit: null`, `byDigit`
  ausente o vacio, y las formas extra por familia (line, box, fish, wing).
- U8: los iconos se generan localmente con `scripts/generate-icons.mjs` (PNG
  escrito con `node:zlib`, sin dependencias). El service worker se escribe a mano
  en `src/ui/sw-template.js` y lo emite `vite.config.js` con la lista de precache
  real y una version derivada de ella. `base` queda relativo (`"./"`), para que
  funcione bajo el subpath de Pages y no solo en la raiz del dominio.
- U8: el fallback de navegacion offline del SW apunta a `./index.html` (el
  archivo precacheado), no a `./`. Con `./` una navegacion en frio offline no
  encontraba nada; lo encontro una corrida offline real con Chromium via
  Playwright, no una suposicion.
- U8: el SW se registra **solo** en produccion (en dev pelea con el HMR).

## Verificacion offline (U8)

Probado de verdad con Chromium headless (Playwright-core, ya presente en el
entorno) sobre `dist/` servido local:

- SW activo y controlando la pagina; cache `kanam-sudoku-<version>` con 8
  entradas (html, manifest, 3 iconos, js, css y `/`).
- Con `context.setOffline(true)` y recarga: la app carga igual, 81 celdas
  renderizadas, la pista responde y el teclado carga numeros. Cero errores de
  consola.
- Bajo subpath estilo Pages (`/kanam-sudoku/`): 81 celdas online y 81 offline,
  scope del SW correcto.

Lo que **no** se probo: un dispositivo real sin red (se simulo offline a nivel de
contexto del navegador), y la instalacion como PWA (no se probo el prompt de
instalacion ni el lanzamiento en modo standalone).

## Deploy (U8, sin habilitar)

`.github/workflows/deploy.yml` esta listo: corre `npm ci`, `npm test`, `npm run
build` y publica `dist` con `actions/deploy-pages`. **No se habilito Pages ni se
deployo nada.** Falta un paso humano: en GitHub, Settings -> Pages -> Build and
deployment -> Source: GitHub Actions.

## Notas de implementacion

- El string del tablero acepta `0` y `.` como celda vacia; `serialize` siempre
  emite `0`.
- `parse` marca como dadas todas las celdas con valor del string. Para celdas
  cargadas por el jugador, usar `Board` + `set`/`clear` (las dadas se rechazan).
- Convencion de bitmask: `analysis.js` y `techniques.js` usan `bit (d-1)`
  (research 6.1); `solver.js` usa `1 << d`. Ambas conviven; no mezclarlas.
- El generador de grilla completa usa MRV. Un backtracking en orden fijo (el
  primer intento) se colgaba: se corrigio antes de entregar.
- El `text` del hint se genera en `makeDeduction` llamando a `explain` con solo
  `{technique, evidence}`. Si se agrega una tecnica sin agregarle un explicator
  en `explain.js`, el motor devuelve una frase honesta de respaldo en vez de
  lanzar; los tests de `text` cubren las 14 tecnicas de tier 0-2.
- Los fixtures de tier 2 se generaron localmente con el generador (semillas
  50017, 50266, 50047, 50065, 51063) y se filtraron con el rater hasta que la
  tecnica aparece en la resolucion. No se bajo ningun puzzle de internet.
- La UI separa logica pura de DOM: `navigation.js`, `state.js` y `a11y.js` no
  tocan el DOM y se testean con `node --test`; `render.js` solo cablea. El DOM no
  se testea (no se sumo jsdom, por la restriccion de cero dependencias nuevas).
- `GameState` guarda una **copia** del `Board` que recibe, asi cargar celdas no
  muta el tablero de origen del llamador (mismo criterio que `solve`).
- Puertos: `npm run dev` levanta en `http://localhost:5173/` (default de Vite).
- Decision de notas: una celda con valor conserva sus notas guardadas pero la UI
  no las muestra ni las anuncia. Borrar el valor las trae de vuelta. Es lo unico
  que hace cierta la regla FR-3 de "borrar no rompe las notas".
- Tope del historial: `LIMIT = 1000` entradas. Una partida larga no lo alcanza;
  al pasarse se descarta la entrada mas vieja, nunca el estado actual.
- Esquema de persistencia: `schemaVersion = 1`. Claves `kanam.sudoku.game` y
  `kanam.sudoku.stats`. La migracion 0 -> 1 acepta payloads sin version (formato
  viejo con `board`/`elapsed`). Una version futura se rechaza sin crashear.
- Al reabrir una partida guardada, el cronometro se retoma **pausado**: el tiempo
  con la app cerrada no cuenta y el jugador decide cuando seguir.
- Las estadisticas solo las toca `recordWin`. Abandonar una partida solo borra lo
  guardado; no registra jugada.
- La UI ya no arranca de un puzzle fijo: el selector de dificultad genera con
  `generatePuzzle`. La semilla es aleatoria en runtime y fija en los tests.
