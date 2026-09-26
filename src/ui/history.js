// U5 - Historial reversible (undo / redo), logica pura y testeable.
//
// Modelo: snapshots completos. Cada mutacion guarda una copia del estado
// (valores + notas). Deshacer devuelve la copia exacta, asi que no hay forma de
// perder un cambio ni de dejar las notas desincronizadas: es lo mas simple que
// cumple "sin perdida de estado".
//
// Tope: `LIMIT` entradas. Una partida puede tener cientos de jugadas; 1000
// cubre de sobra una partida larga sin acumular memoria sin control. Al pasarse,
// se descarta la entrada mas vieja (no se pierde el estado actual).

/** Tope de entradas del historial. */
export const LIMIT = 1000;

/** Copia profunda de un snapshot {values, notes}. */
export function copySnapshot(snapshot) {
  return {
    values: Array.from(snapshot.values),
    notes: Array.from(snapshot.notes),
  };
}

/** true si dos snapshots son identicos (valores y notas). */
export function sameSnapshot(a, b) {
  if (a.values.length !== b.values.length) return false;
  if (a.notes.length !== b.notes.length) return false;
  for (let i = 0; i < a.values.length; i++) {
    if (a.values[i] !== b.values[i]) return false;
    if (a.notes[i] !== b.notes[i]) return false;
  }
  return true;
}

/**
 * Historial de snapshots con puntero.
 *
 * Invariante: `entries[cursor]` es siempre el estado actual. Deshacer mueve el
 * puntero, no borra: por eso rehacer puede volver.
 */
export class History {
  constructor(limit = LIMIT) {
    this.limit = limit;
    this.entries = [];
    this.cursor = -1;
  }

  /** Arranca de cero con un estado inicial. */
  reset(snapshot) {
    if (snapshot) this.entries = [copySnapshot(snapshot)];
    else this.entries = [];
    this.cursor = this.entries.length - 1;
  }

  /** true si hay algo que deshacer. */
  canUndo() {
    return this.cursor > 0;
  }

  /** true si hay algo que rehacer. */
  canRedo() {
    return this.cursor >= 0 && this.cursor < this.entries.length - 1;
  }

  /** Cantidad de entradas guardadas. */
  size() {
    return this.entries.length;
  }

  /** Estado actual (copia), o null si el historial esta vacio. */
  current() {
    if (this.cursor < 0) return null;
    return copySnapshot(this.entries[this.cursor]);
  }

  /**
   * Registra un estado nuevo. Descarta la rama de rehacer (como cualquier editor)
   * y aplica el tope.
   */
  push(snapshot) {
    // Nada nuevo debajo: no duplicar entradas identicas seguidas.
    if (this.cursor >= 0 && sameSnapshot(this.entries[this.cursor], snapshot)) {
      return this.current();
    }
    this.entries.splice(this.cursor + 1);
    this.entries.push(copySnapshot(snapshot));
    if (this.entries.length > this.limit) {
      this.entries.splice(0, this.entries.length - this.limit);
    }
    this.cursor = this.entries.length - 1;
    return this.current();
  }

  /** Estado anterior, o null si no hay. */
  undo() {
    if (!this.canUndo()) return null;
    this.cursor--;
    return this.current();
  }

  /** Estado siguiente, o null si no hay. */
  redo() {
    if (!this.canRedo()) return null;
    this.cursor++;
    return this.current();
  }
}
