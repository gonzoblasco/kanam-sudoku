// U2 - Tests del rater base.

import test from "node:test";
import assert from "node:assert/strict";

import { DIFFICULTY, difficultyOfTier, isEasy, isHard, ratePuzzle } from "../src/core/rater.js";
import { countSolutions } from "../src/core/solver.js";
import { isSolved } from "../src/core/validator.js";

function valuesOf(text) {
  return text.split("").map(Number);
}

// Puzzle resoluble con tier 0 solo (singles), solucion unica verificada.
const EASY = "600912000050368091900000006000520130540090072200047500790001200060280007120479653";
// Puzzle de solucion unica que requiere tier 1 (locked candidates + pair).
const MEDIUM = "000009040060007008109000007281004050500000010000800004050000900008601000400030700";
// Puzzle unico que requiere tier 2: no se resuelve con tier <= 1, si con tier 2.
const HARD = "003010009050000420100400080700008500002005064000034000010300000009600000000000042";
// Puzzle unico que necesita tier 3 (todavia sin tecnicas implementadas).
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

test("ratePuzzle: puzzle dificil resuelto, tier 2, dificultad dificil", () => {
  // Antes de U3a este puzzle no se resolvia (necesita una tecnica de tier 2).
  const result = ratePuzzle(valuesOf(HARD), { maxTier: 2 });
  assert.equal(result.solved, true);
  assert.equal(result.maxTier, 2);
  assert.equal(result.difficulty, DIFFICULTY.HARD);
  assert.ok(result.steps.some((step) => step.tier === 2));
  // y NO se resuelve con el rater de U2 (tier <= 1): es un puzzle de nivel nuevo
  assert.equal(ratePuzzle(valuesOf(HARD), { maxTier: 1 }).solved, false);
});

test("ratePuzzle: la escalera reconoce los 4 niveles de la spec", () => {
  assert.equal(difficultyOfTier(0), DIFFICULTY.EASY);
  assert.equal(difficultyOfTier(1), DIFFICULTY.MEDIUM);
  assert.equal(difficultyOfTier(2), DIFFICULTY.HARD);
  assert.equal(difficultyOfTier(3), DIFFICULTY.EXPERT);
  assert.equal(difficultyOfTier(4), null, "un tier fuera de la escalera no tiene nivel");
  // y no se resuelve un nivel que no existe
  assert.equal(Object.values(DIFFICULTY).length, 4);
});

test("ratePuzzle: BEYOND llega a tier 3 pero sigue sin resolverse (honesto)", () => {
  // U3b implementa tecnicas de tier 3, asi que el rater ya prueba esa banda. Con
  // maxTier 3 BEYOND usa tecnicas de tier 3 y sube a maxTier 3, pero el puzzle no
  // se resuelve: necesita una tecnica mas alla de la escalera implementada
  // (chains/ALS), no una que exista y este mal. El rater no inventa el nivel.
  const reached = ratePuzzle(valuesOf(BEYOND), { maxTier: 3 });
  assert.equal(reached.solved, false, "BEYOND sigue sin resolverse");
  assert.equal(reached.difficulty, null);
  assert.equal(reached.maxTier, 3, "llego a la banda de tier 3");

  // Con tier 2 se queda en tier 1: la tecnica que le falta es de tier 3.
  const limited = ratePuzzle(valuesOf(BEYOND), { maxTier: 2 });
  assert.equal(limited.solved, false);
  assert.ok(limited.maxTier <= 2);
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

test("isHard: verdadero hasta tier 2, falso para tier 3", () => {
  assert.equal(isHard(valuesOf(MEDIUM)), true);
  assert.equal(isHard(valuesOf(HARD)), true);
  assert.equal(isHard(valuesOf(BEYOND)), false);
});

test("ratePuzzle: cada paso trae su text llano (U3)", () => {
  const result = ratePuzzle(valuesOf(HARD), { maxTier: 2 });
  for (const step of result.steps) {
    assert.equal(typeof step.text, "string");
    assert.ok(step.text.length > 20, `${step.technique}: text vacio o muy corto`);
  }
});

test("los fixtures del rater son de solucion unica", () => {
  assert.equal(countSolutions(valuesOf(EASY), 2), 1);
  assert.equal(countSolutions(valuesOf(MEDIUM), 2), 1);
  assert.equal(countSolutions(valuesOf(HARD), 2), 1);
  assert.equal(countSolutions(valuesOf(BEYOND), 2), 1);
});
