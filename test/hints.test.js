// U7 - Tests de las pistas (logica pura).

import test from "node:test";
import assert from "node:assert/strict";

import { GameState } from "../src/ui/state.js";
import { hintFor, hintHighlight, hintMaxTier } from "../src/ui/hints.js";
import { countSolutions } from "../src/core/solver.js";
import { DIFFICULTY } from "../src/core/rater.js";
import { TECHNIQUES, findDeduction } from "../src/core/techniques.js";
import { analyze } from "../src/core/analysis.js";

const PUZZLE = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
// Puzzle que necesita tier 2 (no se resuelve con tier <= 1).
const HARD = "003010009050000420100400080700008500002005064000034000010300000009600000000000042";
// Puzzle unico que necesita tier 3 (todavia sin tecnicas implementadas).
const BEYOND = "005300000800000020070010500400005300010070006003200080060500009004000030000009700";
// Puzzle unico donde un analisis fresco no encuentra ninguna deduccion de
// tier <= 2: el caso real de "no hay pista" (necesita tier 3).
// Generado localmente con el generador (semilla 700936) y verificado.
const STUCK = "080520000100000000005007400007002308030045000000800006010000000900006074400908020";

test("hintMaxTier: sigue la dificultad de la partida", () => {
  assert.equal(hintMaxTier(DIFFICULTY.EASY), 0);
  assert.equal(hintMaxTier(DIFFICULTY.MEDIUM), 1);
  assert.equal(hintMaxTier(DIFFICULTY.HARD), 2);
  assert.equal(hintMaxTier(DIFFICULTY.EXPERT), 3);
  assert.equal(hintMaxTier(null), 1, "sin dificultad medida, cae en medio");
  assert.equal(hintMaxTier("inexistente"), 1);
});

test("hintFor: devuelve la deduccion con el text del motor, sin inventar texto", () => {
  const game = GameState.fromPuzzle(PUZZLE);
  const hint = hintFor(game, { maxTier: 0 });
  assert.equal(hint.found, true);
  assert.equal(typeof hint.text, "string");
  assert.ok(hint.text.length > 20);
  // el texto es exactamente el que genero el motor
  assert.equal(hint.text, hint.deduction.text);
});

test("hintFor: una partida facil no recibe una tecnica de tier 2", () => {
  const game = GameState.fromPuzzle(HARD);
  const hint = hintFor(game, { maxTier: 0 });
  if (hint.found) assert.ok(hint.deduction.tier <= 0, `tier ${hint.deduction.tier}`);
});

test("hintFor: respeta el maxTier de la partida", () => {
  const game = GameState.fromPuzzle(HARD);
  // con tier 1 no deberia dar una tecnica de tier 2
  const medium = hintFor(game, { maxTier: 1 });
  if (medium.found) assert.ok(medium.deduction.tier <= 1);
  // con tier 2, un puzzle dificil si recibe una tecnica de tier 2 mas adelante
  const full = hintFor(game, { maxTier: 2 });
  assert.equal(full.found, true);
});

test("hintFor: NO aplica la jugada (el tablero queda igual)", () => {
  const game = GameState.fromPuzzle(PUZZLE);
  const before = JSON.stringify(game.values());
  const notesBefore = Array.from(game.notes).join(",");
  const hint = hintFor(game, { maxTier: 0 });
  assert.equal(hint.found, true);
  assert.equal(JSON.stringify(game.values()), before, "los valores no cambian");
  assert.equal(Array.from(game.notes).join(","), notesBefore, "las notas no cambian");
  // y el historial no crece
  assert.equal(game.canUndo(), false, "una pista no es una mutacion");
});

test("hintFor: sin pista, el mensaje es honesto (no un silencio)", () => {
  // STUCK es unico pero un analisis fresco no tiene deduccion de tier <= 2.
  assert.equal(countSolutions(STUCK.split("").map(Number), 2), 1, "el fixture es de solucion unica");
  const game = GameState.fromPuzzle(STUCK);
  const hint = hintFor(game, { maxTier: 2 });
  assert.equal(hint.found, false);
  assert.match(hint.message, /no tengo/i);
  assert.doesNotMatch(hint.message, /^no hay pistas$/i);
});

