// U4 - Render del tablero y manejo de input.
//
// Vanilla JS, sin framework. La logica pura (navegacion, estado, etiquetas) vive
// en `navigation.js`, `state.js` y `a11y.js`; aca queda solo el cableado al DOM.
//
// Accesibilidad (NFR-4): role grid/row/gridcell, un aria-label por celda que dice
// fila, columna, caja, valor y estado, foco visible, y ningun estado que dependa
// solo del color (dadas, seleccion y conflicto llevan atributos y texto).

import { SIZE, DIM } from "../core/board.js";
import { GameState, CELL_STATE } from "./state.js";
import { cellAriaLabel, boardAriaLabel } from "./a11y.js";
import { ARROW_KEYS, isArrowKey, move } from "./navigation.js";

/**
 * Monta el juego en un contenedor.
 *
 * @param {HTMLElement} root
 * @param {{puzzle?: string, onWin?: () => void}} [options]
 * @returns {{game: GameState, render: () => void, destroy: () => void}}
 */
export function mountGame(root, options = {}) {
  const { puzzle, onWin } = options;
  const game = puzzle ? GameState.fromPuzzle(puzzle) : GameState.fromPuzzle(SAMPLE_PUZZLE);

  // Celdas del DOM, en el mismo orden que los indices del tablero.
  const cellEls = new Array(SIZE);
  const grid = document.createElement("div");
  grid.className = "board";
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", boardAriaLabel(game));

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
      // Marca de caja 3x3 para dibujar los bordes gruesos con CSS.
      if (c % 3 === 2 && c !== DIM - 1) cell.classList.add("box-right");
      if (r % 3 === 2 && r !== DIM - 1) cell.classList.add("box-bottom");
      cell.addEventListener("click", () => select(index));
      cellEls[index] = cell;
      row.appendChild(cell);
    }
    grid.appendChild(row);
  }

  const status = document.createElement("p");
  status.className = "status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  root.append(grid, buildHelp(), status);

  // --- seleccion y foco ---
  function select(index) {
    game.selected = index;
    render();
    cellEls[index].focus();
  }

  // --- teclado ---
  function onKeyDown(event) {
    const index = game.selected;

    if (isArrowKey(event.key)) {
      event.preventDefault();
      select(move(index, ARROW_KEYS[event.key]));
      return;
    }

    if (event.key >= "1" && event.key <= "9") {
      event.preventDefault();
      load(index, Number(event.key));
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      erase(index);
    }
  }

  function load(index, digit) {
    if (game.isGiven(index)) {
      status.textContent = `La casilla ${index + 1} es un numero dado: no se puede cambiar.`;
      return;
    }
    game.place(index, digit);
    render();
    announce(index);
  }

  function erase(index) {
    if (game.isGiven(index)) {
      status.textContent = `La casilla ${index + 1} es un numero dado: no se puede borrar.`;
      return;
    }
    game.clear(index);
    render();
    announce(index);
  }

  function announce(index) {
    const label = cellAriaLabel(game, index);
    status.textContent = label;
    if (game.isWon()) {
      status.textContent = "Resuelto. El tablero esta completo y sin conflictos.";
      if (typeof onWin === "function") onWin();
    }
  }

  grid.addEventListener("keydown", onKeyDown);

  // --- render ---
  function render() {
    const conflictSet = new Set(game.conflictingCells());
    for (let i = 0; i < SIZE; i++) {
      const el = cellEls[i];
      const state = game.stateOf(i);
      const value = game.value(i);

      el.textContent = value === 0 ? "" : String(value);
      el.dataset.state = state;
      el.tabIndex = i === game.selected ? 0 : -1;
      el.setAttribute("aria-selected", i === game.selected ? "true" : "false");
      el.setAttribute("aria-label", cellAriaLabel(game, i));

      // El conflicto se marca con atributo ademas de color (NFR-4).
      if (conflictSet.has(i)) el.setAttribute("aria-invalid", "true");
      else el.removeAttribute("aria-invalid");
    }
    grid.setAttribute("aria-label", boardAriaLabel(game));

    if (game.isWon()) {
      status.textContent = "Resuelto. El tablero esta completo y sin conflictos.";
    } else if (game.isFull()) {
      status.textContent = "El tablero esta lleno, pero hay numeros en conflicto.";
    }
  }

  render();

  return {
    game,
    render,
    destroy() {
      grid.removeEventListener("keydown", onKeyDown);
      root.innerHTML = "";
    },
  };
}

function buildHelp() {
  const help = document.createElement("p");
  help.className = "help";
  help.id = "ayuda";
  help.textContent =
    "Flechas para moverte, 1 a 9 para cargar un numero, Suprimir o Retroceso para borrar.";
  return help;
}

// Puzzle de ejemplo para el arranque del harness de desarrollo. Un puzzle real
// no entra en U4: la seleccion de dificultad y el generador en UI son U7+.
export const SAMPLE_PUZZLE =
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
