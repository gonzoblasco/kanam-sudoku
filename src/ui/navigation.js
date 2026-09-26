// U4 - Navegacion de teclado del tablero (logica pura, testeable).
//
// El movimiento con flechas es puro: dado un indice de celda y una direccion,
// devuelve el indice destino. Se saca del DOM a proposito, porque es justo la
// clase de logica que se rompe facil y que no requiere un navegador para probar.

import { DIM, SIZE, rowOf, colOf } from "../core/board.js";

/** Direcciones que entiende el tablero. */
export const DIRECTION = Object.freeze({
  UP: "up",
  DOWN: "down",
  LEFT: "left",
  RIGHT: "right",
});

/** Teclas de flecha -> direccion. */
export const ARROW_KEYS = Object.freeze({
  ArrowUp: DIRECTION.UP,
  ArrowDown: DIRECTION.DOWN,
  ArrowLeft: DIRECTION.LEFT,
  ArrowRight: DIRECTION.RIGHT,
});

/**
 * Celda destino al moverse desde `cell` en `direction`.
 *
 * El movimiento da la vuelta: bajar desde la ultima fila lleva a la primera,
 * y a la derecha desde la ultima columna de la fila lleva a la primera de esa
 * misma fila. Es lo que espera un tablero cuadrado y evita que el foco se
 * pierda en un borde.
 *
 * @param {number} cell indice 0..80
 * @param {string} direction "up" | "down" | "left" | "right"
 * @returns {number} indice destino (0..80)
 */
export function move(cell, direction) {
  if (!Number.isInteger(cell) || cell < 0 || cell >= SIZE) {
    throw new RangeError(`celda fuera del tablero: ${cell}`);
  }
  const row = rowOf(cell);
  const col = colOf(cell);

  switch (direction) {
    case DIRECTION.UP:
      return ((row - 1 + DIM) % DIM) * DIM + col;
    case DIRECTION.DOWN:
      return ((row + 1) % DIM) * DIM + col;
    case DIRECTION.LEFT:
      return row * DIM + ((col - 1 + DIM) % DIM);
    case DIRECTION.RIGHT:
      return row * DIM + ((col + 1) % DIM);
    default:
      throw new RangeError(`direccion desconocida: ${direction}`);
  }
}

/** true si la tecla de flecha corresponde a una direccion conocida. */
export function isArrowKey(key) {
  return Object.prototype.hasOwnProperty.call(ARROW_KEYS, key);
}

/**
 * Celda destino al presionar una tecla de flecha, o el mismo indice si la tecla
 * no es una flecha. Atajo para el manejador de teclado.
 */
export function moveByKey(cell, key) {
  const direction = ARROW_KEYS[key];
  if (!direction) return cell;
  return move(cell, direction);
}
