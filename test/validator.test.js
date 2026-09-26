// U1 - Tests del validador de conflictos.

import test from "node:test";
import assert from "node:assert/strict";

import { Board, parse } from "../src/core/board.js";
import {
  findConflicts,
  conflictCells,
  conflictIndex,
  conflictedUnits,
  colConflicts,
  isSolved,
  isValid,
  rowConflicts,
  UNIT,
  UNITS,
} from "../src/core/validator.js";

const PUZZLE = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const SOLUTION = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

function valuesOf(text) {
  return text.split("").map(Number);
}

// Devuelve una copia con la celda `index` en `value`.
function withValue(text, index, value) {
  const values = valuesOf(text);
  values[index] = value;
  return values;
}

test("27 regiones: 9 filas, 9 columnas, 9 cajas", () => {
  assert.equal(UNITS.length, 27);
  assert.equal(UNITS.filter((u) => u.type === UNIT.ROW).length, 9);
  assert.equal(UNITS.filter((u) => u.type === UNIT.COL).length, 9);
  assert.equal(UNITS.filter((u) => u.type === UNIT.BOX).length, 9);
});

test("tablero sin conflictos: lista vacia", () => {
  assert.deepEqual(findConflicts(parse(PUZZLE)), []);
  assert.deepEqual(findConflicts(parse(SOLUTION)), []);
  assert.equal(isValid(parse(PUZZLE)), true);
});

test("tablero vacio: sin conflictos", () => {
  assert.deepEqual(findConflicts(Board.empty()), []);
  assert.equal(isValid(Board.empty()), true);
});

test("conflicto de fila: reporta valor y celdas concretas", () => {
  // fila 0 de PUZZLE es 5,3,_,_,7,_,_,_,_; poner 5 en la celda 2 duplica el 5
  const values = withValue(PUZZLE, 2, 5);
  const conflicts = findConflicts(values);
  const row = conflicts.find((c) => c.type === UNIT.ROW && c.index === 0);
  assert.ok(row, "deberia haber un conflicto de fila 1");
  assert.equal(row.value, 5);
  assert.deepEqual(row.cells, [0, 2]);
  assert.match(row.message, /5/);
});

test("conflicto de columna", () => {
  // columna 0 de PUZZLE: 5,6,_,8,4,7,_,_,_; poner 6 en la celda 72 la duplica
  const values = withValue(PUZZLE, 72, 6);
  const conflicts = findConflicts(values);
  const col = conflicts.find((c) => c.type === UNIT.COL && c.index === 0);
  assert.ok(col, "deberia haber un conflicto de columna 1");
  assert.equal(col.value, 6);
  assert.deepEqual(col.cells, [9, 72]);
});

test("conflicto de caja sin conflicto de fila ni columna", () => {
  // celda 2 (fila 0 col 2) y celda 10 (fila 1 col 1) comparten la caja 0.
  // 2 en fila 0 col 2 y 2 en fila 1 col 1: ni fila ni columna coinciden.
  const values = withValue(PUZZLE, 2, 2);
  values[10] = 2;
  const conflicts = findConflicts(values);
  const box = conflicts.find((c) => c.type === UNIT.BOX && c.index === 0);
  assert.ok(box, "deberia haber un conflicto de caja 1");
  assert.equal(box.value, 2);
  assert.deepEqual(box.cells, [2, 10]);
  assert.equal(conflicts.filter((c) => c.type === UNIT.ROW).length, 0);
  assert.equal(conflicts.filter((c) => c.type === UNIT.COL).length, 0);
});

test("un valor repetido tres veces aparece una sola vez por region", () => {
  const values = valuesOf("0".repeat(81));
  values[0] = 4;
  values[4] = 4;
  values[8] = 4;
  const rowConf = findConflicts(values).filter((c) => c.type === UNIT.ROW && c.index === 0);
  assert.equal(rowConf.length, 1);
  assert.deepEqual(rowConf[0].cells, [0, 4, 8]);
});

test("tablero completo pero invalido: detectado", () => {
  // la grilla resuelta con la celda 0 cambiada a 3 choca en fila y caja
  const values = withValue(SOLUTION, 0, 3);
  const conflicts = findConflicts(values);
  assert.ok(conflicts.length > 0);
  assert.equal(isSolved(values), false);
});

test("conflictCells e conflictIndex: celdas marcadas", () => {
  const values = withValue(PUZZLE, 2, 5);
  const cells = conflictCells(values);
  assert.deepEqual(cells, [0, 2]);
  const index = conflictIndex(values);
  assert.ok(index.get(0).has(5));
  assert.ok(index.get(2).has(5));
});

test("conflictedUnits: regiones involucradas sin repetir", () => {
  const values = withValue(PUZZLE, 2, 5);
  const units = conflictedUnits(values);
  assert.ok(units.some((u) => u.type === UNIT.ROW && u.index === 0));
  assert.ok(units.some((u) => u.type === UNIT.BOX && u.index === 0));
  assert.equal(new Set(units.map((u) => `${u.type}:${u.index}`)).size, units.length);
});

test("consultas por celda: fila, columna y caja de un indice", () => {
  const values = withValue(PUZZLE, 2, 5);
  assert.ok(rowConflicts(values, 0).length > 0);
  assert.ok(rowConflicts(values, 2).length > 0);
  // celda 0 no comparte columna con el conflicto
  assert.equal(colConflicts(values, 2).length, 0);
});

test("isSolved: completo y sin conflictos", () => {
  assert.equal(isSolved(valuesOf(SOLUTION)), true);
  assert.equal(isSolved(valuesOf(PUZZLE)), false); // incompleto
  assert.equal(isSolved(withValue(SOLUTION, 0, 3)), false); // completo pero invalido
  assert.equal(isValid(valuesOf(SOLUTION)), true);
});
