# STATUS - Kanam SUDOKU

<!-- project: github.com/gonzoblasco/kanam-sudoku -->

## Fase actual

Definition en curso (2026-09-26). U1 (motor puro), U2 (generador + primitivas +
rater base) y U3a (tier 2 + motor de explicaciones) entregadas y testeadas.

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
- **Firma comun:** `solve` y `countSolutions` aceptan `Board | number[]` y no
  mutan la entrada (fix del 2026-09-26 sobre una inconsistencia de firma:
  `countSolutions` solo tomaba `number[]`).
- Tests: 116 pasando con `node --test` (`board`, `validator`, `solver`, `random`,
  `analysis`, `techniques`, `rater`, `generator`). Incluye unicidad real (40
  puzzles generados, cada uno verificado con el solver), determinismo por
  semilla, un puzzle por tier (facil/medio/dificil) resuelto por el rater, un test
  por tecnica nueva de tier 2 con fixture generado y verificado, y tests del
  `text` que comprueban que nombra la unidad y los digitos correctos.
- Cero dependencias de runtime. `vite` como devDependency (para U4).

## Que esta bloqueado

- (nada)

## Proximo

1. U3b: familia tier 3 (unique rectangle, simple colors, X-Chain, Skyscraper,
   2-String Kite, W-Wing, Jellyfish, XY-Chain) y su `text`. Mismo patron que
   U3a: detector + `verifyDeduction` + explicacion parametrizada.
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
