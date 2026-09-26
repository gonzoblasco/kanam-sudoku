// U1 - Solver por backtracking con heuristica MRV.
//
// Estrategia: en cada paso se elige la celda vacia con menos candidatos
// (Minimum Remaining Values). Si esa celda no tiene candidatos, la rama murio y
// se vuelve atras. Elegir primero la celda mas restringida poda el arbol y hace
// que un 9x9 real se resuelva en miles de pasos, no en millones.
//
// Todo el solver trabaja sobre un array de 81 numeros (0 = vacio). No toca el
// DOM ni depende de nada externo.

import { SIZE, DIM, EMPTY, ROWS, COLS, BOXES, rowOf, colOf, boxOf } from "./board.js";
import { findConflicts } from "./validator.js";

/** Motivos por los que una resolucion no llega a una solucion. */
export const SOLVE_STATUS = Object.freeze({
  SOLVED: "solved",
  INVALID: "invalid",
  UNSOLVABLE: "unsolvable",
});

/** Topes por defecto de nodos explorados, para no colgarse con entradas raras. */
export const DEFAULT_NODE_LIMIT = 2_000_000;

// Mascara de bits por valor (bit 1 en la posicion v). El valor 0 no se usa.
const BIT = new Uint16Array(DIM + 1);
for (let v = 1; v <= DIM; v++) BIT[v] = 1 << v;

// Mascaras de las 27 regiones sobre los indices de celda. Se usan para
// mantener, en cada paso, que valores ya estan usados en la fila/columna/caja.
const ROW_MASK = ROWS.map(() => 0);
const COL_MASK = COLS.map(() => 0);
const BOX_MASK = BOXES.map(() => 0);

/**
 * Estado incremental de candidatos. Mantiene las mascaras de cada region y
 * responde "que valores puede tomar esta celda" en tiempo constante.
 */
class CandidateState {
  constructor(values) {
    this.values = values;
    this.rowMask = new Uint16Array(DIM);
    this.colMask = new Uint16Array(DIM);
    this.boxMask = new Uint16Array(DIM);
    for (let i = 0; i < SIZE; i++) {
      const v = values[i];
      if (v === EMPTY) continue;
      this.rowMask[rowOf(i)] |= BIT[v];
      this.colMask[colOf(i)] |= BIT[v];
      this.boxMask[boxOf(i)] |= BIT[v];
    }
  }

  /** Mascara de valores vetados en una celda por fila, columna y caja. */
  usedMask(index) {
    return this.rowMask[rowOf(index)] | this.colMask[colOf(index)] | this.boxMask[boxOf(index)];
  }

  /** Mascara de candidatos validos de una celda. */
  candidatesMask(index) {
    return ~this.usedMask(index) & 0b1111111110;
  }

  /** Cuenta los candidatos de una celda (popcount de la mascara). */
  count(index) {
    let bits = this.candidatesMask(index);
    let n = 0;
    while (bits) {
      bits &= bits - 1;
      n++;
    }
    return n;
  }

  place(index, value) {
    this.values[index] = value;
    this.rowMask[rowOf(index)] |= BIT[value];
    this.colMask[colOf(index)] |= BIT[value];
    this.boxMask[boxOf(index)] |= BIT[value];
  }

  remove(index) {
    const value = this.values[index];
    this.values[index] = EMPTY;
    this.rowMask[rowOf(index)] &= ~BIT[value];
    this.colMask[colOf(index)] &= ~BIT[value];
    this.boxMask[boxOf(index)] &= ~BIT[value];
  }

  /** Valores candidatos de una celda, como array ordenado. */
  candidateList(index) {
    const mask = this.candidatesMask(index);
    const out = [];
    for (let v = 1; v <= DIM; v++) if (mask & BIT[v]) out.push(v);
    return out;
  }
}

/**
 * Elige la celda vacia con menos candidatos (MRV). Devuelve null si no quedan
 * celdas vacias. Si alguna celda vacia tiene cero candidatos, devuelve esa
 * celda con `count: 0` para que el llamador corte la rama al instante.
 */
function selectCell(state) {
  let best = -1;
  let bestCount = DIM + 1;
  for (let i = 0; i < SIZE; i++) {
    if (state.values[i] !== EMPTY) continue;
    const count = state.count(i);
    if (count < bestCount) {
      best = i;
      bestCount = count;
      if (count <= 1) break; // no hay nada mas restringido que 0 o 1
    }
  }
  return best === -1 ? null : { index: best, count: bestCount };
}

/**
 * true si el tablero no tiene ningun duplicado en fila, columna o caja.
 * Un tablero completo y valido es una solucion; uno con huecos es parcial.
 */
export function isValidBoard(values) {
  return findConflicts(values).length === 0;
}

