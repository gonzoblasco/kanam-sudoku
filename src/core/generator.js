// U2 - Generador de puzzles con solucion unica garantizada.
//
// Proceso:
// 1. Construir una grilla completa valida (backtracking con orden aleatorio
//    segun la semilla).
// 2. Quitar celdas una a una, en orden aleatorio con la semilla, verificando
//    con `countSolutions(board, 2) === 1` despues de cada quita. Si la quita
//    rompe la unicidad, se revierte.
// 3. Frenar al llegar a la meta de huecos del nivel pedido.
//
// El generador es determinista: la misma semilla produce el mismo puzzle.

import { SIZE, DIM, EMPTY, rowOf, colOf, boxOf } from "./board.js";
import { popcount } from "./analysis.js";
import { countSolutions } from "./solver.js";
import { createRng, shuffle, deriveSeed } from "./random.js";
import { ratePuzzle, DIFFICULTY, DIFFICULTY_MAX_TIER } from "./rater.js";

/**
 * Metas de huecos por nivel. No se asume que mas huecos = mas dificil: la
 * dificultad real la decide el rater por tecnicas requeridas (SPEC 7bis), y esta
 * meta es solo el punto de partida de la quita.
 *
 * Calibrado empiricamente (2026-09-26): con 40 huecos el generador llega a tier
 * 0 casi siempre; para que el rater vea tier 1 hace falta subir la meta a ~57.
 * Dificil (tier 2) necesita mas huecos todavia. Ver `.knowledge/STATUS.md`.
 */
export const HOLE_TARGETS = Object.freeze({
  [DIFFICULTY.EASY]: 40,
  [DIFFICULTY.MEDIUM]: 57,
  [DIFFICULTY.HARD]: 58,
  [DIFFICULTY.EXPERT]: 58,
});

// Mascara de digitos ya usados en la fila, columna o caja de una casilla.
function usedMaskAt(values, cell) {
  let used = 0;
  const r = rowOf(cell);
  const c = colOf(cell);
  const b = boxOf(cell);
  for (let i = 0; i < SIZE; i++) {
    if (rowOf(i) !== r && colOf(i) !== c && boxOf(i) !== b) continue;
    if (i === cell) continue;
    const v = values[i];
    if (v !== EMPTY) used |= 1 << (v - 1);
  }
  return ~used & ((1 << DIM) - 1);
}

/**
 * Grilla completa valida generada con backtracking y heuristica MRV (elegir la
 * casilla con menos candidatos primero), con desempate aleatorio segun la
 * semilla.
 *
 * MRV es lo que hace esto viable: llenar casillas en un orden fijo y aleatorio
 * puede tardar muchisimo, porque el backtracking tropieza con callejones sin
 * salida. Eligiendo siempre la casilla mas restringida, el arbol de busqueda
 * queda chico y la generacion es instantanea.
 *
 * @param {number} seed
 * @returns {number[]} 81 valores 1..9
 */
export function generateSolvedGrid(seed) {
  const rng = createRng(seed);
  const values = new Array(SIZE).fill(EMPTY);

  const fill = () => {
    // Elegir la casilla vacia con menos candidatos (MRV).
    let bestCell = -1;
    let bestMask = 0;
    let bestCount = DIM + 1;
    for (let cell = 0; cell < SIZE; cell++) {
      if (values[cell] !== EMPTY) continue;
      const mask = usedMaskAt(values, cell);
      const count = popcount(mask);
      if (count < bestCount) {
        bestCell = cell;
        bestMask = mask;
        bestCount = count;
        if (count <= 1) break;
      }
    }
    if (bestCell === -1) return true; // no quedan casillas vacias
    if (bestCount === 0) return false; // callejon sin salida

    // Digitos candidatos de la casilla elegida, en orden aleatorio.
    const candidates = [];
    for (let d = 1; d <= DIM; d++) if (bestMask & (1 << (d - 1))) candidates.push(d);
    for (const digit of shuffle(candidates, rng)) {
      values[bestCell] = digit;
      if (fill()) return true;
      values[bestCell] = EMPTY;
    }
    return false;
  };

  if (!fill()) throw new Error("no se pudo generar una grilla completa");
  return values;
}

/**
 * Quita celdas de una grilla completa manteniendo la unicidad.
 *
 * @param {number[]} solution grilla completa
 * @param {number} targetHoles cantidad de huecos a intentar
 * @param {() => number} rng
 * @returns {{puzzle: number[], holes: number}}
 */
export function carve(solution, targetHoles, rng) {
  const puzzle = Array.from(solution);
  const order = shuffle([...Array(SIZE).keys()], rng);
  let holes = 0;

  for (const cell of order) {
    if (holes >= targetHoles) break;
    const saved = puzzle[cell];
    puzzle[cell] = EMPTY;
    if (countSolutions(puzzle, 2) === 1) {
      holes++;
    } else {
      puzzle[cell] = saved; // la quita rompe la unicidad: se revierte
    }
  }

  return { puzzle, holes };
}

/**
 * Genera un puzzle con solucion unica para un nivel pedido.
 *
 * La dificultad se mide por tecnicas requeridas (SPEC 7bis), no por huecos. El
 * generador intenta varias semillas derivadas hasta encontrar un puzzle cuyo
 * tier medido coincida con el nivel pedido; si no lo logra tras `maxAttempts`,
 * devuelve el ultimo candidato con `difficulty.measured` distinto del pedido y
 * `matched: false`, sin mentir sobre el nivel.
 *
 * @param {{seed?: number, difficulty?: string, targetHoles?: number, maxAttempts?: number}} [options]
 * @returns {{
 *   puzzle: string, solution: string, holes: number, seed: number, attempt: number,
 *   requested: string, measured: string | null, maxTier: number, matched: boolean,
 *   difficulty: object, solved: boolean, steps: object[]
 * }}
 */
export function generatePuzzle(options = {}) {
  const {
    seed = 1,
    difficulty = DIFFICULTY.EASY,
    targetHoles = HOLE_TARGETS[difficulty] ?? HOLE_TARGETS[DIFFICULTY.EASY],
    maxAttempts = 60,
  } = options;
  // Medir con la parte de la escalera del nivel pedido: un puzzle "dificil" se
  // mide con maxTier 2, no con el rater de U2.
  const maxTier = DIFFICULTY_MAX_TIER[difficulty] ?? 1;

  let fallback = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const attemptSeed = deriveSeed(seed, attempt);
    const rng = createRng(attemptSeed);
    const solution = generateSolvedGrid(attemptSeed);
    const { puzzle, holes } = carve(solution, targetHoles, rng);
    const rating = ratePuzzle(puzzle, { maxTier });

    const result = {
      puzzle: puzzle.join(""),
      solution: solution.join(""),
      holes,
      seed,
      attempt,
      requested: difficulty,
      measured: rating.difficulty,
      maxTier: rating.maxTier,
      matched: rating.difficulty === difficulty,
      difficulty: rating,
      solved: rating.solved,
      steps: rating.steps,
    };

    if (result.matched) return result;
    if (!fallback) fallback = result;
  }

  return fallback;
}

/**
 * Genera N puzzles del nivel pedido con semillas consecutivas. Pensado para
 * tests y para el banco de puzzles.
 *
 * @param {number} count
 * @param {{seed?: number, difficulty?: string, targetHoles?: number, maxAttempts?: number}} [options]
 * @returns {ReturnType<typeof generatePuzzle>[]}
 */
export function generateMany(count, options = {}) {
  const { seed = 1 } = options;
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(generatePuzzle({ ...options, seed: deriveSeed(seed, i) }));
  }
  return out;
}
