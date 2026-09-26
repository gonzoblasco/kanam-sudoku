// U5 - Tests del historial reversible (undo / redo).

import test from "node:test";
import assert from "node:assert/strict";

import { History, LIMIT, sameSnapshot, copySnapshot } from "../src/ui/history.js";

function snap(values, notes = new Array(81).fill(0)) {
  return { values, notes };
}

test("arranca vacio: nada para deshacer ni rehacer", () => {
  const history = new History();
  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), false);
  assert.equal(history.current(), null);
});

test("reset: fija el estado inicial", () => {
  const history = new History();
  history.reset(snap([1, 2, 3]));
  assert.deepEqual(history.current().values, [1, 2, 3]);
  assert.equal(history.size(), 1);
  assert.equal(history.canUndo(), false);
});

test("push + undo + redo: ida y vuelta", () => {
  const history = new History();
  history.reset(snap([0, 0, 0]));
  history.push(snap([1, 0, 0]));
  history.push(snap([1, 2, 0]));
  assert.deepEqual(history.current().values, [1, 2, 0]);

  assert.equal(history.undo().values[2], 0);
  assert.equal(history.undo().values[1], 0);
  assert.equal(history.canUndo(), false, "no hay mas para deshacer");

  assert.deepEqual(history.redo().values, [1, 0, 0]);
  assert.deepEqual(history.redo().values, [1, 2, 0]);
  assert.equal(history.canRedo(), false);
});

test("push: descarta la rama de rehacer", () => {
  const history = new History();
  history.reset(snap([0]));
  history.push(snap([1]));
  history.push(snap([2]));
  history.undo(); // vuelve a [1]
  history.push(snap([9])); // rama nueva
  assert.equal(history.canRedo(), false, "la rama vieja se descarta");
  assert.deepEqual(history.current().values, [9]);
});

test("push: no duplica estados identicos seguidos", () => {
  const history = new History();
  history.reset(snap([1, 1]));
  history.push(snap([1, 1]));
  assert.equal(history.size(), 1);
});

test("current: devuelve copias, no referencias", () => {
  const history = new History();
  const source = snap([1, 2, 3]);
  history.reset(source);
  const got = history.current();
  got.values[0] = 99;
  assert.equal(history.current().values[0], 1, "mutar la copia no afecta al historial");
  assert.equal(source.values[0], 1, "tampoco afecta al objeto de origen");
});

test("tope: no crece sin control y conserva el estado actual", () => {
  const history = new History(5);
  history.reset(snap([0]));
  for (let i = 1; i <= 10; i++) history.push(snap([i]));
  assert.equal(history.size(), 5);
  assert.equal(history.current().values[0], 10, "el estado actual se conserva");
  // se puede deshacer hasta el piso que quedo
  let steps = 0;
  while (history.canUndo()) {
    history.undo();
    steps++;
  }
  assert.equal(steps, 4);
});

test("LIMIT: es un tope razonable para una partida larga", () => {
  assert.ok(LIMIT >= 500, "una partida puede tener cientos de jugadas");
});

test("sameSnapshot: compara valores y notas", () => {
  assert.equal(sameSnapshot(snap([1]), snap([1])), true);
  assert.equal(sameSnapshot(snap([1]), snap([2])), false);
  assert.equal(sameSnapshot(snap([1]), snap([1], [5])), false);
});

test("copySnapshot: copia profunda de arrays", () => {
  const original = snap([1, 2], [3, 4]);
  const copy = copySnapshot(original);
  copy.values[0] = 9;
  copy.notes[0] = 9;
  assert.equal(original.values[0], 1);
  assert.equal(original.notes[0], 3);
});
