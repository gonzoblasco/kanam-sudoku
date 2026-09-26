// U4 - Tests de la navegacion de teclado (logica pura).

import test from "node:test";
import assert from "node:assert/strict";

import { DIRECTION, ARROW_KEYS, move, moveByKey, isArrowKey } from "../src/ui/navigation.js";
import { rowOf, colOf } from "../src/core/board.js";

test("move: derecha e izquierda dentro de la fila", () => {
  assert.equal(move(0, DIRECTION.RIGHT), 1);
  assert.equal(move(1, DIRECTION.LEFT), 0);
  assert.equal(move(40, DIRECTION.RIGHT), 41);
  assert.equal(move(40, DIRECTION.LEFT), 39);
});

test("move: arriba y abajo, mismo indice de columna", () => {
  assert.equal(move(0, DIRECTION.DOWN), 9);
  assert.equal(move(9, DIRECTION.UP), 0);
  assert.equal(move(40, DIRECTION.UP), 31);
  assert.equal(move(40, DIRECTION.DOWN), 49);
});

test("move: cada movimiento conserva la coordenada que no cambia", () => {
  for (const cell of [0, 8, 12, 40, 72, 80]) {
    assert.equal(rowOf(move(cell, DIRECTION.RIGHT)), rowOf(cell));
    assert.equal(rowOf(move(cell, DIRECTION.LEFT)), rowOf(cell));
    assert.equal(colOf(move(cell, DIRECTION.UP)), colOf(cell));
    assert.equal(colOf(move(cell, DIRECTION.DOWN)), colOf(cell));
  }
});

test("move: da la vuelta en los bordes", () => {
  assert.equal(move(8, DIRECTION.RIGHT), 0, "derecha desde el final de la fila 0");
  assert.equal(move(0, DIRECTION.LEFT), 8, "izquierda desde el inicio de la fila 0");
  assert.equal(move(72, DIRECTION.DOWN), 0, "abajo desde la ultima fila");
  assert.equal(move(0, DIRECTION.UP), 72, "arriba desde la primera fila");
});

test("move: da la vuelta sin salir de la fila o columna esperada", () => {
  // al dar la vuelta horizontal se queda en la misma fila
  assert.equal(rowOf(move(8, DIRECTION.RIGHT)), 0);
  // al dar la vuelta vertical se queda en la misma columna
  assert.equal(colOf(move(73, DIRECTION.DOWN)), colOf(73));
});

test("move: ida y vuelta vuelve al origen", () => {
  for (const dir of Object.values(DIRECTION)) {
    const opposite = {
      [DIRECTION.UP]: DIRECTION.DOWN,
      [DIRECTION.DOWN]: DIRECTION.UP,
      [DIRECTION.LEFT]: DIRECTION.RIGHT,
      [DIRECTION.RIGHT]: DIRECTION.LEFT,
    }[dir];
    assert.equal(move(move(40, dir), opposite), 40);
  }
});

test("move: rechaza celdas fuera del tablero y direcciones desconocidas", () => {
  assert.throws(() => move(-1, DIRECTION.UP), RangeError);
  assert.throws(() => move(81, DIRECTION.UP), RangeError);
  assert.throws(() => move(0.5, DIRECTION.UP), RangeError);
  assert.throws(() => move(0, "diagonal"), RangeError);
});

test("moveByKey: flechas mueven, otras teclas no", () => {
  assert.equal(moveByKey(0, "ArrowRight"), 1);
  assert.equal(moveByKey(0, "ArrowDown"), 9);
  assert.equal(moveByKey(40, "9"), 40);
  assert.equal(moveByKey(40, "Delete"), 40);
  assert.equal(moveByKey(40, "a"), 40);
});

test("isArrowKey: solo las cuatro flechas", () => {
  assert.equal(isArrowKey("ArrowUp"), true);
  assert.equal(isArrowKey("ArrowRight"), true);
  assert.equal(isArrowKey("1"), false);
  assert.equal(isArrowKey("Enter"), false);
  assert.equal(isArrowKey(undefined), false);
});

test("ARROW_KEYS: cubre las cuatro direcciones", () => {
  assert.equal(Object.keys(ARROW_KEYS).length, 4);
  assert.equal(new Set(Object.values(ARROW_KEYS)).size, 4);
});
