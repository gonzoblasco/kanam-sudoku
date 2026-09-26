// U6 - Cronometro de partida (logica pura, testeable).
//
// El tiempo se acumula en milisegundos "de juego", no en tiempo de pared: al
// pausar se congela el acumulado y el tiempo de pausa no cuenta. El reloj real
// se inyecta (`now`), asi que los tests no dependen de esperas de verdad.

/**
 * Formatea milisegundos como mm:ss (o h:mm:ss si pasa la hora).
 *
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Cronometro con pausa.
 *
 * `elapsed()` devuelve el tiempo de juego real: lo acumulado mas lo corrido desde
 * el ultimo arranque, y solo si esta corriendo. En pausa, lo corrido no cuenta.
 */
export class Timer {
  /**
   * @param {() => number} [now] reloj en ms (por defecto, Date.now)
   */
  constructor(now = () => Date.now()) {
    this.now = now;
    this.accumulated = 0; // ms de juego ya cerrados
    this.startedAt = null; // ms del reloj real cuando arranco, o null
    this.running = false;
    this.stopped = false; // se detuvo al resolver
  }

  /** Arranca o reanuda. No hace nada si ya corre o si se detuvo. */
  start() {
    if (this.running || this.stopped) return false;
    this.startedAt = this.now();
    this.running = true;
    return true;
  }

  /** Pausa: cierra el tramo abierto y lo suma al acumulado. */
  pause() {
    if (!this.running) return false;
    this.accumulated += this.now() - this.startedAt;
    this.startedAt = null;
    this.running = false;
    return true;
  }

  /** Se detiene al resolver y no vuelve a correr. */
  stop() {
    if (this.running) this.pause();
    this.stopped = true;
    return true;
  }

  /** true si corre. */
  isRunning() {
    return this.running;
  }

  /** true si se detuvo. */
  isStopped() {
    return this.stopped;
  }

  /** Milisegundos de juego transcurridos. */
  elapsed() {
    if (this.running) return this.accumulated + (this.now() - this.startedAt);
    return this.accumulated;
  }

  /** Tiempo legible mm:ss. */
  formatted() {
    return formatDuration(this.elapsed());
  }

  /** Estado serializable, para persistir la partida en curso. */
  toJSON() {
    // Se guarda el tiempo de juego EFECTIVO, no el tramo interno: si el
    // cronometro esta corriendo, `accumulated` todavia no incluye lo corrido y
    // serializarlo perderia tiempo.
    return {
      elapsedMs: this.elapsed(),
      stopped: this.stopped,
    };
  }

  /** Reconstruye un cronometro desde un estado guardado. */
  static fromJSON(data, now = () => Date.now()) {
    const timer = new Timer(now);
    timer.accumulated = Number(data.elapsedMs ?? data.accumulated) || 0;
    timer.stopped = Boolean(data.stopped);
    // Al reabrir se retoma pausado: es lo menos sorprendente (el tiempo de cierre
    // no cuenta) y el jugador decide cuando seguir.
    timer.running = false;
    timer.startedAt = null;
    return timer;
  }
}
