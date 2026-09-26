// U4 - Tests del estado de partida (logica pura).

import test from "node:test";
import assert from "node:assert/strict";

import { GameState, CELL_STATE } from "../src/ui/state.js";
import { Board } from "../src/core/board.js";
import { cellAriaLabel } from "../src/ui/a11y.js";

// Puzzle con dadas y huecos; la solucion real no importa para estos tests.
const PUZZLE = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";

function fresh() {
  return GameState.fromPuzzle(PUZZLE);
}

test("fromPuzzle: la celda 0 es dada y vale 5", () => {
  const game = fresh();
  assert.equal(game.stateOf(0), CELL_STATE.GIVEN);
  assert.equal(game.isGiven(0), true);
  assert.equal(game.value(0), 5);
});

test("stateOf: dada, vacia y cargada", () => {
  const game = fresh();
  assert.equal(game.stateOf(2), CELL_STATE.EMPTY, "la celda 2 arranca vacia");
  game.place(2, 4);
  assert.equal(game.stateOf(2), CELL_STATE.PLAYER);
  game.clear(2);
  assert.equal(game.stateOf(2), CELL_STATE.EMPTY);
});

test("place: una celda dada no se pisa (la rechaza el Board)", () => {
  const game = fresh();
  const before = game.value(0);
  const applied = game.place(0, 9);
  assert.equal(applied, false, "place devuelve false en una dada");
  assert.equal(game.value(0), before, "el valor dado no cambia");
  assert.equal(game.stateOf(0), CELL_STATE.GIVEN);
});

test("clear: una celda dada no se borra", () => {
  const game = fresh();
  assert.equal(game.clear(0), false);
  assert.equal(game.value(0), 5);
});

test("conflictingCells: marca las celdas involucradas, no solo la ultima", () => {
  const game = fresh();
  // la celda 2 se carga con 5, que ya esta en la fila 0 (celda 0)
  game.place(2, 5);
  const cells = game.conflictingCells();
  assert.ok(cells.includes(0), "la dada que choca tambien queda marcada");
  assert.ok(cells.includes(2), "la celda recien cargada queda marcada");
  assert.equal(game.isConflicting(0), true);
  assert.equal(game.isConflicting(2), true);
});

test("conflictingCells: vacio cuando no hay choques", () => {
  const game = fresh();
  game.place(2, 4);
  assert.deepEqual(game.conflictingCells(), []);
  assert.equal(game.isConflicting(2), false);
});

test("isWon: falso a mitad, verdadero con el tablero resuelto", () => {
  const game = fresh();
  assert.equal(game.isWon(), false);
  // cargar un valor valido pero sin completar no gana
  game.place(2, 4);
  assert.equal(game.isWon(), false);
});

test("isWon: verdadero solo completo y sin conflictos", () => {
  const solved =
    "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
  const win = GameState.fromPuzzle(solved);
  assert.equal(win.isWon(), true);
  // el mismo tablero lleno pero con dos valores cambiados no gana
  const values = solved.split("").map(Number);
  values[0] = values[1];
  const broken = new GameState(Board.fromValues(values));
  assert.equal(broken.isWon(), false);
  assert.equal(broken.isFull(), true);
  assert.ok(broken.conflictingCells().length > 0);
});

test("selected: arranca en la primera celda editable", () => {
  const game = fresh();
  assert.equal(game.isGiven(game.selected), false, "la seleccion inicial es editable");
});

test("constructor: exige un Board", () => {
  assert.throws(() => new GameState("texto"), TypeError);
});

test("no muta el puzzle de origen al cargar", () => {
  const board = Board.parse(PUZZLE);
  const game = new GameState(board);
  game.place(2, 4);
  assert.equal(board.value(2), 0, "el Board no comparte estado con la partida");
});

// --- U5: notas ----------------------------------------------------------------

test("notas: toggleNote marca y desmarca en una celda editable", () => {
  const game = fresh();
  assert.equal(game.toggleNote(2, 5), true);
  assert.equal(game.notes[2] & (1 << 4), 1 << 4);
  game.toggleNote(2, 5);
  assert.equal(game.notes[2], 0);
});

test("notas: no se pueden anotar celdas dadas ni con valor", () => {
  const game = fresh();
  assert.equal(game.toggleNote(0, 5), false, "celda dada");
  game.place(2, 4);
  assert.equal(game.toggleNote(2, 5), false, "celda con valor");
});

test("notas: borrar un numero NO rompe las notas de esa celda", () => {
  const game = fresh();
  // marcar notas, cargar un numero y borrarlo: las notas vuelven
  game.toggleNote(2, 1);
  game.toggleNote(2, 2);
  const notes = game.notes[2];
  game.place(2, 4);
  game.clear(2);
  assert.equal(game.notes[2], notes, "las notas sobreviven al borrado si se guardaron en el snapshot");
});

