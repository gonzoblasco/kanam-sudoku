// U7 - Pistas: elige la deduccion mas simple y normaliza el resaltado.
//
// Logica pura, sin DOM: recibe un estado y devuelve la deduccion, su texto y una
// estructura de resaltado normalizada. El texto NO se escribe aca: sale del motor
// de explicaciones (`explain.js`). La UI solo lo presenta.
//
// Regla dura: la pista **no aplica** la jugada. Muestra el razonamiento y el
// jugador decide. Aplicarla sola la convertiria en un solver.

import { DIFFICULTY_MAX_TIER } from "../core/rater.js";
import { findDeduction, verifyDeduction } from "../core/techniques.js";
import { UNITS } from "../core/analysis.js";

/** Nivel por defecto si la partida no trae dificultad medida. */
const FALLBACK_MAX_TIER = 1;

const UNIT_TYPES = new Set(["row", "col", "box"]);

function isUnit(value) {
  return Boolean(
    value && typeof value === "object" && UNIT_TYPES.has(value.type) && Number.isInteger(value.index),
  );
}

/** Tier maximo de pistas segun la dificultad de la partida. */
export function hintMaxTier(difficulty) {
  return DIFFICULTY_MAX_TIER[difficulty] ?? FALLBACK_MAX_TIER;
}

/**
 * Normaliza que resaltar de una deduccion. Robusta a `unit: null`, `byDigit` nulo
 * o vacio, y a las formas extra de cada familia (`line`, `box`, `fish`, `wing`).
 *
 * @param {object} deduction
 * @returns {{cells: number[], units: Array<{type: string, index: number}>, targets: number[]}}
 */
export function hintHighlight(deduction) {
  const evidence = deduction?.evidence ?? {};
  const cells = new Set();

  const addCells = (list) => {
    if (!Array.isArray(list)) return;
    for (const cell of list) if (Number.isInteger(cell)) cells.add(cell);
  };

  addCells(evidence.cells);
  // byDigit puede faltar o venir vacio: se ignora sin romper.
  if (Array.isArray(evidence.byDigit)) {
    for (const entry of evidence.byDigit) addCells(entry?.cells);
  }

  // Estructuras de familia.
  if (evidence.wing) {
    if (Number.isInteger(evidence.wing.pivot?.cell)) cells.add(evidence.wing.pivot.cell);
    for (const pincer of evidence.wing.pincers ?? []) {
      if (Number.isInteger(pincer?.cell)) cells.add(pincer.cell);
    }
  }

  const units = [];
  const seenUnits = new Set();
  const addUnit = (unit) => {
    if (!isUnit(unit)) return;
    const key = `${unit.type}:${unit.index}`;
    if (seenUnits.has(key)) return;
    seenUnits.add(key);
    units.push({ type: unit.type, index: unit.index });
  };
  addUnit(evidence.unit);
  addUnit(evidence.line);
  addUnit(evidence.box);
  if (evidence.fish) {
    for (const unit of evidence.fish.base ?? []) addUnit(unit);
    for (const unit of evidence.fish.cover ?? []) addUnit(unit);
  }

  // Objetivos de la deduccion (lo que se colocaria o eliminaria).
  const targets = new Set();
  if (Array.isArray(deduction?.targets)) {
    for (const target of deduction.targets) {
      if (Number.isInteger(target?.cell)) targets.add(target.cell);
    }
  }

  return {
    cells: [...cells].sort((a, b) => a - b),
    units,
    targets: [...targets].sort((a, b) => a - b),
  };
}

/**
 * Celda de todas las unidades de un resaltado. La UI necesita saber que celdas
 * pintar cuando el evidence señala una unidad entera (fila, columna o caja).
 *
 * @param {{units: Array<{type: string, index: number}>}} highlight
 * @returns {number[]} celdas de esas unidades, ascendente y sin repetir
 */
export function unitCells(highlight) {
  const cells = new Set();
  for (const unit of highlight?.units ?? []) {
    const found = UNITS.find((u) => u.type === unit.type && u.index === unit.index);
    if (!found) continue;
    for (const cell of found.cells) cells.add(cell);
  }
  return [...cells].sort((a, b) => a - b);
}

/**
 * Busca la pista mas simple aplicable y devuelve todo lo que la UI necesita.
 *
 * @param {import("./state.js").GameState} game
 * @param {{maxTier?: number}} [options]
 * @returns {{found: true, deduction: object, text: string, highlight: object, technique: string}
 *          | {found: false, message: string}}
 */
export function hintFor(game, options = {}) {
  const maxTier = options.maxTier ?? FALLBACK_MAX_TIER;
  const deduction = findDeduction(game.analysisState(), { maxTier });

  if (!deduction) {
    return {
      found: false,
      message:
        `No tengo una tecnica mas simple para esta posicion (hasta el nivel de esta ` +
        `partida). Puede que necesites una tecnica mas avanzada o que haya un numero mal cargado.`,
    };
  }

  // Defensa: el motor verifica antes de aplicar; una pista tambien se verifica.
  const check = verifyDeduction(game.analysisState(), deduction);
  if (!check.ok) {
    return {
      found: false,
      message:
        `Encontre un razonamiento pero no pude justificarlo en este tablero ` +
        `(${check.reason}). Revisa los numeros cargados.`,
    };
  }

  return {
    found: true,
    technique: deduction.technique,
    deduction,
    text: deduction.text,
    highlight: hintHighlight(deduction),
    unitCells: unitCells(hintHighlight(deduction)),
  };
}
