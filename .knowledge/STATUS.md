# STATUS - Kanam SUDOKU

<!-- project: github.com/gonzoblasco/kanam-sudoku -->

## Fase actual

Definition en curso (2026-09-26). U1 (motor puro) y U2 (generador +
primitivas + rater base) entregadas y testeadas.

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
  - `techniques.js`: detectores tier 0 y 1 (`full_house`, `hidden_single`,
    `naked_single`, `locked_candidates_pointing`, `locked_candidates_claiming`,
    `naked_pair`, `hidden_pair`, `naked_triple`, `hidden_triple`) mas
    `findDeduction` (orden por ER) y `verifyDeduction` (justificacion real).
  - Contrato de deduccion documentado en `src/core/DEDUCTION.md`.
  - `rater.js`: `ratePuzzle` devuelve `{difficulty, maxTier, steps, solved,
    techniqueCounts, unsolvedTier}`. Tier 0 = facil, tier 1 = medio. Si no
    resuelve con tier 0-1, `solved: false` y `unsolvedTier`, sin tier inventado.
  - `generator.js`: grilla completa con MRV + quita con verificacion
    `countSolutions(puzzle, 2) === 1` despues de cada quita. `generatePuzzle`
    intenta semillas derivadas hasta que el tier medido coincide con el nivel
    pedido; si no, devuelve `matched: false` sin mentir sobre el nivel.
- **Firma comun:** `solve` y `countSolutions` aceptan `Board | number[]` y no
  mutan la entrada (fix del 2026-09-26 sobre una inconsistencia de firma:
  `countSolutions` solo tomaba `number[]`).
- Tests: 103 pasando con `node --test` (`board`, `validator`, `solver`, `random`,
  `analysis`, `techniques`, `rater`, `generator`). Incluye unicidad real (40
  puzzles generados, cada uno verificado con el solver), determinismo por
  semilla, un puzzle facil resuelto por el rater con tier 0, y un puzzle unico
  que el rater base NO resuelve (tier 2+, material para U3).
- Cero dependencias de runtime. `vite` como devDependency (para U4).

## Que esta bloqueado

- (nada)

## Proximo

1. U3: extender el mismo rater con las familias dificiles (fish, wings, chains,
   unicidad) y agregar el `text` llano del hint. Consume `TECHNIQUES`,
   `AnalysisState` y el contrato de `DEDUCTION.md`.
2. U4: UI del tablero: render, input, teclado, a11y.
3. U5: notas + undo/redo.
4. U6: timer, estadisticas, persistencia e historial.
5. U7: hints en UI cableados al motor de tecnicas.
6. U8: PWA offline + deploy.

## Decisiones abiertas

- Visibilidad del repo (publico/privado).
- Target de deploy (GitHub Pages u otro).
- Version de `vite` en `devDependencies`: quedo como `^7.0.0` (a confirmar al
  instalar para U4).
- **Borde tier/ER:** CORE pidio `hidden_triple` en tier 1, pero la escalera ER
  del research (4.2) ubica Hidden Triple (ER 4.0) en la banda "dificil". Se
  implemento en tier 1 respetando el pedido; queda a definir si el corte de
  "medio" de U3 incluye hidden triple. No se cambio el research.
- **Metas de huecos:** calibradas empiricamente (facil 40, medio 57). Con 45-50
  huecos el generador cae a tier 0 en la mayoria de los casos; 57 hace que el
  rater vea tier 1 de forma confiable. La dificultad final la decide el rater,
  no la meta: la meta es solo el punto de partida de la quita.

## Notas de implementacion

- El string del tablero acepta `0` y `.` como celda vacia; `serialize` siempre
  emite `0`.
- `parse` marca como dadas todas las celdas con valor del string. Para celdas
  cargadas por el jugador, usar `Board` + `set`/`clear` (las dadas se rechazan).
- Convencion de bitmask: `analysis.js` y `techniques.js` usan `bit (d-1)`
  (research 6.1); `solver.js` usa `1 << d`. Ambas conviven; no mezclarlas.
- El generador de grilla completa usa MRV. Un backtracking en orden fijo (el
  primer intento) se colgaba: se corrigio antes de entregar.
