// U1 - Validador de conflictos.
//
// Un conflicto es una celda con valor que choca con otra celda del mismo
// valor en su fila, columna o caja. La UI necesita saber *que* celdas chocan y
// con *que* valor para poder señalarlas, no un booleano pelado.

import { SIZE, DIM, EMPTY, ROWS, COLS, BOXES, rowOf, colOf, boxOf } from "./board.js";

/** Tipos de region donde puede haber conflicto. */
export const UNIT = Object.freeze({
  ROW: "row",
  COL: "col",
  BOX: "box",
});

/** Las 27 regiones del tablero (9 filas, 9 columnas, 9 cajas). */
export const UNITS = Object.freeze([
  ...ROWS.map((cells, index) => ({ type: UNIT.ROW, index, cells })),
  ...COLS.map((cells, index) => ({ type: UNIT.COL, index, cells })),
  ...BOXES.map((cells, index) => ({ type: UNIT.BOX, index, cells })),
]);

// Nombre legible del indice de una region, para los mensajes.
function unitName(type, index) {
  if (type === UNIT.ROW) return `fila ${index + 1}`;
  if (type === UNIT.COL) return `columna ${index + 1}`;
  return `caja ${index + 1}`;
}

/**
 * Conflicto concreto: un valor repetido dentro de una region.
 *
 * @typedef {Object} Conflict
 * @property {string} type    "row" | "col" | "box"
 * @property {number} index   indice de la region (0-8)
 * @property {number} value   valor duplicado (1-9)
 * @property {number[]} cells todos los indices de la region con ese valor, ordenados
 * @property {string} message descripcion legible
 */

/**
 * Conflictos de un tablero, un elemento por valor duplicado en una region.
 *
 * Solo mira regiones que tienen algun duplicado: un tablero resuelto valido
 * devuelve []. Las celdas vacias no generan conflictos.
 *
 * @param {import("./board.js").Board | number[]} board tablero o array de 81 valores
 * @returns {Conflict[]}
 */
export function findConflicts(board) {
  const values = board instanceof Array ? board : board.values;
  const conflicts = [];

  for (const unit of UNITS) {
    // Por cada region: agrupar indices por valor y quedarse con los repetidos.
    const byValue = new Map();
    for (const cell of unit.cells) {
      const value = values[cell];
      if (value === EMPTY) continue;
      const bucket = byValue.get(value);
      if (bucket) bucket.push(cell);
      else byValue.set(value, [cell]);
    }
    for (const [value, cells] of byValue) {
      if (cells.length < 2) continue;
      conflicts.push({
        type: unit.type,
        index: unit.index,
        value,
        cells: [...cells].sort((a, b) => a - b),
        message: `${value} repetido en ${unitName(unit.type, unit.index)}`,
      });
    }
  }

  return conflicts;
}

/**
 * Indices de todas las celdas involucradas en algun conflicto. La UI lo usa
 * para marcar celdas en rojo; viene ordenado y sin repetidos.
 *
 * @returns {number[]}
 */
export function conflictCells(board) {
  const cells = new Set();
  for (const conflict of findConflicts(board)) {
    for (const cell of conflict.cells) cells.add(cell);
  }
  return [...cells].sort((a, b) => a - b);
}

/**
 * Mapa celda -> valores que la celda choca, para pintar una celda con mas de un
 * problema. Array de 81 Sets (vacio si la celda no tiene conflicto).
 *
 * @returns {Map<number, Set<number>>}
 */
export function conflictIndex(board) {
  const index = new Map();
  for (const conflict of findConflicts(board)) {
    for (const cell of conflict.cells) {
      const set = index.get(cell);
      if (set) set.add(conflict.value);
      else index.set(cell, new Set([conflict.value]));
    }
  }
  return index;
}

/**
 * true si no hay conflictos de fila, columna ni caja. No dice si el tablero
 * tiene solucion ni si esta completo.
 */
export function isValid(board) {
  return findConflicts(board).length === 0;
}

/**
 * true si el tablero es una solucion: completo, sin conflictos.
 */
export function isSolved(board) {
  const values = board instanceof Array ? board : board.values;
  for (let i = 0; i < SIZE; i++) {
    if (values[i] === EMPTY) return false;
  }
  return isValid(board);
}

/** Celdas y valores duplicados en la fila de un indice. */
export function rowConflicts(board, index) {
  return conflictsInUnit(board, UNIT.ROW, rowOf(index));
}

/** Celdas y valores duplicados en la columna de un indice. */
export function colConflicts(board, index) {
  return conflictsInUnit(board, UNIT.COL, colOf(index));
}

/** Celdas y valores duplicados en la caja de un indice. */
export function boxConflicts(board, index) {
  return conflictsInUnit(board, UNIT.BOX, boxOf(index));
}

function conflictsInUnit(board, type, index) {
  return findConflicts(board).filter((c) => c.type === type && c.index === index);
}

/** Todas las regiones con conflicto, para resaltar filas/columnas/cajas. */
export function conflictedUnits(board) {
  const seen = new Set();
  const units = [];
  for (const conflict of findConflicts(board)) {
    const key = `${conflict.type}:${conflict.index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    units.push({ type: conflict.type, index: conflict.index });
  }
  return units;
}

export { DIM };
