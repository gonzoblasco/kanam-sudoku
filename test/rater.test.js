// U2 - Tests del rater base.

import test from "node:test";
import assert from "node:assert/strict";

import { DIFFICULTY, isEasy, ratePuzzle } from "../src/core/rater.js";
import { countSolutions } from "../src/core/solver.js";
import { isSolved } from "../src/core/validator.js";

function valuesOf(text) {
  return text.split("").map(Number);
}

// Puzzle resoluble con tier 0 solo (singles), solucion unica verificada.
const EASY = "600912000050368091900000006000520130540090072200047500790001200060280007120479653";
// Puzzle de solucion unica que requiere tier 1 (locked candidates + pair).
const MEDIUM = "000009040060007008109000007281004050500000010000800004050000900008601000400030700";
// Puzzle unico que el rater base NO puede resolver (requiere tier 2+).
const BEYOND = "005300000800000020070010500400005300010070006003200080060500009004000030000009700";

test("ratePuzzle: puzzle facil resuelto, tier 0, dificultad facil", () => {
  const result = ratePuzzle(valuesOf(EASY), { maxTier: 1 });
  assert.equal(result.solved, true);
  assert.equal(result.maxTier, 0);
  assert.equal(result.difficulty, DIFFICULTY.EASY);
  assert.equal(result.unsolvedTier, null);
  assert.ok(result.steps.length > 0);
});

test("ratePuzzle: puzzle medio resuelto, tier 1, dificultad medio", () => {
  const result = ratePuzzle(valuesOf(MEDIUM), { maxTier: 1 });
  assert.equal(result.solved, true);
  assert.equal(result.maxTier, 1);
  assert.equal(result.difficulty, DIFFICULTY.MEDIUM);
  // tiene al menos un paso de tier 1
  assert.ok(result.steps.some((step) => step.tier === 1));
});

test("ratePuzzle: no inventa tier cuando no puede resolver", () => {
  const result = ratePuzzle(valuesOf(BEYOND), { maxTier: 1 });
  assert.equal(result.solved, false);
  assert.equal(result.difficulty, null);
  assert.equal(result.unsolvedTier, result.maxTier);
  assert.ok(result.maxTier <= 1, "el rater base no debe pasar de tier 1");
});

test("ratePuzzle: los pasos son reales (el rater reconstruye un tablero valido)", () => {
  const values = valuesOf(MEDIUM);
  const result = ratePuzzle(values, { maxTier: 1 });
  // reaplicar los pasos sobre el estado inicial debe reproducir la solucion
  const replay = values.slice();
  for (const step of result.steps) {
    for (const target of step.targets) {
      if (target.kind === "place") {
        assert.equal(replay[target.cell], 0, "no se puede colocar sobre una casilla llena");
        replay[target.cell] = target.digit;
      }
    }
  }
  assert.equal(isSolved(replay), true, "los pasos reportados no resuelven el tablero");
});

test("ratePuzzle: no muta la entrada", () => {
  const values = valuesOf(MEDIUM);
  const before = values.join("");
  ratePuzzle(values, { maxTier: 1 });
  assert.equal(values.join(""), before);
});

test("ratePuzzle: techniqueCounts suma la cantidad de pasos", () => {
  const result = ratePuzzle(valuesOf(MEDIUM), { maxTier: 1 });
  const total = Object.values(result.techniqueCounts).reduce((a, b) => a + b, 0);
  assert.equal(total, result.steps.length);
});

test("ratePuzzle: maxTier acota las tecnicas consideradas", () => {
  const onlySingles = ratePuzzle(valuesOf(MEDIUM), { maxTier: 0 });
  assert.equal(onlySingles.maxTier, onlySingles.solved ? 0 : onlySingles.maxTier);
  assert.ok(onlySingles.steps.every((step) => step.tier === 0));
});

test("isEasy: verdadero solo para puzzles de singles", () => {
  assert.equal(isEasy(valuesOf(EASY)), true);
  assert.equal(isEasy(valuesOf(MEDIUM)), false);
});

test("los fixtures del rater son de solucion unica", () => {
  assert.equal(countSolutions(valuesOf(EASY), 2), 1);
  assert.equal(countSolutions(valuesOf(MEDIUM), 2), 1);
  assert.equal(countSolutions(valuesOf(BEYOND), 2), 1);
});
