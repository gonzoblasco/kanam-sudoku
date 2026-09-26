// U4/U5/U6 - Render del tablero y controladores de UI.
//
// Vanilla JS, sin framework. La logica pura (navegacion, estado, notas, historial,
// cronometro, persistencia, sesion) vive en sus modulos; aca queda el cableado al
// DOM y el manejo de eventos.
//
// Accesibilidad (NFR-4): role grid/row/gridcell, un aria-label por celda que dice
// fila, columna, caja, valor, estado y anotaciones, foco visible, y ningun estado
// que dependa solo del color (dadas, seleccion, conflicto y modo nota llevan
// atributos y texto).

import { SIZE, DIM } from "../core/board.js";
import { CELL_STATE } from "./state.js";
import { cellAriaLabel, boardAriaLabel } from "./a11y.js";
import { ARROW_KEYS, isArrowKey, move } from "./navigation.js";
import { noteDigits, notesText } from "./notes.js";
import { formatDuration } from "./timer.js";
import { GameSession, LEVELS } from "./session.js";

const LEVEL_LABELS = Object.freeze({
  facil: "Facil",
  medio: "Medio",
  dificil: "Dificil",
});

/**
 * Monta el juego completo en un contenedor.
 *
 * @param {HTMLElement} root
 * @param {{session?: GameSession}} [options]
 */