/**
 * Cuenta soluciones con corte en `cap`. Devuelve como maximo `cap`: sirve para
 * preguntar "hay una sola?" (cap = 2) sin recorrer todo el arbol.
 *
 * @param {number[]} values tablero de 81 valores
 * @param {number} [cap=2] tope de soluciones a buscar
 * @param {{nodeLimit?: number}} [options]
 * @returns {number} cantidad de soluciones encontradas, tope `cap`
 */
export function countSolutions(values, cap = 2, options = {}) {
  const { nodeLimit = DEFAULT_NODE_LIMIT } = options;
  if (!Array.isArray(values) || values.length !== SIZE) {
    throw new RangeError(`el tablero necesita ${SIZE} celdas`);
  }
  if (values.some((v) => v !== EMPTY && (!Number.isInteger(v) || v < 1 || v > DIM))) {
    throw new RangeError("valores fuera de rango en el tablero");
  }
  if (!isValidBoard(values)) return 0;
  if (cap <= 0) return 0;

  const state = new CandidateState(values);
  let found = 0;
  let nodes = 0;

  function search() {
    if (found >= cap) return;
    nodes++;
    if (nodes > nodeLimit) return;

    // Primero descartar celdas muertas: MRV con corte temprano.
    for (let i = 0; i < SIZE; i++) {
      if (state.values[i] !== EMPTY) continue;
      if (state.candidatesMask(i) === 0) return; // celda sin candidatos: rama muerta
    }

    const pick = selectCell(state);
    if (pick === null) {
      found++;
      return;
    }
    if (pick.count === 0) return;

    const candidates = state.candidateList(pick.index);
    for (const value of candidates) {
      state.place(pick.index, value);
      search();
      state.remove(pick.index);
      if (found >= cap) return;
    }
  }

  search();
  return found;
}

/**
 * Resultado de `solve`.
 *
 * @typedef {Object} SolveResult
 * @property {string} status   "solved" | "invalid" | "unsolvable"
 * @property {number[] | null} solution grilla de 81 valores si se resolvio
 * @property {import("./validator.js").Conflict[] | null} conflicts conflictos si `invalid`
 * @property {number} nodes    nodos explorados (diagnostico)
 */

/**
 * Resuelve un tablero por backtracking con MRV.
 *
 * - Tablero con duplicado en una region -> status "invalid" y los conflictos.
 * - Tablero valido pero sin solucion -> status "unsolvable".
 * - Tablero vacio o parcial con solucion -> status "solved" con la grilla.
 * - Tablero ya resuelto -> lo devuelve tal cual.
 *
 * No muta la entrada: trabaja sobre una copia.
 *
 * @param {import("./board.js").Board | number[]} board tablero o array de 81 valores
 * @param {{nodeLimit?: number}} [options]
 * @returns {SolveResult}
 */
export function solve(board, options = {}) {
  const { nodeLimit = DEFAULT_NODE_LIMIT } = options;
  const input = board instanceof Array ? board : board.values;
  if (input.length !== SIZE) {
    throw new RangeError(`el tablero necesita ${SIZE} celdas`);
  }

  // Un tablero con duplicados no es resoluble: se reporta, no se cuelga.
  const conflicts = findConflicts(input);
  if (conflicts.length > 0) {
    return { status: SOLVE_STATUS.INVALID, solution: null, conflicts, nodes: 0 };
  }

  const values = Array.from(input);
  const state = new CandidateState(values);
  let nodes = 0;
  let exhausted = false;
  let limitHit = false;

  function search() {
    nodes++;
    if (nodes > nodeLimit) {
      limitHit = true;
      return false;
    }

    for (let i = 0; i < SIZE; i++) {
      if (state.values[i] !== EMPTY) continue;
      if (state.candidatesMask(i) === 0) return false;
    }

    const pick = selectCell(state);
    if (pick === null) return true; // todas las celdas llenas: solucion
    if (pick.count === 0) return false;

    for (const value of state.candidateList(pick.index)) {
      state.place(pick.index, value);
      if (search()) return true;
      state.remove(pick.index);
      if (limitHit) return false;
    }
    exhausted = true;
    return false;
  }

  const solved = search();
  if (solved) {
    return { status: SOLVE_STATUS.SOLVED, solution: Array.from(state.values), conflicts: null, nodes };
  }
  return { status: SOLVE_STATUS.UNSOLVABLE, solution: null, conflicts: null, nodes };
}

/**
 * Resuelve y devuelve solo la grilla, o null si no se pudo. Atajo para cuando
 * no interesa el motivo.
 *
 * @returns {number[] | null}
 */
export function solveGrid(board, options = {}) {
  const result = solve(board, options);
  return result.status === SOLVE_STATUS.SOLVED ? result.solution : null;
}
