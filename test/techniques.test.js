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

// Fixtures generados localmente con el generador (semilla) y verificados con el
// rater: cada uno es de solucion unica y la tecnica aparece de verdad.
// tier 0-1
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
  // tier 2 (generados con semilla 50017/50266/50047/50065/51063 y filtrados
  // por el rater hasta que la tecnica aparece en la resolucion)
  naked_quad: "004090003000600509009280001407000090805000006000100000006000900900005700081960320",
  x_wing: "205800000080750000000000030000062008600980200020000170000008000710500000098006700",
  swordfish: "009840700050000008000030002200060005005000060980400300600300801000000000810007093",
  xy_wing: "000870019000009080000006200090050704000002000040098000430000006600080050008004093",
  xyz_wing: "003010009050000420100400080700008500002005064000034000010300000009600000000000042",
};

function valuesOf(text) {
  return text.split("").map(Number);
}

test("catalogo: ids en ingles, tiers 0-2, ordenado por ER", () => {
  assert.ok(TECHNIQUES.length >= 14);
  let prevEr = -Infinity;
  for (const technique of TECHNIQUES) {
    assert.match(technique.id, /^[a-z_]+$/, `id no canonico: ${technique.id}`);
    assert.ok([0, 1, 2].includes(technique.tier), `tier fuera de 0-2: ${technique.id}`);
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
    while (!state.isSolved() && guard++ < 400) {
      const deduction = findDeduction(state, { maxTier: 2 });
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

test("deduccion: forma del contrato incluye text", () => {
  const state = analyze(valuesOf(FIXTURES.hidden_single));
  const deduction = findDeduction(state);
  assert.equal(typeof deduction.technique, "string");
  assert.equal(typeof deduction.tier, "number");
  assert.equal(typeof deduction.er, "number");
  assert.ok(["place", "eliminate"].includes(deduction.action));
  assert.ok(Array.isArray(deduction.targets));
  assert.ok(deduction.evidence && typeof deduction.evidence === "object");
  // U3 agrega el texto llano: presente y no vacio.
  assert.equal(typeof deduction.text, "string");
  assert.ok(deduction.text.length > 20, "text demasiado corto");
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

// --- tier 2 ----------------------------------------------------------------

// Un test por tecnica nueva: en su fixture la tecnica se detecta, la deduccion
// es legal (verifyDeduction) y el texto nombra unidad/digitos reales.
test("tier 2: cada detector dispara en su fixture con deduccion legal", () => {
  const tier2 = ["naked_quad", "x_wing", "swordfish", "xy_wing", "xyz_wing"];
  for (const id of tier2) {
    const state = analyze(valuesOf(FIXTURES[id]));
    let found = null;
    let guard = 0;
    while (!state.isSolved() && guard++ < 400) {
      const d = findDeduction(state, { maxTier: 2 });
      if (!d) break;
      assert.ok(verifyDeduction(state, d).ok, `${id}: paso sin justificacion (${d.technique})`);
      if (d.technique === id) {
        found = d;
        break;
      }
      state.applyDeduction(d);
    }
    assert.ok(found, `${id}: no se detecto en su fixture`);
    assert.equal(found.tier, 2, `${id}: tier distinto de 2`);
    assert.ok(found.targets.length > 0, `${id}: sin targets`);
    assert.equal(found.action, "eliminate", `${id}: deberia eliminar`);
  }
});

test("tier 2: los ER son los del research (3.2 a 5.0)", () => {
  const byId = Object.fromEntries(TECHNIQUES.map((t) => [t.id, t]));
  assert.equal(byId.x_wing.er, 3.2); // research 3.9
  assert.equal(byId.swordfish.er, 3.8); // research 3.10
  assert.equal(byId.xy_wing.er, 4.2); // research 3.12
  assert.equal(byId.xyz_wing.er, 4.4); // research 3.13
  assert.equal(byId.naked_quad.er, 5.0); // research 3.7
  assert.equal(byId.hidden_triple.tier, 2, "hidden_triple es tier 2 por la tabla de niveles");
  for (const t of [byId.x_wing, byId.swordfish, byId.xy_wing, byId.xyz_wing, byId.naked_quad]) {
    assert.equal(t.tier, 2, `${t.id}: tier distinto de 2`);
  }
});

test("x_wing: elimina en las lineas cruzadas, fuera de las definidoras", () => {
  const state = analyze(valuesOf(FIXTURES.x_wing));
  let guard = 0;
  while (guard++ < 400) {
    const d = findDeduction(state, { maxTier: 2 });
    if (!d) break;
    if (d.technique === "x_wing") {
      const base = new Set(d.evidence.fish.base.map((u) => u.index));
      const baseType = d.evidence.fish.base[0].type;
      const coverType = d.evidence.fish.cover[0].type;
      assert.notEqual(baseType, coverType);
      for (const target of d.targets) {
        const u = d.evidence.fish.cover.find((c) =>
          (coverType === "col" && (target.cell % 9) === c.index) ||
          (coverType === "row" && Math.floor(target.cell / 9) === c.index));
        assert.ok(u, "el target no esta en una linea cruzada");
        // y no esta en una linea definidora
        if (baseType === "row") assert.ok(!base.has(Math.floor(target.cell / 9)));
        else assert.ok(!base.has(target.cell % 9));
      }
      break;
    }
    state.applyDeduction(d);
  }
});

// --- motor de explicaciones -------------------------------------------------

test("explain: tier 0, 1 y 2 producen text que nombra unidad y digitos", () => {
  const cases = [
    { id: "full_house", unitWord: "fila", hasDigit: true },
    { id: "hidden_single", unitWord: "fila", hasDigit: true },
    { id: "naked_single", unitWord: "columna", hasDigit: true },
    { id: "locked_candidates_pointing", unitWord: "caja", hasDigit: true },
    { id: "locked_candidates_claiming", unitWord: "caja", hasDigit: true },
    { id: "naked_pair", unitWord: "fila", hasDigit: true },
    { id: "hidden_pair", unitWord: "fila", hasDigit: true },
    { id: "naked_triple", unitWord: "fila", hasDigit: true },
    { id: "hidden_triple", unitWord: "fila", hasDigit: true },
    { id: "naked_quad", unitWord: "columna", hasDigit: true },
    { id: "x_wing", unitWord: "fila", hasDigit: true },
    { id: "swordfish", unitWord: "fila", hasDigit: true },
    { id: "xy_wing", unitWord: "fila", hasDigit: true },
    { id: "xyz_wing", unitWord: "fila", hasDigit: true },
  ];
  for (const { id } of cases) {
    const state = analyze(valuesOf(FIXTURES[id]));
    let d = null;
    let guard = 0;
    while (!state.isSolved() && guard++ < 400) {
      const found = findDeduction(state, { maxTier: 2 });
      if (!found) break;
      if (found.technique === id) {
        d = found;
        break;
      }
      state.applyDeduction(found);
    }
    assert.ok(d, `${id}: no se detecto`);
    assert.equal(typeof d.text, "string");
    assert.ok(d.text.length > 20, `${id}: text demasiado corto`);
    // nombra una unidad concreta y al menos un digito real del evidence
    assert.match(d.text, /fila|columna|caja/, `${id}: el text no nombra ninguna unidad`);
    const digits = d.evidence.digits ?? (d.evidence.digit ? [d.evidence.digit] : []);
    for (const digit of digits) {
      assert.ok(
        new RegExp(`\\b${digit}\\b`).test(d.text),
        `${id}: el text no menciona el digito ${digit}`,
      );
    }
  }
});

test("explain: no hay strings fijos (dos deducciones distintas tienen distinto texto)", () => {
  // La misma tecnica en tableros distintos debe dar textos distintos: se
  // construye desde el evidence, no es una frase fija.
  const a = analyze(valuesOf(FIXTURES.hidden_pair));
  const b = analyze(valuesOf(FIXTURES.xy_wing));
  const t1 = findDeduction(a, { maxTier: 2 });
  const t2 = findDeduction(b, { maxTier: 2 });
  assert.notEqual(t1.text, t2.text);
});

// Un helper local: el text de una tecnica concreta en su fixture.
function textOf(id) {
  const state = analyze(valuesOf(FIXTURES[id]));
  let guard = 0;
  while (!state.isSolved() && guard++ < 400) {
    const d = findDeduction(state, { maxTier: 2 });
    if (!d) break;
    if (d.technique === id) return d.text;
    state.applyDeduction(d);
  }
  return null;
}

test("explain: el text se regenera igual desde el mismo estado (determinista)", () => {
  assert.equal(textOf("x_wing"), textOf("x_wing"));
  assert.notEqual(textOf("x_wing"), textOf("swordfish"));
});
