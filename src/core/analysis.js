// U2 - Primitivas de analisis de tablero.
//
// Estas estructuras son la base compartida entre el rater (U2), el motor de
// tecnicas y los hints (U3). Se calculan una vez por paso y se consultan mucho.
//
// Modelo (research 6.1):
// - `values[81]`: 0 = vacio, 1..9 = valor.
// - `candidates[81]`: bitmask de 9 bits, `bit (d - 1)` = digito d posible.
//   Se usa la convencion de la investigacion (bit 0 para el digito 1), no la de
//   `solver.js` (que usa `1 << d`). Ambas son validas; esta es la compartida.
// - `units[27]`: 9 filas, 9 columnas, 9 cajas (mismos arrays que `board.js`).
// - `unitsOfCell[81]`: las 3 unidades de cada casilla.
// - `peers[81]`: los 20 vecinos (reusa `neighborsOf` de `board.js`).
// - `digitCells[d]`: bitmask de 81 bits con las casillas candidatas del digito d.

import { SIZE, DIM, EMPTY, ROWS, COLS, BOXES, rowOf, colOf, boxOf, neighborsOf } from "./board.js";

export { SIZE, DIM, EMPTY };

/** Tipos de unidad. */
export const UNIT_TYPE = Object.freeze({ ROW: "row", COL: "col", BOX: "box" });

const ALL_DIGITS_MASK = (1 << DIM) - 1; // 0b111111111, bits 0..8

/** Bit (base 1) del digito `digit` (1..9). */
export function bit(digit) {
  return 1 << (digit - 1);
}

/** Popcount de una mascara de 9 bits. */
export function popcount(mask) {
  let n = 0;
  while (mask) {
    mask &= mask - 1;
    n++;
  }
  return n;
}

/** Digitos (array ascendente) de una mascara de 9 bits. */
export function maskDigits(mask) {
  const out = [];
  for (let d = 1; d <= DIM; d++) if (mask & bit(d)) out.push(d);
  return out;
}

/** Mascara de 9 bits de una lista de digitos. */
export function digitsMask(digitList) {
  let mask = 0;
  for (const d of digitList) mask |= bit(d);
  return mask;
}

/** Las 27 unidades del tablero: 9 filas, 9 columnas, 9 cajas. */
export const UNITS = Object.freeze([
  ...ROWS.map((cells, index) => Object.freeze({ type: UNIT_TYPE.ROW, index, cells })),
  ...COLS.map((cells, index) => Object.freeze({ type: UNIT_TYPE.COL, index, cells })),
  ...BOXES.map((cells, index) => Object.freeze({ type: UNIT_TYPE.BOX, index, cells })),
]);

const ROW_UNIT = UNITS.slice(0, 9);
const COL_UNIT = UNITS.slice(9, 18);
const BOX_UNIT = UNITS.slice(18, 27);

/** Las 3 unidades de cada casilla. */
export const UNITS_OF_CELL = Object.freeze(
  Array.from({ length: SIZE }, (_, i) =>
    Object.freeze([ROW_UNIT[rowOf(i)], COL_UNIT[colOf(i)], BOX_UNIT[boxOf(i)]]),
  ),
);

/** Los 20 vecinos de cada casilla (reusa el precalculo de `board.js`). */
export const PEERS = Object.freeze(Array.from({ length: SIZE }, (_, i) => neighborsOf(i)));

/** Etiqueta legible de una unidad, p. ej. "fila 3" (textos y ARIA). */
export function unitLabel(unit) {
  if (unit.type === UNIT_TYPE.ROW) return `fila ${unit.index + 1}`;
  if (unit.type === UNIT_TYPE.COL) return `columna ${unit.index + 1}`;
  return `caja ${unit.index + 1}`;
}

