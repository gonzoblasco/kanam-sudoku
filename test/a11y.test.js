// U4 - Tests de las etiquetas accesibles (logica pura).

import test from "node:test";
import assert from "node:assert/strict";

import { GameState } from "../src/ui/state.js";
import { cellAriaLabel, positionLabel, boardAriaLabel } from "../src/ui/a11y.js";

const PUZZLE = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";

function fresh() {
  return GameState.fromPuzzle(PUZZLE);
}

test("positionLabel: fila, columna y caja en base 1", () => {
  assert.equal(positionLabel(0), "fila 1, columna 1, caja 1");
  assert.equal(positionLabel(80), "fila 9, columna 9, caja 9");
  assert.equal(positionLabel(2), "fila 1, columna 3, caja 1");
  assert.equal(positionLabel(9), "fila 2, columna 1, caja 1");
});

test("cellAriaLabel: una dada dice posicion, estado y valor", () => {
  const game = fresh();
  const label = cellAriaLabel(game, 0);
  assert.match(label, /fila 1, columna 1, caja 1/);
  assert.match(label, /dado/);
  assert.match(label, /5/);
});

test("cellAriaLabel: una vacia dice vacia", () => {
  const game = fresh();
  const label = cellAriaLabel(game, 2);
  assert.match(label, /fila 1, columna 3, caja 1/);
  assert.match(label, /vacia/);
});

test("cellAriaLabel: una cargada por el jugador lo dice", () => {
  const game = fresh();
  game.place(2, 4);
  const label = cellAriaLabel(game, 2);
  assert.match(label, /cargado/);
  assert.match(label, /4/);
});

test("cellAriaLabel: una celda en conflicto lo dice en texto, no solo color", () => {
  const game = fresh();
  // 5 en la celda 2 choca con el 5 dado de la celda 0 (misma fila)
  game.place(2, 5);
  const label = cellAriaLabel(game, 2);
  assert.match(label, /conflicto/);
  const givenLabel = cellAriaLabel(game, 0);
  assert.match(givenLabel, /conflicto/, "la dada que choca tambien lo anuncia");
});

test("cellAriaLabel: la seleccion se anuncia", () => {
  const game = fresh();
  game.selected = 2;
  assert.match(cellAriaLabel(game, 2), /seleccionada/);
  assert.doesNotMatch(cellAriaLabel(game, 3), /seleccionada/);
});

test("boardAriaLabel: cuenta las casillas vacias", () => {
  const game = fresh();
  const label = boardAriaLabel(game);
  assert.match(label, /9 por 9/);
  const empties = PUZZLE.split("").filter((c) => c === "0").length;
  assert.match(label, new RegExp(String(empties)));
});

test("cellAriaLabel: nunca depende del color (siempre lleva texto de estado)", () => {
  const game = fresh();
  for (const index of [0, 2]) {
    const label = cellAriaLabel(game, index);
    assert.ok(/dado|vacia|cargado/.test(label), `falta el estado en la celda ${index}`);
  }
});
