// U4/U5 - Estado de la partida (logica pura, testeable).
//
// Envuelve un `Board` de `src/core` y agrega lo que la UI necesita: saber si una
// celda es dada, cargada o vacia, que celdas estan en conflicto, las notas por
// celda y el historial de undo/redo. Nada de DOM: esta clase se prueba con
// `node --test`.
//
// Regla dura: una celda dada nunca se pisa. Lo garantiza `Board.set`, que
// rechaza las celdas fijas; aca no se duplica esa logica.

import { SIZE, EMPTY, Board } from "../core/board.js";
import { conflictCells, isSolved } from "../core/validator.js";
import { analyze } from "../core/analysis.js";
import { emptyNotes, autoNotes } from "./notes.js";
import { History, copySnapshot } from "./history.js";

/** Estado de una celda para la UI. */
export const CELL_STATE = Object.freeze({
  GIVEN: "dada", // fija del puzzle, no editable
  PLAYER: "cargada", // puesta por el jugador
  EMPTY: "vacia", // sin valor
});

/**
 * Partida en curso sobre un puzzle.
 *
 * Es el modelo compartido por U5 (notas, undo) y U6 (persistencia): el historial
 * y el estado que se guarda son la misma estructura.
 *
 * Decision sobre notas y valores: las notas viven por celda, independientes del
 * valor. Al cargar un numero, las notas de esa celda **quedan guardadas y
 * ocultas** (la UI no las muestra con valor presente, y el aria-label solo las
 * informa en celdas vacias). Al borrar el numero, vuelven a verse. Borrar nunca
 * toca las notas (FR-3): es la unica forma de que "borrar un numero no rompe las
 * notas" signifique algo. Alternativa descartada: limpiarlas al cargar, que
 * hacia la regla vacia.
 */
export class GameState {
  /**
   * @param {import("../core/board.js").Board} board tablero con las celdas dadas
   * @param {{notes?: number[], history?: History}} [options]
   */
  constructor(board, options = {}) {
    if (!(board instanceof Board)) {
      throw new TypeError("GameState necesita un Board");
    }
    // Se guarda una copia: la partida no comparte estado con el tablero que le
    // pasaron, asi cargar o borrar celdas no sorprende al llamador.
    this.board = board.clone();
    // Puzzle original (solo las dadas): se guarda aparte porque `serialize()`
    // del board incluye los valores del jugador, y al restaurar hay que poder
    // distinguir que celdas son fijas.
    this.puzzle = givensString(this.board);
    this.notes = options.notes ? Array.from(options.notes) : emptyNotes();
    this.selected = firstEditable(this.board);
    this.history = options.history ?? new History();
    // Contador de pistas usadas en la partida (dato para las estadisticas).
    this.hintsUsed = Number(options.hintsUsed) || 0;
    // El estado inicial (puzzle limpio) es la primera entrada del historial.
    if (this.history.size() === 0) this.history.reset(this.snapshot());
  }

