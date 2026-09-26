// U1 - Tests del modelo de tablero.

import test from "node:test";
import assert from "node:assert/strict";

import {
  Board,
  parse,
  serialize,
  rowOf,
  colOf,
  boxOf,
  neighborsOf,
  isValidIndex,
  SIZE,
  DIM,
  EMPTY,
  ROWS,
  COLS,
  BOXES,
} from "../src/core/board.js";

// Puzzle clasico de ejemplo. La grilla resuelta se conoce de antemano.
const PUZZLE = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const SOLUTION = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

function valuesOf(text) {
  return text.split("").map(Number);
}

test("dimensiones del tablero", () => {
  assert.equal(SIZE, 81);
  assert.equal(DIM, 9);
  assert.equal(ROWS.length, 9);
  assert.equal(COLS.length, 9);
  assert.equal(BOXES.length, 9);
});

test("regiones: 9 filas, 9 columnas, 9 cajas de 9 celdas", () => {
  for (const row of ROWS) assert.equal(row.length, 9);
  for (const col of COLS) assert.equal(col.length, 9);
  for (const box of BOXES) assert.equal(box.length, 9);
  // las 27 regiones cubren las 81 celdas sin repetir
  const all = [...ROWS, ...COLS, ...BOXES].flat();
  assert.equal(all.length, 27 * 9);
  assert.equal(new Set(all).size, SIZE);
});

test("indices: fila, columna y caja", () => {
  assert.equal(rowOf(0), 0);
  assert.equal(colOf(0), 0);
  assert.equal(boxOf(0), 0);
  assert.equal(rowOf(80), 8);
  assert.equal(colOf(80), 8);
  assert.equal(boxOf(80), 8);
  // centro de cada caja
  assert.equal(boxOf(40), 4); // fila 4, columna 4 -> caja central
  assert.equal(rowOf(40), 4);
  assert.equal(colOf(40), 4);
  // esquina inferior derecha de la caja central
  assert.equal(boxOf(40), 4);
  assert.equal(boxOf(41), 4); // fila 4, columna 5
  assert.equal(boxOf(31), 4); // fila 3, columna 4
  assert.equal(boxOf(30), 4); // fila 3, columna 3 -> esquina de la caja central
  assert.equal(boxOf(27), 3); // fila 3, columna 0 -> caja del medio a la izquierda
});

test("vecinos: 20 celdas, sin repetir ni incluirse", () => {
  const n = neighborsOf(40);
  assert.equal(n.length, 20);
  assert.equal(new Set(n).size, 20);
  assert.ok(!n.includes(40));
  // vecinos de la caja central
  for (const cell of BOXES[4]) {
    if (cell !== 40) assert.ok(n.includes(cell), `${cell} deberia ser vecino`);
  }
  // extremo
  const corner = neighborsOf(0);
  assert.equal(corner.length, 20);
});

test("parse: valores y celdas dadas", () => {
  const board = parse(PUZZLE);
  assert.equal(board.values.length, SIZE);
  assert.equal(board.value(0), 5);
  assert.equal(board.value(2), EMPTY);
  assert.equal(board.isGiven(0), true);
  assert.equal(board.isGiven(2), false);
  assert.equal(board.isEmpty(2), true);
  assert.equal(board.isEmpty(0), false);
});

test("parse: acepta punto como celda vacia", () => {
  const dotted = PUZZLE.replace(/0/g, ".");
  const board = parse(dotted);
  assert.deepEqual(board.values, valuesOf(PUZZLE));
});

test("parse: ignora espacios y saltos de linea", () => {
  const spaced = `${PUZZLE.slice(0, 40)}\n${PUZZLE.slice(40)}`;
  assert.deepEqual(parse(spaced).values, valuesOf(PUZZLE));
});

test("parse: rechaza longitudes y caracteres invalidos", () => {
  assert.throws(() => parse("123"), RangeError);
  assert.throws(() => parse("x".repeat(81)), RangeError);
  assert.throws(() => parse(42), TypeError);
});

test("serialize: ida y vuelta", () => {
  const board = parse(PUZZLE);
  assert.equal(board.serialize(), PUZZLE);
  assert.equal(serialize(board), PUZZLE);
  assert.equal(serialize(valuesOf(SOLUTION)), SOLUTION);
});

test("empty: tablero sin dadas", () => {
  const board = Board.empty();
  assert.equal(board.serialize(), "0".repeat(81));
  assert.ok(board.values.every((v) => v === EMPTY));
  assert.ok(!board.isFull());
});

test("set y clear: respetan las celdas dadas", () => {
  const board = Board.fromValues(valuesOf("0".repeat(81)));
  assert.equal(board.set(0, 5), true);
  assert.equal(board.value(0), 5);
  assert.equal(board.clear(0), true);
  assert.equal(board.value(0), EMPTY);

  const given = parse(PUZZLE);
  assert.equal(given.set(0, 9), false);
  assert.equal(given.value(0), 5);
  assert.equal(given.clear(0), false);
  assert.equal(given.value(0), 5);
});

test("set: rechaza valores fuera de rango", () => {
  const board = Board.empty();
  assert.throws(() => board.set(0, 10), RangeError);
  assert.throws(() => board.set(0, -1), RangeError);
  assert.throws(() => board.set(0, 1.5), RangeError);
});

test("candidates: lo posible segun fila, columna y caja", () => {
  const board = parse(PUZZLE);
  // celda 2 (fila 0, columna 2): fila 0 tiene 5,3,7 y columna 2 tiene 8
  assert.deepEqual(board.candidates(2), [1, 2, 4]);
  // una celda con valor no tiene candidatos
  assert.deepEqual(board.candidates(0), []);
});

test("isFull: solo mira si hay huecos", () => {
  assert.equal(parse(SOLUTION).isFull(), true);
  assert.equal(parse(PUZZLE).isFull(), false);
});

test("clone: copia independiente", () => {
  const board = parse(PUZZLE);
  const copy = board.clone();
  copy.values[2] = 9;
  assert.equal(board.value(2), EMPTY);
  assert.equal(copy.value(2), 9);
});

test("isValidIndex: limites", () => {
  assert.equal(isValidIndex(0), true);
  assert.equal(isValidIndex(80), true);
  assert.equal(isValidIndex(81), false);
  assert.equal(isValidIndex(-1), false);
  assert.equal(isValidIndex(1.5), false);
});