/**
 * Estado de analisis de un tablero: valores, candidatos y derivados.
 *
 * Al aplicar una deduccion se actualiza de forma incremental: colocar un valor
 * quita ese digito de los candidatos de los vecinos (sin recalcular desde cero,
 * para no perder eliminaciones previas), y eliminar un candidato solo baja ese
 * bit. Los `candidates` base (antes de deducciones) consideran solo los valores
 * fijos de los vecinos.
 */
export class AnalysisState {
  constructor(values) {
    if (values.length !== SIZE) {
      throw new RangeError(`el tablero necesita ${SIZE} celdas, llego ${values.length}`);
    }
    this.values = Array.from(values);
    this.candidates = new Array(SIZE).fill(0);
    this.cellCount = new Array(SIZE).fill(0);
    this.digitCount = new Array(DIM + 1).fill(0);
    this._recompute();
  }

  _recompute() {
    this.digitCount.fill(0);
    for (let c = 0; c < SIZE; c++) {
      this.candidates[c] = this.values[c] === EMPTY ? this._candidatesAt(c) : 0;
      this.cellCount[c] = popcount(this.candidates[c]);
    }
    for (let c = 0; c < SIZE; c++) {
      const mask = this.candidates[c];
      for (let d = 1; d <= DIM; d++) if (mask & bit(d)) this.digitCount[d]++;
    }
  }

  // Candidatos base de una casilla mirando solo el valor de sus vecinos.
  _candidatesAt(cell) {
    let used = 0;
    for (const p of PEERS[cell]) {
      const v = this.values[p];
      if (v !== EMPTY) used |= bit(v);
    }
    return ~used & ALL_DIGITS_MASK;
  }

  /** true si no queda ninguna casilla vacia. */
  isSolved() {
    return this.values.every((v) => v !== EMPTY);
  }

  /** Casillas candidatas del digito `d` en una unidad (bitmask de 81 bits). */
  unitDigitCells(unit, digit) {
    let mask = 0n;
    for (const cell of unit.cells) {
      if (this.values[cell] === EMPTY && this.candidates[cell] & bit(digit)) {
        mask |= 1n << BigInt(cell);
      }
    }
    return mask;
  }

  /** Digitos que faltan colocar en una unidad (no estan entre sus valores). */
  unitMissingDigits(unit) {
    let present = 0;
    for (const cell of unit.cells) {
      const v = this.values[cell];
      if (v !== EMPTY) present |= bit(v);
    }
    return ~present & ALL_DIGITS_MASK;
  }

  /** Casillas vacias de una unidad. */
  unitEmptyCells(unit) {
    return unit.cells.filter((cell) => this.values[cell] === EMPTY);
  }

  /**
   * Aplica una deduccion ya verificada. `targets` es una lista de
   * {cell, kind: "place" | "eliminate", digit}.
   */
  applyDeduction(deduction) {
    for (const target of deduction.targets) {
      if (target.kind === "place") this._place(target.cell, target.digit);
      else this._eliminate(target.cell, target.digit);
    }
  }

  _place(cell, digit) {
    if (this.values[cell] !== EMPTY) {
      throw new Error(`la casilla ${cell} ya tiene valor ${this.values[cell]}`);
    }
    this.values[cell] = digit;
    // La casilla colocada no tiene candidatos; los vecinos pierden ese digito.
    for (const d of maskDigits(this.candidates[cell])) this.digitCount[d]--;
    this.candidates[cell] = 0;
    this.cellCount[cell] = 0;
    for (const peer of PEERS[cell]) this._eliminate(peer, digit);
  }

  _eliminate(cell, digit) {
    if (this.values[cell] !== EMPTY) return;
    if (!(this.candidates[cell] & bit(digit))) return;
    this.candidates[cell] &= ~bit(digit);
    this.cellCount[cell] = popcount(this.candidates[cell]);
    this.digitCount[digit]--;
  }
}

/** Construye el estado de analisis desde valores o un Board. */
export function analyze(board) {
  const values = board instanceof Array ? board : board.values;
  return new AnalysisState(values);
}
