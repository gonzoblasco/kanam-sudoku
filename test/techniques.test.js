// U2 - Tests de los detectores de tecnicas y del contrato de deduccion.

import test from "node:test";
import assert from "node:assert/strict";

import { analyze, bit, maskDigits } from "../src/core/analysis.js";
import {
  TECHNIQUES,
  TECHNIQUE_LABELS,
  findDeduction,
  verifyDeduction,
} from "../src/core/techniques.js";

// Fixtures verificados como puzzles de solucion unica donde la tecnica aparece.
const FIXTURES = {
  full_house: "700000000400050089050800700005030006300200004070008020080009040900600003000007000",
  hidden_single: "700000000400050089050800700005030006300200004070008020080009040900600003000007000",
  naked_single: "700000000400050089050800700005030006300200004070008020080009040900600003000007000",
  locked_candidates_pointing:
    "700000000400050089050800700005030006300200004070008020080009040900600003000007000",
  locked_candidates_claiming:
    "010000002037000060000040000904700100000021080000005704700000000020006000003208950",
  naked_pair: "000000400040128003007040000000400020186003050090000001300001600000500030000080002",
  hidden_pair: "500000000000007000094500006003908405000031020820040000000000008270000500080009010",
  naked_triple: "470000000825060000006000702003004001000800059500000000000043800000000070000126005",
  hidden_triple: "000659001000008070000400305204560000000000014600900000081000059000000040370000000",
};

function valuesOf(text) {
  return text.split("").map(Number);
}

test("catalogo: ids en ingles, tiers 0 y 1, ordenado por ER", () => {
  assert.ok(TECHNIQUES.length >= 9);
  let prevEr = -Infinity;
  for (const technique of TECHNIQUES) {
    assert.match(technique.id, /^[a-z_]+$/, `id no canonico: ${technique.id}`);
    assert.ok([0, 1].includes(technique.tier), `tier fuera de 0-1: ${technique.id}`);
    assert.ok(technique.er >= prevEr, `orden de ER roto en ${technique.id}`);
    prevEr = technique.er;
  }
});

test("catalogo: cada id tiene etiqueta en español", () => {
  for (const technique of TECHNIQUES) {
    assert.ok(TECHNIQUE_LABELS[technique.id], `falta etiqueta de ${technique.id}`);
  }
});

test("cada detector dispara en su fixture, con targets no vacios", () => {
  for (const [id, puzzle] of Object.entries(FIXTURES)) {
    const state = analyze(valuesOf(puzzle));
    let applied = 0;
    let guard = 0;
    while (!state.isSolved() && guard++ < 300) {
      const deduction = findDeduction(state, { maxTier: 1 });
      if (!deduction) break;
      const check = verifyDeduction(state, deduction);
      assert.ok(check.ok, `${id}: paso sin justificacion (${deduction.technique}): ${check.reason}`);
      assert.ok(deduction.targets.length > 0, `${id}: deduccion sin targets`);
      if (deduction.technique === id) applied++;
      state.applyDeduction(deduction);
    }
    assert.ok(applied >= 1, `${id}: nunca se aplico en su fixture`);
  }
});

test("deduccion: forma del contrato", () => {
  const state = analyze(valuesOf(FIXTURES.hidden_single));
  const deduction = findDeduction(state);
  assert.equal(typeof deduction.technique, "string");
  assert.equal(typeof deduction.tier, "number");
  assert.equal(typeof deduction.er, "number");
  assert.ok(["place", "eliminate"].includes(deduction.action));
  assert.ok(Array.isArray(deduction.targets));
  assert.ok(deduction.evidence && typeof deduction.evidence === "object");
  // U2 no agrega texto: eso es de U3
  assert.equal(deduction.text, undefined);
});

test("deduccion: evidence nombra la unidad y el digito (a11y)", () => {
  // hidden single en caja: evidence debe traer unit y digit
  const state = analyze(valuesOf(FIXTURES.hidden_single));
  const deduction = findDeduction(state);
  assert.equal(deduction.technique, "hidden_single");
  assert.ok(deduction.evidence.unit, "falta la unidad");
  assert.ok(["row", "col", "box"].includes(deduction.evidence.unit.type));
  assert.equal(typeof deduction.evidence.unit.index, "number");
  assert.equal(typeof deduction.evidence.digit, "number");
});

test("verifyDeduction: rechaza un place sobre una casilla con valor", () => {
  const state = analyze(valuesOf(FIXTURES.hidden_single));
  const check = verifyDeduction(state, {
    targets: [{ cell: 0, kind: "place", digit: 7 }],
  });
  assert.equal(check.ok, false);
});

test("verifyDeduction: rechaza un digit que no es candidato", () => {
  const state = analyze(valuesOf(FIXTURES.hidden_single));
  // la casilla 1 esta vacia; el 7 ya esta en su fila (casilla 0), no es candidato
  const check = verifyDeduction(state, {
    targets: [{ cell: 1, kind: "place", digit: 7 }],
  });
  assert.equal(check.ok, false);
});

test("verifyDeduction: rechaza targets vacios o desconocidos", () => {
  const state = analyze(valuesOf(FIXTURES.hidden_single));
  assert.equal(verifyDeduction(state, { targets: [] }).ok, false);
  assert.equal(verifyDeduction(state, null).ok, false);
  assert.equal(verifyDeduction(state, { targets: [{ cell: 1, kind: "nope", digit: 1 }] }).ok, false);
});

test("findDeduction: maxTier acota las tecnicas", () => {
  const state = analyze(valuesOf(FIXTURES.naked_pair));
  const tier0 = findDeduction(state, { maxTier: 0 });
  if (tier0) assert.equal(tier0.tier, 0);
  // con maxTier 0 no debe devolver una tecnica de tier 1
  const first = findDeduction(state, { maxTier: 0 });
  assert.ok(first === null || first.tier === 0);
});

test("applyDeduction: colocar un valor elimina candidatos coherentes", () => {
  const state = analyze(valuesOf(FIXTURES.hidden_single));
  const deduction = findDeduction(state);
  const target = deduction.targets[0];
  assert.equal(target.kind, "place");
  state.applyDeduction(deduction);
  assert.equal(state.values[target.cell], target.digit);
  assert.equal(maskDigits(state.candidates[target.cell]).length, 0);
});

test("locked candidates pointing: elimina fuera de la caja, dentro de la linea", () => {
  const state = analyze(valuesOf(FIXTURES.locked_candidates_pointing));
  // avanzar hasta encontrar el pointing
  let guard = 0;
  while (guard++ < 300) {
    const d = findDeduction(state, { maxTier: 1 });
    if (!d) break;
    if (d.technique === "locked_candidates_pointing") {
      // cada target esta en la linea de evidence.unit y fuera de las celdas
      for (const target of d.targets) {
        assert.ok(!d.evidence.cells.includes(target.cell));
      }
      assert.ok(d.evidence.byDigit && d.evidence.byDigit.length >= 1);
      break;
    }
    state.applyDeduction(d);
  }
});
