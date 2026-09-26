// U4 - Estado de la partida (logica pura, testeable).
//
// Envuelve un `Board` de `src/core` y agrega lo que la UI necesita: saber si una
// celda es dada, cargada o vacia, y que celdas estan en conflicto. Nada de DOM:
// esta clase se prueba con `node --test`.
//
// Regla dura: una celda dada nunca se pisa. Lo garantiza `Board.set`, que
// rechaza las celdas fijas; aca no se duplica esa logica.

import { SIZE, EMPTY, Board } from "../core/board.js";
import { conflictCells, isSolved } from "../core/validator.js";

/** Estado de una celda para la UI. */
export const CELL_STATE = Object.freeze({
  GIVEN: "dada", // fija del puzzle, no editable
  PLAYER: "cargada", // puesta por el jugador
  EMPTY: "vacia", // sin valor
});

/**
 * Partida en curso sobre un puzzle.
 *
 * No lleva historial (eso es U5) ni timer (U6): solo el tablero, la seleccion y
 * los conflictos derivados.
 */
export class GameState {
  /**
   * @param {import("../core/board.js").Board} board tablero con las celdas dadas
   */
  constructor(board) {
    if (!(board instanceof Board)) {
      throw new TypeError("GameState necesita un Board");
    }
    // Se guarda una copia: la partida no comparte estado con el tablero que le
    // pasaron, asi cargar o borrar celdas no sorprende al llamador.
    this.board = board.clone();
    this.selected = firstEditable(this.board);
  }

  /** Partida desde un puzzle de 81 caracteres. */
  static fromPuzzle(text) {
    return new GameState(Board.parse(text));
  }

  /** Valor de una celda (0 = vacia). */
  value(index) {
    return this.board.value(index);
  }

  /** true si la celda es fija del puzzle. */
  isGiven(index) {
    return this.board.isGiven(index);
  }

  /** Estado de una celda: dada, cargada o vacia. */
  stateOf(index) {
    if (this.board.isGiven(index)) return CELL_STATE.GIVEN;
    if (this.board.value(index) !== EMPTY) return CELL_STATE.PLAYER;
    return CELL_STATE.EMPTY;
  }

  /** Celdas involucradas en algun conflicto (no solo la ultima cargada). */
  conflictingCells() {
    return conflictCells(this.board);
  }

  /** true si la celda participa de un conflicto. */
  isConflicting(index) {
    return this.conflictingCells().includes(index);
  }

  /**
   * Carga un numero en una celda editable. Devuelve true si se aplico.
   * Una celda dada se rechaza (no se pisa).
   */
  place(index, digit) {
    return this.board.set(index, digit);
  }

  /** Borra una celda editable. Devuelve true si se aplico. */
  clear(index) {
    return this.board.clear(index);
  }

  /** true si el tablero esta completo y sin conflictos. */
  isWon() {
    return isSolved(this.board);
  }

  /** true si el tablero esta lleno (valido o no). */
  isFull() {
    return this.board.isFull();
  }
}

// Primera celda editable; si el puzzle viniera lleno, cae en la 0.
function firstEditable(board) {
  for (let i = 0; i < SIZE; i++) {
    if (!board.isGiven(i)) return i;
  }
  return 0;
}