test("notas: cargar un numero NO borra las notas; quedan guardadas y ocultas", () => {
  const game = fresh();
  game.toggleNote(2, 1);
  game.toggleNote(2, 2);
  const notes = game.notes[2];
  assert.notEqual(notes, 0);
  game.place(2, 4);
  assert.equal(game.notes[2], notes, "las notas se conservan bajo el valor");
  // y no se anuncian mientras la celda tiene valor
  const label = cellAriaLabel(game, 2);
  assert.doesNotMatch(label, /anotaciones/);
  // al borrar el valor, vuelven a verse
  game.clear(2);
  assert.equal(game.notes[2], notes);
  assert.match(cellAriaLabel(game, 2), /anotaciones/);
});

test("fillAutoNotes: rellena candidatos reales y no toca las dadas", () => {
  const game = fresh();
  game.fillAutoNotes();
  assert.equal(game.notes[0], 0, "la dada no lleva notas");
  assert.ok(game.notes[2] > 0, "la celda vacia si");
});

// --- U5: undo / redo -----------------------------------------------------------

test("undo/redo: cargar, borrar y anotar son reversibles", () => {
  const game = fresh();
  game.place(2, 4);
  game.toggleNote(3, 7);
  assert.equal(game.value(2), 4);
  assert.equal(game.notes[3], 1 << 6);

  game.undo();
  assert.equal(game.notes[3], 0, "deshacer quita la nota");
  game.undo();
  assert.equal(game.value(2), 0, "deshacer quita el numero");
  assert.equal(game.canUndo(), false);

  game.redo();
  assert.equal(game.value(2), 4);
  game.redo();
  assert.equal(game.notes[3], 1 << 6, "rehacer devuelve la nota");
});

test("undo: 20 mutaciones mixtas vuelven EXACTO al estado inicial", () => {
  const game = fresh();
  // Celdas realmente editables y vacias: usar una dada seria un no-op y el test
  // no probaria lo que dice.
  const empty = [];
  for (let i = 0; i < 81; i++) if (!game.isGiven(i)) empty.push(i);
  assert.ok(empty.length >= 40, "el puzzle tiene suficientes huecos");
  const [a, b, c, d, e, f, g, h, i2, j, k, l, m] = empty;

  const initial = JSON.stringify({ values: game.values(), notes: Array.from(game.notes) });

  // 20 mutaciones de tipos mezclados (cargar, borrar, anotar, auto-notas, limpiar)
  game.place(a, 4);
  game.toggleNote(b, 1);
  game.toggleNote(b, 2);
  game.place(c, 7);
  game.clear(c);
  game.toggleNote(d, 9);
  game.place(e, 3);
  game.place(f, 6);
  game.setNote(g, 4, true);
  game.setNote(g, 5, true);
  game.clear(e);
  game.fillAutoNotes();
  game.toggleNote(h, 1);
  game.toggleNote(i2, 6);
  game.clearAllNotes();
  game.place(a, 1);
  game.toggleNote(j, 8);
  game.place(k, 9);
  game.clear(k);
  game.toggleNote(l, 3);

  assert.equal(game.canUndo(), true);
  let undone = 0;
  while (game.canUndo()) {
    game.undo();
    undone++;
  }
  const final = JSON.stringify({ values: game.values(), notes: Array.from(game.notes) });
  assert.equal(final, initial, "deshacer todo devuelve el estado inicial caracter por caracter");
  assert.ok(undone >= 20, `se deshizo ${undone} veces, se esperaban al menos 20`);
});

test("undo/redo: una rama nueva descarta el rehacer", () => {
  const game = fresh();
  game.place(2, 4);
  game.undo();
  assert.equal(game.canRedo(), true);
  game.place(3, 7); // rama nueva
  assert.equal(game.canRedo(), false);
});

test("toPersisted / fromPersisted: ida y vuelta identica (con historial)", () => {
  const game = fresh();
  game.place(2, 4);
  game.toggleNote(3, 5);
  game.undo();
  const payload = game.toPersisted({ elapsedMs: 1000, difficulty: "facil" });

  const restored = GameState.fromPersisted(payload);
  assert.deepEqual(restored.values(), game.values());
  assert.deepEqual(Array.from(restored.notes), Array.from(game.notes));
  assert.deepEqual(Array.from(restored.board.givens), Array.from(game.board.givens));
  // el historial tambien sobrevive: se puede seguir deshaciendo
  assert.equal(restored.canUndo(), game.canUndo());
  assert.equal(restored.canRedo(), game.canRedo());
});
