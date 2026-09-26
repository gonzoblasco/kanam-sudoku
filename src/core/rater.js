// U2 - Rater base (tier 0 y tier 1).
//
// El rater resuelve un puzzle aplicando tecnicas de menor a mayor ER y devuelve
// el tier de la tecnica mas dificil usada. Criterio: tecnicas requeridas, no
// cantidad de huecos (SPEC 7bis, research 4.2/4.3).
//
// Regla dura: cada paso que el rater reporta tiene que estar justificado por el
// estado del tablero en ese momento. Antes de aplicar una deduccion se verifica
// con `verifyDeduction`; si no pasa, el rater corta y lo reporta como error en
// vez de mentir con un paso.

import { analyze } from "./analysis.js";
import { findDeduction, verifyDeduction } from "./techniques.js";

/** Etiquetas de dificultad de la escalera (SPEC 7bis). */
export const DIFFICULTY = Object.freeze({
  EASY: "facil",
  MEDIUM: "medio",
  HARD: "dificil",
  EXPERT: "experto",
});

/**
 * Nivel de juego segun el tier de la tecnica mas dificil usada (SPEC 7bis).
 * La pertenencia a un tier la fija la tabla de niveles del research 4.2, no el
 * ER; aca solo se traduce tier -> nivel.
 */
const TIER_TO_DIFFICULTY = Object.freeze({
  [-1]: DIFFICULTY.EASY, // no hizo falta ninguna tecnica (tablero ya resuelto)
  0: DIFFICULTY.EASY,
  1: DIFFICULTY.MEDIUM,
  2: DIFFICULTY.HARD,
  3: DIFFICULTY.EXPERT,
});

/** Nivel de juego de un tier, o null si el tier no existe todavia. */
export function difficultyOfTier(tier) {
  return TIER_TO_DIFFICULTY[tier] ?? null;
}

/**
 * Tier maximo de cada nivel de juego. Lo usa el generador para medir un puzzle
 * del nivel pedido con la parte de la escalera que le corresponde.
 */
export const DIFFICULTY_MAX_TIER = Object.freeze({
  [DIFFICULTY.EASY]: 0,
  [DIFFICULTY.MEDIUM]: 1,
  [DIFFICULTY.HARD]: 2,
  [DIFFICULTY.EXPERT]: 3,
});

/**
 * Resultado de `ratePuzzle`.
 *
 * @typedef {Object} RateResult
 * @property {string | null} difficulty "facil" | "medio" | null si no se resolvio
 * @property {number} maxTier tier de la tecnica mas dificil usada (-1 si no hizo falta ninguna)
 * @property {object[]} steps deducciones aplicadas, en orden
 * @property {boolean} solved true si el rater completo el tablero con tier <= maxTier
 * @property {Object<string, number>} techniqueCounts pasos por tecnica
 * @property {number | null} unsolvedTier tier maximo alcanzado cuando no se resolvio
 * @property {string | null} error descripcion si un paso no paso la verificacion
 */

/**
 * Resuelve un puzzle con las tecnicas del catalogo hasta `maxTier`.
 *
 * @param {import("./board.js").Board | number[]} board
 * @param {{maxTier?: number, maxSteps?: number}} [options]
 * @returns {RateResult}
 */
export function ratePuzzle(board, options = {}) {
  const { maxTier = 1, maxSteps = 2000 } = options;
  const state = analyze(board);
  const steps = [];
  const techniqueCounts = {};

  while (!state.isSolved() && steps.length < maxSteps) {
    const deduction = findDeduction(state, { maxTier });
    if (!deduction) break;

    const check = verifyDeduction(state, deduction);
    if (!check.ok) {
      return {
        difficulty: null,
        maxTier: maxTierUsed(steps),
        steps,
        solved: false,
        techniqueCounts,
        unsolvedTier: maxTierUsed(steps),
        error: `paso sin justificacion (${deduction.technique}): ${check.reason}`,
      };
    }

    state.applyDeduction(deduction);
    steps.push(stepOf(deduction));
    techniqueCounts[deduction.technique] = (techniqueCounts[deduction.technique] ?? 0) + 1;
  }

  const solved = state.isSolved();
  const hardest = maxTierUsed(steps);
  return {
    difficulty: solved ? difficultyOfTier(hardest) : null,
    maxTier: hardest,
    steps,
    solved,
    techniqueCounts,
    unsolvedTier: solved ? null : hardest,
    error: null,
  };
}

/** Resumen de un paso: lo que consumen U3 (texto) y U7 (UI). */
function stepOf(deduction) {
  return {
    technique: deduction.technique,
    tier: deduction.tier,
    er: deduction.er,
    action: deduction.action,
    targets: deduction.targets,
    evidence: deduction.evidence,
  };
}

function maxTierUsed(steps) {
  return steps.reduce((max, step) => Math.max(max, step.tier), -1);
}

/**
 * true si el puzzle se resuelve solo con singles (tier 0). Es el corte de
 * "facil" de la escalera (research 4.2).
 */
export function isEasy(board, options = {}) {
  return ratePuzzle(board, { ...options, maxTier: 0 }).solved;
}

/**
 * true si el puzzle se resuelve con tecnicas de tier <= 2 (hasta Dificil).
 */
export function isHard(board, options = {}) {
  return ratePuzzle(board, { ...options, maxTier: 2 }).solved;
}
