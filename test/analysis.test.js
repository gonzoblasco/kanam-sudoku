// U2 - Tests de las primitivas de analisis.

import test from "node:test";
import assert from "node:assert/strict";

import { Board } from "../src/core/board.js";
import {
  AnalysisState,
  UNITS,
  UNITS_OF_CELL,
  PEERS,
  UNIT_TYPE,
  analyze,
  bit,
  digitsMask,
  maskDigits,
  popcount,
  unitLabel,
} from "../src/core/analysis.js";
import { findConflicts } from "../src/core/validator.js";

const EASY = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const SOLUTION = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

function valuesOf(text) {
  return text.split("").map(Number);
}

test("mascaras: bit, popcount, digitsMask, maskDigits", () => {
  assert.equal(bit(1), 1);
  assert.equal(bit(9), 256);
  assert.equal(popcount(0b1011), 3);
  assert.equal(popcount(0), 0);
  assert.equal(digitsMask([1, 3, 5]), 0b000010101);
  assert.deepEqual(maskDigits(0b000010101), [1, 3, 5]);
  assert.deepEqual(maskDigits(0), []);
});

test("unidades: 27 en orden filas, columnas, cajas", () => {
  assert.equal(UNITS.length, 27);
  assert.equal(UNITS.filter((u) => u.type === UNIT_TYPE.ROW).length, 9);
  assert.equal(UNITS.filter((u) => u.type === UNIT_TYPE.COL).length, 9);
  assert.equal(UNITS.filter((u) => u.type === UNIT_TYPE.BOX).length, 9);
  assert.deepEqual(UNITS[0].cells, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(UNITS[9].cells, [0, 9, 18, 27, 36, 45, 54, 63, 72]);
});

test("cada casilla tiene sus 3 unidades y sus 20 peers", () => {
  assert.equal(UNITS_OF_CELL.length, 81);
  assert.equal(PEERS.length, 81);
  for (let cell = 0; cell < 81; cell++) {
    assert.equal(UNITS_OF_CELL[cell].length, 3);
    assert.equal(PEERS[cell].length, 20);
    assert.ok(!PEERS[cell].includes(cell));
  }
});

test("unitLabel: etiquetas legibles", () => {
  assert.equal(unitLabel(UNITS[0]), "fila 1");
  assert.equal(unitLabel(UNITS[9]), "columna 1");
  assert.equal(unitLabel(UNITS[18]), "caja 1");
  assert.equal(unitLabel(UNITS[26]), "caja 9");
});

test("analyze: candidatos base de una casilla", () => {
  const state = analyze(valuesOf(EASY));
  // casilla 2: fila 0 tiene 5,3,7 y columna 2 tiene 8 -> quedan 1,2,4
  assert.deepEqual(maskDigits(state.candidates[2]), [1, 2, 4]);
  assert.equal(state.cellCount[2], 3);
});

test("analyze: una casilla con valor no tiene candidatos", () => {
  const state = analyze(valuesOf(EASY));
  assert.equal(state.candidates[0], 0);
  assert.equal(state.cellCount[0], 0);
});

test("analyze: acepta un Board o un array", () => {
  const fromArray = analyze(valuesOf(EASY));
  const fromBoard = analyze(Board.parse(EASY));
  assert.deepEqual(fromArray.candidates, fromBoard.candidates);
});

test("analyze: valida el tamano", () => {
  assert.throws(() => new AnalysisState([1, 2, 3]), RangeError);
});

test("unitDigitCells: casillas candidatas de un digito en una unidad", () => {
  const state = analyze(valuesOf(EASY));
  const box0 = UNITS[18];
  // en la caja 0, el 1 solo puede ir en las casillas 2 y 18
  const cells = cellsFromMask(state.unitDigitCells(box0, 1));
  assert.deepEqual(cells, [2, 18]);
});

test("unitMissingDigits: digitos que faltan en una unidad", () => {
  const state = analyze([
    1, 2, 3, 4, 5, 6, 7, 8, 0,
    ...new Array(72).fill(0),
  ]);
  const row0 = UNITS[0];
  assert.deepEqual(maskDigits(state.unitMissingDigits(row0)), [9]);
});

test("unitEmptyCells: casillas vacias de una unidad", () => {
  const state = analyze(valuesOf(SOLUTION));
  assert.deepEqual(state.unitEmptyCells(UNITS[0]), []);
  const partial = analyze(valuesOf(EASY));
  assert.equal(partial.unitEmptyCells(UNITS[0]).length, 6);
});

test("applyDeduction: colocar quita candidatos de los peers sin recalcular de cero", () => {
  const state = analyze(valuesOf(EASY));
  // la casilla 2 tiene candidatos 1,2,4; colocar 1 ahi
  assert.ok(state.candidates[2] & bit(1));
  state.applyDeduction({ targets: [{ cell: 2, kind: "place", digit: 1 }] });
  assert.equal(state.values[2], 1);
  assert.equal(state.candidates[2], 0);
  // los peers de 2 pierden el 1
  for (const peer of PEERS[2]) {
    if (state.values[peer] === 0) assert.ok(!(state.candidates[peer] & bit(1)), `peer ${peer}`);
  }
});

test("applyDeduction: eliminar solo baja ese bit", () => {
  const state = analyze(valuesOf(EASY));
  const before = state.candidates[2];
  state.applyDeduction({ targets: [{ cell: 2, kind: "eliminate", digit: 4 }] });
  assert.equal(state.candidates[2], before & ~bit(4));
  assert.ok(!(state.candidates[2] & bit(4)));
});

test("applyDeduction: no pierde eliminaciones previas al colocar en otra casilla", () => {
  const state = analyze(valuesOf(EASY));
  state.applyDeduction({ targets: [{ cell: 2, kind: "eliminate", digit: 4 }] });
  // colocar en una casilla vecina de un modo que recalcularia candidatos
  const before = state.candidates[2];
  state.applyDeduction({ targets: [{ cell: 10, kind: "place", digit: 4 }] });
  assert.equal(state.candidates[2], before & ~bit(4) & ~bit(4));
  assert.ok(!(state.candidates[2] & bit(4)), "el 4 sigue eliminado");
});

test("isSolved: falso con huecos, verdadero resuelto", () => {
  assert.equal(analyze(valuesOf(EASY)).isSolved(), false);
  assert.equal(analyze(valuesOf(SOLUTION)).isSolved(), true);
});

test("el estado base reproduce la grilla original sin conflictos", () => {
  const state = analyze(valuesOf(EASY));
  assert.deepEqual(state.values, valuesOf(EASY));
  assert.deepEqual(findConflicts(state.values), []);
});

// Convierte la mascara de 81 bits a indices (helper local del test).
function cellsFromMask(maskBig) {
  const cells = [];
  let remaining = maskBig;
  while (remaining) {
    const low = remaining & -remaining;
    cells.push(low.toString(2).length - 1);
    remaining ^= low;
  }
  return cells;
}
