// U4 - Tests del estado de partida (logica pura).

import test from "node:test";
import assert from "node:assert/strict";

import { GameState, CELL_STATE } from "../src/ui/state.js";
import { Board } from "../src/core/board.js";

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