test("hintFor: tablero resuelto -> sin pista, mensaje claro", () => {
  const solved =
    "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
  const game = GameState.fromPuzzle(solved);
  const hint = hintFor(game, { maxTier: 2 });
  assert.equal(hint.found, false);
  assert.ok(hint.message.length > 10);
});

test("hintHighlight: normaliza celdas y unidades del evidence", () => {
  const game = GameState.fromPuzzle(PUZZLE);
  const hint = hintFor(game, { maxTier: 0 });
  assert.ok(Array.isArray(hint.highlight.cells));
  assert.ok(hint.highlight.cells.length > 0, "el hint facil involucra al menos una celda");
  assert.ok(Array.isArray(hint.highlight.units));
  assert.ok(Array.isArray(hint.highlight.targets));
});

test("hintHighlight: tolera evidence con unit null y byDigit vacio", () => {
  const highlight = hintHighlight({
    evidence: { unit: null, cells: [5], digit: 3, digits: null, byDigit: [] },
    targets: [{ cell: 5, kind: "place", digit: 3 }],
  });
  assert.deepEqual(highlight.cells, [5]);
  assert.deepEqual(highlight.units, []);
  assert.deepEqual(highlight.targets, [5]);
});

test("hintHighlight: tolera evidence incompleto o ausente sin romper", () => {
  assert.doesNotThrow(() => hintHighlight({ evidence: {} }));
  assert.doesNotThrow(() => hintHighlight({}));
  assert.doesNotThrow(() => hintHighlight(null));
  const empty = hintHighlight(null);
  assert.deepEqual(empty, { cells: [], units: [], targets: [] });
});

test("hintHighlight: no repite unidades y valida su forma", () => {
  const highlight = hintHighlight({
    evidence: {
      unit: { type: "row", index: 2 },
      line: { type: "row", index: 2 }, // repetida
      box: { type: "box", index: 3 },
    },
    targets: [],
  });
  assert.equal(highlight.units.length, 2);
  assert.deepEqual(highlight.units[0], { type: "row", index: 2 });
  assert.deepEqual(highlight.units[1], { type: "box", index: 3 });
});

test("hintHighlight: incluye unidades de fish (base y cover)", () => {
  const highlight = hintHighlight({
    evidence: {
      unit: null,
      fish: {
        base: [{ type: "row", index: 1 }, { type: "row", index: 7 }],
        cover: [{ type: "col", index: 2 }, { type: "col", index: 6 }],
        digit: 6,
      },
    },
    targets: [],
  });
  assert.equal(highlight.units.length, 4);
});

test("hintHighlight: incluye pivot y pincers de las wings", () => {
  const highlight = hintHighlight({
    evidence: {
      unit: null,
      cells: [5],
      wing: { pivot: { cell: 5 }, pincers: [{ cell: 22 }, { cell: 59 }] },
    },
    targets: [],
  });
  assert.deepEqual(highlight.cells, [5, 22, 59]);
});

test("hintFor: ninguna deduccion del catalogo rompe el resaltado", () => {
  // Se recorre el tablero con el motor del core (sin tocar la partida) y se
  // comprueba que el resaltado de cada deduccion propuesta no lanza.
  const state = analyze(HARD.split("").map(Number));
  let guard = 0;
  let count = 0;
  while (!state.isSolved() && guard++ < 200) {
    const deduction = findDeduction(state, { maxTier: 2 });
    if (!deduction) break;
    const highlight = hintHighlight(deduction);
    assert.ok(Array.isArray(highlight.cells));
    state.applyDeduction(deduction);
    count++;
  }
  assert.ok(count > 0, "se esperaba al menos una deduccion en el recorrido");
});

test("hintFor: el resaltado nombra celdas que existen en el tablero", () => {
  const game = GameState.fromPuzzle(HARD);
  const hint = hintFor(game, { maxTier: 2 });
  assert.equal(hint.found, true);
  for (const cell of hint.highlight.cells) {
    assert.ok(cell >= 0 && cell < 81, `celda fuera de rango: ${cell}`);
  }
});

test("catalogo: hay tecnicas de tier 0, 1 y 2 con text", () => {
  const tiers = new Set(TECHNIQUES.map((t) => t.tier));
  assert.ok(tiers.has(0) && tiers.has(1) && tiers.has(2));
});
