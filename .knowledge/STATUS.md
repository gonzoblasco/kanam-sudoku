# STATUS - Kanam SUDOKU

<!-- project: github.com/gonzoblasco/kanam-sudoku -->

## Fase actual

Definition en curso (2026-09-26). U1 (motor puro), U2 (generador + primitivas +
rater base), U3a (tier 2 + motor de explicaciones) y U4 (UI jugable) entregadas y
testeadas.

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
- **Firma comun:** `solve` y `countSolutions` aceptan `Board | number[]` y no
  mutan la entrada (fix del 2026-09-26 sobre una inconsistencia de firma:
  `countSolutions` solo tomaba `number[]`).
- Tests: 145 pasando con `node --test` (`board`, `validator`, `solver`, `random`,
  `analysis`, `techniques`, `rater`, `generator`, `navigation`, `state`, `a11y`).
  Incluye unicidad real (40 puzzles generados, cada uno verificado con el
  solver), determinismo por semilla, un puzzle por tier (facil/medio/dificil)
  resuelto por el rater, un test por tecnica nueva de tier 2 con fixture generado
  y verificado, tests del `text` que comprueban que nombra la unidad y los digitos
  correctos, y tests de la logica de UI (movimiento, conflictos, etiquetas).
- Cero dependencias de runtime. `vite` **7.3.6** como devDependency (verificado:
  `npm install` y `npm run build` corren de verdad). El DOM no se testea (no se
  sumo jsdom): la logica de UI se extrajo a funciones puras.

## Que esta bloqueado

- (nada)

## Proximo

1. U3b: familia tier 3 (unique rectangle, simple colors, X-Chain, Skyscraper,
   2-String Kite, W-Wing, Jellyfish, XY-Chain) y su `text`. Mismo patron que
   U3a: detector + `verifyDeduction` + explicacion parametrizada.
2. U5: notas + undo/redo.
3. U6: timer, estadisticas, persistencia e historial.
4. U7: hints en UI cableados al motor de tecnicas, y seleccion de dificultad en
   UI (hoy la UI arranca de un puzzle de ejemplo fijo en `render.js`).
5. U8: PWA offline + deploy.

## Decisiones abiertas

- Visibilidad del repo (publico/privado).
- Target de deploy (GitHub Pages u otro).
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
- La UI de U4 arranca de un puzzle de ejemplo fijo (`SAMPLE_PUZZLE` en
  `render.js`). Elegir dificultad y generar en cliente es U7, cuando el hint ya
  tenga donde mostrarse.