  /** Partida desde un puzzle de 81 caracteres. */
  static fromPuzzle(text, options = {}) {
    return new GameState(Board.parse(text), options);
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

  /** Valores de las 81 celdas (copia). */
  values() {
    return Array.from(this.board.values);
  }

  /**
   * Estado de analisis del core (candidatos, unidades, peers), para el motor de
   * tecnicas. Se construye al momento: no se cachea, asi no queda desincronizado
   * cuando el jugador carga o borra un numero.
   */
  analysisState() {
    return analyze(this.board.values);
  }

  /** Candidatos legales reales de una celda, segun el motor. */
  candidatesOf(index) {
    return this.analysisState().candidates[index];
  }

  /** Celdas involucradas en algun conflicto (no solo la ultima cargada). */
  conflictingCells() {
    return conflictCells(this.board);
  }

  /** true si la celda participa de un conflicto. */
  isConflicting(index) {
    return this.conflictingCells().includes(index);
  }

  /** Snapshot del estado reversible: valores + notas. */
  snapshot() {
    return { values: this.board.values, notes: this.notes };
  }

  /**
   * Registra que se mostro una pista. No es una mutacion del tablero, asi que no
   * entra al historial de undo: pedir una pista no cambia el estado de juego.
   */
  registerHint() {
    this.hintsUsed++;
    return this.hintsUsed;
  }

  /** Registra el estado actual en el historial. */
  commit() {
    this.history.push(this.snapshot());
    return this;
  }

  /**
   * Carga un numero en una celda editable. Devuelve true si se aplico.
   *
   * Decision (FR-3): las notas de la celda NO se borran al cargar; quedan
   * guardadas y ocultas. La UI no las muestra mientras la celda tenga valor, y
   * el aria-label solo las informa en celdas vacias, asi que no hay estado
   * ambiguo a la vista; al borrar el numero, las notas vuelven solas. Esto es lo
   * que hace cierta la regla "borrar un numero no rompe las notas" (si las
   * borraramos al cargar, ya no habria notas que conservar).
   */
  place(index, digit) {
    if (!this.board.set(index, digit)) return false;
    this.commit();
    return true;
  }

  /** Borra una celda editable. No toca las notas (FR-3). */
  clear(index) {
    if (!this.board.clear(index)) return false;
    this.commit();
    return true;
  }

  /** Alterna una nota en una celda vacia y editable. */
  toggleNote(index, digit) {
    if (this.isGiven(index)) return false;
    if (this.board.value(index) !== EMPTY) return false;
    this.notes[index] ^= 1 << (digit - 1);
    this.commit();
    return true;
  }

  /** Fija una nota en on/off. */
  setNote(index, digit, on) {
    if (this.isGiven(index)) return false;
    if (this.board.value(index) !== EMPTY) return false;
    if (on) this.notes[index] |= 1 << (digit - 1);
    else this.notes[index] &= ~(1 << (digit - 1));
    this.commit();
    return true;
  }

  /**
   * Rellena las notas de las celdas vacias con los candidatos legales reales.
   * No toca las notas de celdas con valor (quedan guardadas y ocultas, ver
   * `place`).
   */
  fillAutoNotes() {
    autoNotes(this.notes, this.board.values);
    this.commit();
    return this;
  }

  /** Borra todas las notas del tablero. */
  clearAllNotes() {
    for (let i = 0; i < SIZE; i++) this.notes[i] = 0;
    this.commit();
    return this;
  }

  /** Deshace la ultima mutacion. Devuelve true si hubo algo que deshacer. */
  undo() {
    const snapshot = this.history.undo();
    if (!snapshot) return false;
    this.applySnapshot(snapshot);
    return true;
  }

  /** Rehace la ultima mutacion deshecha. */
  redo() {
    const snapshot = this.history.redo();
    if (!snapshot) return false;
    this.applySnapshot(snapshot);
    return true;
  }

  canUndo() {
    return this.history.canUndo();
  }

  canRedo() {
    return this.history.canRedo();
  }

  // Aplica un snapshot del historial al estado vivo.
  applySnapshot(snapshot) {
    const copy = copySnapshot(snapshot);
    for (let i = 0; i < SIZE; i++) {
      // `set` rechaza las dadas; el snapshot ya las tiene, asi que solo se
      // escriben las celdas editables con su valor exacto.
      if (!this.board.isGiven(i)) this.board.values[i] = copy.values[i];
    }
    this.notes = copy.notes;
  }

  /** true si el tablero esta completo y sin conflictos. */
  isWon() {
    return isSolved(this.board);
  }

  /** true si el tablero esta lleno (valido o no). */
  isFull() {
    return this.board.isFull();
  }

  /** Serializa la partida para persistir (la usa U6). */
  toPersisted(extra = {}) {
    return {
      // `puzzle` son solo las dadas; los valores del jugador van en `values`.
      puzzle: this.puzzle,
      values: this.values(),
      notes: Array.from(this.notes),
      hintsUsed: this.hintsUsed,
      history: {
        cursor: this.history.cursor,
        entries: this.history.entries.map((entry) => ({
          values: Array.from(entry.values),
          notes: Array.from(entry.notes),
        })),
      },
      ...extra,
    };
  }

  /**
   * Reconstruye una partida desde un payload persistido. El puzzle marca las
   * dadas; los valores y notas se aplican encima.
   */
  static fromPersisted(payload) {
    if (!payload || !Array.isArray(payload.values) || payload.values.length !== SIZE) {
      return null;
    }
    const board = payload.puzzle
      ? Board.parse(payload.puzzle)
      : Board.empty();
    for (let i = 0; i < SIZE; i++) {
      if (board.isGiven(i)) continue;
      board.values[i] = payload.values[i] ?? EMPTY;
    }
    const notes = Array.isArray(payload.notes) && payload.notes.length === SIZE
      ? Array.from(payload.notes)
      : emptyNotes();
    const history = new History();
    if (payload.history && Array.isArray(payload.history.entries)) {
      history.entries = payload.history.entries.map((entry) => ({
        values: Array.from(entry.values ?? []),
        notes: Array.from(entry.notes ?? []),
      }));
      history.cursor = Math.min(
        Math.max(0, Number(payload.history.cursor) || 0),
        history.entries.length - 1,
      );
    }
    if (history.size() === 0) history.reset({ values: board.values, notes });
    return new GameState(board, { notes, history, hintsUsed: payload.hintsUsed });
  }
}

// Primera celda editable; si el puzzle viniera lleno, cae en la 0.
function firstEditable(board) {
  for (let i = 0; i < SIZE; i++) {
    if (!board.isGiven(i)) return i;
  }
  return 0;
}

// String de 81 caracteres con solo las dadas (las editables van a 0).
function givensString(board) {
  let out = "";
  for (let i = 0; i < SIZE; i++) {
    out += board.isGiven(i) ? String(board.value(i)) : "0";
  }
  return out;
}
