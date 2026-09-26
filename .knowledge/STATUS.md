# STATUS - Kanam SUDOKU

<!-- project: github.com/gonzoblasco/kanam-sudoku -->

## Fase actual

Definition en curso (2026-09-26). U1 (motor puro) entregada y testeada.

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
    `solved | invalid | unsolvable` sin colgarse. `countSolutions(values, cap)`
    con corte (cap = 2 para "hay solucion unica?").
- Tests: 46 pasando con `node --test` (`test/board.test.js`,
  `test/validator.test.js`, `test/solver.test.js`), cubriendo los casos borde
  pedidos: tablero invalido, sin solucion, vacio, ya resuelto y con mas de una
  solucion.
- Cero dependencias de runtime. `vite` como devDependency (para U4).

## Que esta bloqueado

- (nada)

## Proximo

1. U2: generador con solucion unica (consume `countSolutions(values, 2)`) y
   escalera de dificultad.
2. U3: motor de tecnicas con explicacion (alimenta hints).
3. U4: UI del tablero: render, input, teclado, a11y.
4. U5: notas + undo/redo.
5. U6: timer, estadisticas, persistencia e historial.
6. U7: hints en UI cableados al motor de tecnicas.
7. U8: PWA offline + deploy.

## Decisiones abiertas

- Visibilidad del repo (publico/privado).
- Target de deploy (GitHub Pages u otro).
- Version de `vite` en `devDependencies`: quedo como `^7.0.0` (a confirmar al
  instalar para U4).

## Notas de implementacion

- El string del tablero acepta `0` y `.` como celda vacia; `serialize` siempre
  emite `0`.
- `parse` marca como dadas todas las celdas con valor del string. Para celdas
  cargadas por el jugador, usar `Board` + `set`/`clear` (las dadas se rechazan).