export function mountGame(root, options = {}) {
  const session = options.session ?? new GameSession();
  const loadResult = session.load();

  let noteMode = false;

  // --- estructura ---
  const wrap = document.createElement("div");
  wrap.className = "game";

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "Controles de partida");

  const grid = document.createElement("div");
  grid.className = "board";
  grid.setAttribute("role", "grid");

  const cellEls = buildGrid();
  const noteStrip = document.createElement("div");
  noteStrip.className = "note-strip";
  noteStrip.setAttribute("aria-label", "Teclado de anotaciones");

  const status = document.createElement("p");
  status.className = "status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const help = document.createElement("p");
  help.className = "help";
  help.id = "ayuda";
  help.textContent =
    "Flechas para moverte, 1 a 9 para cargar, N para el modo nota, " +
    "Suprimir o Retroceso para borrar, Ctrl+Z y Ctrl+Shift+Z para deshacer y rehacer.";

  const statsPanel = document.createElement("section");
  statsPanel.className = "stats";
  statsPanel.setAttribute("aria-label", "Estadisticas");

  // --- controles ---
  const levelSelect = document.createElement("select");
  levelSelect.id = "nivel";
  levelSelect.setAttribute("aria-label", "Dificultad");
  for (const level of LEVELS) {
    const option = document.createElement("option");
    option.value = level;
    option.textContent = LEVEL_LABELS[level] ?? level;
    levelSelect.appendChild(option);
  }

  const timerEl = document.createElement("span");
  timerEl.className = "timer";
  timerEl.setAttribute("role", "timer");
  timerEl.setAttribute("aria-label", "Tiempo de juego");

  const noteButton = button("Modo nota", () => setNoteMode(!noteMode));
  noteButton.setAttribute("aria-pressed", "false");
  const autoNotesButton = button("Auto-anotar", () => {
    session.fillAutoNotes();
    refresh();
    status.textContent = "Anotaciones automaticas cargadas con los candidatos reales.";
  });
  const clearNotesButton = button("Borrar anotaciones", () => {
    session.clearAllNotes();
    refresh();
    status.textContent = "Anotaciones borradas.";
  });
  const undoButton = button("Deshacer", () => {
    if (!session.undo()) {
      status.textContent = "No hay nada para deshacer.";
      return;
    }
    refresh();
  });
  undoButton.id = "deshacer";
  const redoButton = button("Rehacer", () => {
    if (!session.redo()) {
      status.textContent = "No hay nada para rehacer.";
      return;
    }
    refresh();
  });
  redoButton.id = "rehacer";
  const pauseButton = button("Pausar", () => {
    const running = session.togglePause();
    status.textContent = running ? "Cronometro en marcha." : "Partida en pausa.";
    refresh();
  });
  const newButton = button("Partida nueva", () => {
    session.startNew(levelSelect.value, randomSeed());
    status.textContent = `Partida nueva de nivel ${LEVEL_LABELS[levelSelect.value] ?? levelSelect.value}.`;
    refresh();
    focusSelected();
  });
  const restartButton = button("Reiniciar", () => {
    session.restart();
    status.textContent = "Partida reiniciada.";
    refresh();
    focusSelected();
  });

  toolbar.append(
    labelWrap("Nivel", levelSelect),
    timerEl,
    noteButton,
    autoNotesButton,
    clearNotesButton,
    undoButton,
    redoButton,
    pauseButton,
    newButton,
    restartButton,
  );

  // Notas: teclado accesible de 9 botones (alterna), visible en modo nota.
  for (let d = 1; d <= 9; d++) {
    const b = button(String(d), () => toggleNoteAt(session.game.selected, d));
    b.className = "note-key";
    b.dataset.digit = String(d);
    noteStrip.appendChild(b);
  }

  wrap.append(toolbar, grid, noteStrip, status, help, statsPanel);
  root.append(wrap);

  // --- construccion del tablero ---
  function buildGrid() {
    const els = new Array(SIZE);
    for (let r = 0; r < DIM; r++) {
      const row = document.createElement("div");
      row.className = "board-row";
      row.setAttribute("role", "row");
      for (let c = 0; c < DIM; c++) {
        const index = r * DIM + c;
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.setAttribute("role", "gridcell");
        cell.dataset.index = String(index);
        if (c % 3 === 2 && c !== DIM - 1) cell.classList.add("box-right");
        if (r % 3 === 2 && r !== DIM - 1) cell.classList.add("box-bottom");
        cell.addEventListener("click", () => select(index));
        els[index] = cell;
        row.appendChild(cell);
      }
      grid.appendChild(row);
    }
    return els;
  }

  // --- seleccion ---
  function select(index) {
    session.game.selected = index;
    refresh();
    focusSelected();
  }

  function focusSelected() {
    cellEls[session.game.selected]?.focus();
  }

  // --- input ---
  function onKeyDown(event) {
    const index = session.game.selected;

    if (event.ctrlKey || event.metaKey) {
      if (event.key === "z" || event.key === "Z") {
        event.preventDefault();
        if (event.shiftKey) session.redo();
        else session.undo();
        refresh();
        return;
      }
      if (event.key === "y" || event.key === "Y") {
        event.preventDefault();
        session.redo();
        refresh();
        return;
      }
    }

    if (event.key === "n" || event.key === "N") {
      event.preventDefault();
      setNoteMode(!noteMode);
      return;
    }

    if (isArrowKey(event.key)) {
      event.preventDefault();
      select(move(index, ARROW_KEYS[event.key]));
      return;
    }

    if (event.key >= "1" && event.key <= "9") {
      event.preventDefault();
      typeDigit(index, Number(event.key));
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      erase(index);
    }
  }

  function typeDigit(index, digit) {
    if (noteMode) {
      toggleNoteAt(index, digit);
      return;
    }
    if (session.game.isGiven(index)) {
      status.textContent = `La casilla ${describe(index)} es un numero dado: no se puede cambiar.`;
      return;
    }
    session.place(index, digit);
    refresh();
    announce(index);
  }

  function toggleNoteAt(index, digit) {
    if (session.game.isGiven(index) || session.game.value(index) !== 0) {
      status.textContent = `En la casilla ${describe(index)} no se pueden anotar candidatos.`;
      return;
    }
    session.toggleNote(index, digit);
    refresh();
    announce(index);
  }

  function erase(index) {
    if (session.game.isGiven(index)) {
      status.textContent = `La casilla ${describe(index)} es un numero dado: no se puede borrar.`;
      return;
    }
    session.clear(index);
    refresh();
    announce(index);
  }

  function setNoteMode(on) {
    noteMode = on;
    noteButton.setAttribute("aria-pressed", on ? "true" : "false");
    noteButton.textContent = on ? "Modo nota: activado" : "Modo nota";
    wrap.classList.toggle("note-mode", on);
    status.textContent = on
      ? "Modo nota activado: 1 a 9 marca o desmarca candidatos."
      : "Modo nota desactivado: 1 a 9 carga el numero.";
  }

  function announce(index) {
    if (session.won) {
      status.textContent = winText();
      return;
    }
    status.textContent = cellAriaLabel(session.game, index);
  }

  function winText() {
    return `Resuelto en ${formatDuration(session.timer.elapsed())}. ` +
      "El tablero esta completo y sin conflictos.";
  }

  // --- render ---
  function refresh() {
    const game = session.game;
    const conflictSet = new Set(game.conflictingCells());

    for (let i = 0; i < SIZE; i++) {
      const el = cellEls[i];
      const state = game.stateOf(i);
      const value = game.value(i);
      const hasValue = value !== 0;
      const digits = hasValue ? [] : noteDigits(game.notes, i);

      // Valor o notas: nunca los dos (las notas de una celda con valor no se ven).
      if (hasValue) {
        el.textContent = String(value);
      } else if (digits.length > 0) {
        el.textContent = "";
        el.appendChild(noteGrid(digits));
      } else {
        el.textContent = "";
      }

      el.dataset.state = state;
      el.tabIndex = i === game.selected ? 0 : -1;
      el.setAttribute("aria-selected", i === game.selected ? "true" : "false");
      el.setAttribute("aria-label", cellAriaLabel(game, i));

      if (conflictSet.has(i)) el.setAttribute("aria-invalid", "true");
      else el.removeAttribute("aria-invalid");
    }

    grid.setAttribute("aria-label", boardAriaLabel(game));
    timerEl.textContent = formatDuration(session.timer.elapsed());
    timerEl.setAttribute("aria-label", `Tiempo de juego ${formatDuration(session.timer.elapsed())}`);
    pauseButton.textContent = session.timer.isRunning() ? "Pausar" : "Continuar";
    pauseButton.disabled = session.timer.isStopped();

    setDisabled(undoButton, !game.canUndo());
    setDisabled(redoButton, !game.canRedo());
    noteButton.setAttribute("aria-pressed", noteMode ? "true" : "false");
    wrap.classList.toggle("note-mode", noteMode);
    levelSelect.value = session.requested ?? session.difficulty ?? LEVELS[0];

    if (session.won) {
      status.textContent = winText();
    } else if (game.isFull()) {
      status.textContent = "El tablero esta lleno, pero hay numeros en conflicto.";
    } else if (session.timer.isStopped()) {
      // detenido pero no ganado: no deberia pasar, se deja claro
      status.textContent = "El cronometro esta detenido.";
    }

    renderStats();
  }

  function renderStats() {
    const stats = session.stats ?? { played: 0, won: 0, streak: 0, best: {}, results: [] };
    const bestLines = Object.entries(stats.best)
      .map(([level, ms]) => `${LEVEL_LABELS[level] ?? level}: ${formatDuration(ms)}`)
      .join(" | ");
    const recent = (stats.results ?? [])
      .slice(0, 5)
      .map((r) => `${LEVEL_LABELS[r.difficulty] ?? r.difficulty ?? "sin nivel"} en ${formatDuration(r.ms)}`)
      .join("; ");

    statsPanel.textContent = "";
    const title = document.createElement("h2");
    title.textContent = "Estadisticas";
    const summary = document.createElement("p");
    summary.textContent =
      `Jugadas: ${stats.played}. Ganadas: ${stats.won}. Racha: ${stats.streak}.`;
    const best = document.createElement("p");
    best.textContent = bestLines ? `Mejores tiempos -> ${bestLines}` : "Mejores tiempos: sin datos.";
    const historyTitle = document.createElement("h3");
    historyTitle.textContent = "Ultimas partidas";
    const history = document.createElement("p");
    history.textContent = recent || "Sin partidas terminadas.";
    statsPanel.append(title, summary, best, historyTitle, history);
  }

  // --- temporizador de refresco del reloj ---
  const tick = setInterval(() => {
    if (session.timer.isRunning()) {
      timerEl.textContent = formatDuration(session.timer.elapsed());
      timerEl.setAttribute(
        "aria-label",
        `Tiempo de juego ${formatDuration(session.timer.elapsed())}`,
      );
    }
  }, 1000);

  grid.addEventListener("keydown", onKeyDown);

  if (loadResult.recovered) {
    status.textContent = `No se pudo recuperar la partida guardada (${loadResult.reason}). Se empezo una nueva.`;
  }
  refresh();

  return {
    session,
    refresh,
    destroy() {
      clearInterval(tick);
      grid.removeEventListener("keydown", onKeyDown);
      root.innerHTML = "";
    },
  };
}

// --- helpers de DOM ---

function button(text, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}

function labelWrap(text, control) {
  const l = document.createElement("label");
  l.className = "field";
  l.textContent = text;
  control.id = control.id || "nivel";
  l.setAttribute("for", control.id);
  const span = document.createElement("span");
  span.append(control);
  l.append(span);
  return l;
}

// Deshabilitado visible y anunciado (aria-disabled), no solo atenuado.
function setDisabled(el, disabled) {
  el.disabled = disabled;
  if (disabled) el.setAttribute("aria-disabled", "true");
  else el.removeAttribute("aria-disabled");
}

// Rejilla 3x3 de candidatos, para mostrar las notas de una celda.
function noteGrid(digits) {
  const box = document.createElement("span");
  box.className = "notes";
  for (let d = 1; d <= 9; d++) {
    const s = document.createElement("span");
    s.textContent = digits.includes(d) ? String(d) : "";
    box.appendChild(s);
  }
  return box;
}

function describe(index) {
  return String(index + 1);
}

function randomSeed() {
  return Math.floor(Math.random() * 1_000_000_000);
}
