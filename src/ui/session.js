// U6 - Sesion de juego: une partida, cronometro, estadisticas y persistencia.
//
// Esta capa es pura y testeable: recibe el almacenamiento y el generador
// inyectados, asi que los tests usan un doble de localStorage y una semilla fija
// sin tocar el navegador.
//
// Regla dura (FR-6): las estadisticas se actualizan SOLO al ganar. Abandonar no
// llama a `recordWin`, asi que no ensucia nada.

import { DIFFICULTY } from "../core/rater.js";
import { generatePuzzle } from "../core/generator.js";
import { GameState } from "./state.js";
import { Timer } from "./timer.js";
import { hintFor, hintMaxTier } from "./hints.js";
import {
  loadGame,
  saveGame,
  clearGame,
  loadStats,
  saveStats,
  emptyStats,
  recordWin,
} from "./persistence.js";

/** Niveles elegibles en la UI, en orden de dificultad. */
export const LEVELS = Object.freeze([DIFFICULTY.EASY, DIFFICULTY.MEDIUM, DIFFICULTY.HARD]);

/**
 * Sesion de juego en vivo.
 *
 * @param {{storage?: object, generate?: Function, now?: () => number, seed?: number|null}} [options]
 */
export class GameSession {
  constructor(options = {}) {
    this.storage = options.storage;
    this.generate = options.generate ?? generatePuzzle;
    this.now = options.now ?? (() => Date.now());
    this.fixedSeed = options.seed ?? null;

    this.game = null;
    this.timer = new Timer(this.now);
    this.stats = emptyStats();
    this.difficulty = null;
    this.won = false;
    this.recovered = null; // aviso si habia algo guardado y no se pudo usar
  }

  /**
   * Carga lo persistido: estadisticas siempre, y la partida en curso si la hay.
   * @returns {{restored: boolean, recovered: boolean, reason: string|null}}
   */
  load() {
    const statsLoad = loadStats(this.storage);
    this.stats = statsLoad.stats;

    const gameLoad = loadGame(this.storage);
    if (gameLoad.game) {
      const restored = GameState.fromPersisted(gameLoad.game);
      if (restored) {
        this.game = restored;
        this.difficulty = gameLoad.game.difficulty ?? null;
        this.timer = Timer.fromJSON({ elapsedMs: gameLoad.game.elapsedMs, stopped: gameLoad.game.won }, this.now);
        this.won = Boolean(gameLoad.game.won);
        this.recovered = null;
        return { restored: true, recovered: false, reason: null };
      }
    }

    // Sin partida util: se arranca una nueva y se informa si algo estaba roto.
    this.recovered = gameLoad.recovered ? gameLoad.reason : null;
    this.startNew(this.difficulty ?? DIFFICULTY.EASY);
    return { restored: false, recovered: gameLoad.recovered, reason: gameLoad.reason };
  }

  /** Empieza una partida nueva del nivel pedido. */
  startNew(difficulty = DIFFICULTY.EASY, seed = this.fixedSeed) {
    const options = { difficulty };
    if (seed != null) options.seed = seed;
    const result = this.generate(options);
    this.game = GameState.fromPuzzle(result.puzzle);
    this.difficulty = result.measured ?? difficulty;
    this.requested = difficulty;
    this.won = false;
    this.timer = new Timer(this.now);
    this.timer.start();
    this.persist();
    return result;
  }

  /** Reinicia la partida actual (mismo nivel, semilla nueva). */
  restart() {
    return this.startNew(this.requested ?? this.difficulty ?? DIFFICULTY.EASY);
  }

  /** true si hay partida cargada. */
  hasGame() {
    return this.game != null;
  }

  place(index, digit) {
    const changed = this.game.place(index, digit);
    if (changed) this.afterMutation();
    return changed;
  }

  clear(index) {
    const changed = this.game.clear(index);
    if (changed) this.afterMutation();
    return changed;
  }

  toggleNote(index, digit) {
    const changed = this.game.toggleNote(index, digit);
    if (changed) this.afterMutation();
    return changed;
  }

  fillAutoNotes() {
    this.game.fillAutoNotes();
    this.afterMutation();
    return true;
  }

  clearAllNotes() {
    this.game.clearAllNotes();
    this.afterMutation();
    return true;
  }

  /**
   * Devuelve la pista mas simple aplicable y la cuenta. NO aplica la jugada: la
   * pista muestra el razonamiento y el jugador decide.
   */
  hint() {
    const result = hintFor(this.game, { maxTier: hintMaxTier(this.difficulty) });
    if (result.found) {
      this.game.registerHint();
      this.persist();
    }
    return result;
  }

  undo() {
    const changed = this.game.undo();
    if (changed) this.persist();
    return changed;
  }

  redo() {
    const changed = this.game.redo();
    if (changed) this.persist();
    return changed;
  }

  // Despues de una mutacion: revisa victoria y persiste.
  afterMutation() {
    if (!this.won && this.game.isWon()) this.win();
    else this.persist();
  }

  /** Registra la victoria: detiene el cronometro y actualiza estadisticas. */
  win() {
    if (this.won) return false;
    this.won = true;
    this.timer.stop();
    this.stats = recordWin(this.stats, {
      difficulty: this.difficulty,
      ms: this.timer.elapsed(),
      at: this.now(),
    });
    saveStats(this.storage, this.stats);
    this.persist();
    return true;
  }

  /**
   * Abandona la partida: borra lo guardado y NO toca las estadisticas.
   */
  abandon() {
    clearGame(this.storage);
    return true;
  }

  /** Pausa o reanuda el cronometro. */
  togglePause() {
    if (this.timer.isStopped()) return false;
    if (this.timer.isRunning()) {
      this.timer.pause();
      this.persist();
      return false;
    }
    this.timer.start();
    this.persist();
    return true;
  }

  /** Persiste la partida en curso. */
  persist() {
    if (!this.game) return false;
    return saveGame(this.storage, {
      puzzle: this.game.puzzle,
      values: this.game.values(),
      notes: Array.from(this.game.notes),
      elapsedMs: this.timer.elapsed(),
      difficulty: this.difficulty,
      won: this.won,
      hintsUsed: this.game.hintsUsed,
      history: {
        cursor: this.game.history.cursor,
        entries: this.game.history.entries.map((entry) => ({
          values: Array.from(entry.values),
          notes: Array.from(entry.notes),
        })),
      },
    });
  }
}
