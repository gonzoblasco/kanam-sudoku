// U2 - Tests del generador de puzzles con solucion unica.

import test from "node:test";
import assert from "node:assert/strict";

import {
  HOLE_TARGETS,
  carve,
  generateMany,
  generatePuzzle,
  generateSolvedGrid,
} from "../src/core/generator.js";
import { countSolutions, solve } from "../src/core/solver.js";
import { isSolved } from "../src/core/validator.js";
import { createRng } from "../src/core/random.js";
import { DIFFICULTY, ratePuzzle } from "../src/core/rater.js";

function valuesOf(text) {
  return text.split("").map(Number);
}

test("generateSolvedGrid: grilla completa y valida, determinista", () => {
  const a = generateSolvedGrid(42);
  const b = generateSolvedGrid(42);
  assert.deepEqual(a, b, "misma semilla, misma grilla");
  assert.equal(isSolved(a), true);
  assert.equal(a.length, 81);
  assert.ok(a.every((v) => v >= 1 && v <= 9));
});

test("generateSolvedGrid: semillas distintas dan grillas distintas", () => {
  assert.notDeepEqual(generateSolvedGrid(1), generateSolvedGrid(2));
});

test("carve: nunca deja mas de una solucion", () => {
  const solution = generateSolvedGrid(7);
  const { puzzle } = carve(solution, 50, createRng(7));
  assert.equal(countSolutions(puzzle, 2), 1);
  // la solucion sigue siendo solucion del puzzle recortado
  for (let i = 0; i < 81; i++) {
    if (puzzle[i] !== 0) assert.equal(puzzle[i], solution[i]);
  }
});

test("generatePuzzle: la solucion resuelve el puzzle", () => {
  const result = generatePuzzle({ seed: 100, difficulty: DIFFICULTY.MEDIUM });
  assert.equal(solve(valuesOf(result.puzzle)).status, "solved");
  assert.equal(solve(valuesOf(result.puzzle)).solution.join(""), result.solution);
});

test("generatePuzzle: determinismo (misma semilla, mismo puzzle)", () => {
  const a = generatePuzzle({ seed: 12345, difficulty: DIFFICULTY.MEDIUM });
  const b = generatePuzzle({ seed: 12345, difficulty: DIFFICULTY.MEDIUM });
  assert.equal(a.puzzle, b.puzzle);
  assert.equal(a.solution, b.solution);
  assert.equal(a.attempt, b.attempt);
});

test("generatePuzzle: semillas distintas dan puzzles distintos", () => {
  const a = generatePuzzle({ seed: 1, difficulty: DIFFICULTY.MEDIUM });
  const b = generatePuzzle({ seed: 2, difficulty: DIFFICULTY.MEDIUM });
  assert.notEqual(a.puzzle, b.puzzle);
});

// El test que prueba la unicidad de verdad: generar N puzzles y verificar cada
// uno con el solver. No alcanza con confiar en el algoritmo.
test("unicidad real: 20 puzzles de nivel facil tienen solucion unica", () => {
  const puzzles = generateMany(20, { seed: 900, difficulty: DIFFICULTY.EASY });
  assert.equal(puzzles.length, 20);
  for (const result of puzzles) {
    assert.equal(
      countSolutions(valuesOf(result.puzzle), 2),
      1,
      `puzzle sin solucion unica (seed ${result.seed})`,
    );
  }
});

test("unicidad real: 20 puzzles de nivel medio tienen solucion unica", () => {
  const puzzles = generateMany(20, { seed: 901, difficulty: DIFFICULTY.MEDIUM });
  assert.equal(puzzles.length, 20);
  for (const result of puzzles) {
    assert.equal(
      countSolutions(valuesOf(result.puzzle), 2),
      1,
      `puzzle sin solucion unica (seed ${result.seed})`,
    );
  }
});

test("generatePuzzle: respeta la cantidad de huecos pedida", () => {
  const result = generatePuzzle({ seed: 55, targetHoles: 40, difficulty: DIFFICULTY.EASY });
  const holeCount = result.puzzle.split("").filter((c) => c === "0").length;
  assert.equal(holeCount, result.holes);
  assert.ok(holeCount <= 40);
});

test("generatePuzzle: facil se resuelve con tier 0", () => {
  const result = generatePuzzle({ seed: 77, difficulty: DIFFICULTY.EASY });
  assert.equal(result.matched, true);
  assert.equal(result.measured, DIFFICULTY.EASY);
  assert.equal(result.maxTier, 0);
  assert.equal(result.solved, true);
});

test("generatePuzzle: medio se resuelve con tier 1", () => {
  const result = generatePuzzle({ seed: 4242, difficulty: DIFFICULTY.MEDIUM });
  assert.equal(result.matched, true);
  assert.equal(result.measured, DIFFICULTY.MEDIUM);
  assert.equal(result.maxTier, 1);
});

test("generatePuzzle: cuando no matchea, no miente sobre el nivel", () => {
  // pedir tier 1 con una meta de huecos que casi nunca alcanza
  const result = generatePuzzle({ seed: 3, difficulty: DIFFICULTY.MEDIUM, targetHoles: 2, maxAttempts: 3 });
  assert.equal(result.matched, false);
  assert.notEqual(result.measured, DIFFICULTY.MEDIUM);
  assert.equal(result.maxTier >= 0, true);
});

test("generatePuzzle: dificil se resuelve con tier 2", () => {
  const result = generatePuzzle({ seed: 70001, difficulty: DIFFICULTY.HARD, maxAttempts: 40 });
  assert.equal(result.matched, true);
  assert.equal(result.measured, DIFFICULTY.HARD);
  assert.equal(result.maxTier, 2);
  assert.equal(result.solved, true);
  assert.equal(countSolutions(valuesOf(result.puzzle), 2), 1);
});

test("generatePuzzle: un dificil no se resuelve con el rater de U2 (tier <= 1)", () => {
  const result = generatePuzzle({ seed: 70001, difficulty: DIFFICULTY.HARD, maxAttempts: 40 });
  assert.equal(ratePuzzle(valuesOf(result.puzzle), { maxTier: 1 }).solved, false);
  assert.equal(ratePuzzle(valuesOf(result.puzzle), { maxTier: 2 }).difficulty, DIFFICULTY.HARD);
});

test("generatePuzzle: los pasos reportados son reales", () => {
  const result = generatePuzzle({ seed: 4242, difficulty: DIFFICULTY.MEDIUM });
  const rating = ratePuzzle(valuesOf(result.puzzle), { maxTier: 1 });
  assert.equal(rating.solved, true);
  assert.equal(rating.steps.length, result.steps.length);
});
