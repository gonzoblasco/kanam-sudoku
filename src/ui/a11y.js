// U4 - Etiquetas accesibles del tablero (logica pura, testeable).
//
// El aria-label de cada celda tiene que alcanzar para entender el tablero sin
// verlo: fila, columna, caja, valor y estado (dada / cargada / vacia / en
// conflicto). Se arma aca, separado del DOM, para poder probarlo.

import { rowOf, colOf, boxOf } from "../core/board.js";
import { CELL_STATE } from "./state.js";

/** "fila 3, columna 5, caja 2" (1-based, como cuenta el jugador). */
export function positionLabel(index) {
  return `fila ${rowOf(index) + 1}, columna ${colOf(index) + 1}, caja ${boxOf(index) + 1}`;
}

const STATE_LABEL = Object.freeze({
  [CELL_STATE.GIVEN]: "numero dado, fijo",
  [CELL_STATE.PLAYER]: "numero cargado por vos",
  [CELL_STATE.EMPTY]: "vacia",
});

/**
 * Etiqueta accesible de una celda.
 *
 * @param {import("./state.js").GameState} game
 * @param {number} index
 * @returns {string} p. ej. "fila 1, columna 1, caja 1. numero dado, fijo: 5"
 */
export function cellAriaLabel(game, index) {
  const parts = [positionLabel(index)];
  const state = game.stateOf(index);
  const value = game.value(index);

  if (state === CELL_STATE.EMPTY) {
    parts.push("vacia");
  } else {
    parts.push(`${STATE_LABEL[state]}: ${value}`);
  }

  // El conflicto se dice en texto, no solo con color (NFR-4).
  if (game.isConflicting(index)) parts.push("en conflicto");
  if (game.selected === index) parts.push("seleccionada");

  return parts.join(". ");
}

/** Etiqueta corta para la region que agrupa el tablero. */
export function boardAriaLabel(game) {
  const pending = countEmpty(game);
  return `Tablero de sudoku 9 por 9. ${pending} casillas vacias.`;
}

function countEmpty(game) {
  let n = 0;
  for (let i = 0; i < 81; i++) {
    if (game.value(i) === 0) n++;
  }
  return n;
}
