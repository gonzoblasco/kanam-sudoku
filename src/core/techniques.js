// U2/U3 - Detectores de tecnicas tier 0, 1 y 2, y contrato de deduccion con
// explicacion llana.
//
// CONTRATO DE DEDUCCION (API interna compartida; ver tambien `DEDUCTION.md`)
// -------------------------------------------------------------------------
// Cada deduccion es un objeto plano:
//
//   {
//     technique: "hidden_single",  // id canonico en INGLES, estable
//     tier: 0,                     // 0 facil, 1 medio, 2 dificil, 3 experto
//     er: 1.5,                     // rating de referencia (Sudoku Explainer)
//     action: "place" | "eliminate",
//     targets: [                   // lo unico que muta el tablero
//       { cell: 42, kind: "place", digit: 6 },
//       { cell: 43, kind: "eliminate", digit: 6 },
//     ],
//     evidence: {                  // que resaltar en el tablero (U7)
//       unit: { type: "row", index: 2 } | null,
//       cells: [42, 43],           // casillas involucradas en el razonamiento
//       digit: 6 | null,           // digito principal si hay uno
//       digits: [1, 7] | null,     // varios digitos (subsets)
//       byDigit: [                 // casillas candidatas por digito
//         { digit: 1, cells: [42, 43] },
//       ] | null,
//       // extra por familia: line (pointing), box (claiming), fish, wing
//     },
//     text: "En la fila 3, ..."    // explicacion llana (U3, desde evidence)
//   }
//
// Reglas del contrato:
// - `targets` es lo unico que muta el tablero. Sin targets no hay deduccion.
// - `evidence` es solo para mostrar; nombra la unidad y el digito porque el
//   resaltado no puede depender solo del color (NFR-4).
// - El id `technique` va en ingles (la nomenclatura en español NO es canonica,
//   research seccion 8.1). El nombre en español vive en `TECHNIQUE_LABELS`.
// - `text` se construye desde `evidence` con `explain()`, no es una frase fija
//   por tecnica: dice donde y que, no solo el nombre de la tecnica.
// - Una deduccion solo vale si sus `targets` estan justificados por el estado
//   del tablero; `verifyDeduction` lo comprueba antes de aplicarla.
// - El tier lo fija la tabla de niveles del research 4.2, NO el ER (SPEC 7bis).
//   El ER solo ordena la evaluacion dentro del catalogo.

import { DIM, UNIT_TYPE, UNITS, PEERS, bit, popcount, maskDigits } from "./analysis.js";
import { explain } from "./explain.js";

/** Etiquetas de UI en español, no canonicas (solo para mostrar). */
export const TECHNIQUE_LABELS = Object.freeze({
  full_house: "ultimo numero de la casa",
  hidden_single: "single oculto",
  naked_single: "candidato unico",
  locked_candidates_pointing: "candidatos bloqueados (apuntado)",
  locked_candidates_claiming: "candidatos bloqueados (reclamo)",
  naked_pair: "par desnudo",
  hidden_pair: "par oculto",
  naked_triple: "triple desnudo",
  hidden_triple: "triple oculto",
  naked_quad: "cuadruple desnudo",
  x_wing: "ala X (X-Wing)",
  swordfish: "pez espada (Swordfish)",
  xy_wing: "ala XY (XY-Wing)",
  xyz_wing: "ala XYZ (XYZ-Wing)",
  jellyfish: "medusa (Jellyfish)",
  skyscraper: "rascacielos (Skyscraper)",
  two_string_kite: "cometa de dos cuerdas (2-String Kite)",
  unique_rectangle: "rectangulo unico (Unique Rectangle)",
  w_wing: "ala W (W-Wing)",
  simple_colors: "coloreo simple (Simple Colors)",
});

const ROWS = UNITS.filter((u) => u.type === UNIT_TYPE.ROW);
const COLS = UNITS.filter((u) => u.type === UNIT_TYPE.COL);
const BOXES = UNITS.filter((u) => u.type === UNIT_TYPE.BOX);

// Unidades ordenadas para hidden single: las cajas dan ER mas bajo (1.2) que
// filas y columnas (1.5), asi que se evaluan primero (research 6.4).
const HIDDEN_SINGLE_UNITS = [...BOXES, ...ROWS, ...COLS];

/** Convierte una mascara de 81 bits a un array de indices ascendente. */
function cellsOfMask(maskBig) {
  const cells = [];
  let remaining = maskBig;
  while (remaining) {
    const low = remaining & -remaining;
    cells.push(low.toString(2).length - 1);
    remaining ^= low;
  }
  return cells;
}

/** Combinaciones de tamano `k` de una lista, en orden de aparicion. */
function combinations(items, k) {
  const out = [];
  const pick = (start, acc) => {
    if (acc.length === k) {
      out.push(acc.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      acc.push(items[i]);
      pick(i + 1, acc);
      acc.pop();
    }
  };
  pick(0, []);
  return out;
}

function unitRef(unit) {
  return { type: unit.type, index: unit.index };
}

function rowIndex(cell) {
  return Math.floor(cell / 9);
}

function colIndex(cell) {
  return cell % 9;
}

function boxIndex(cell) {
  return Math.floor(rowIndex(cell) / 3) * 3 + Math.floor(colIndex(cell) / 3);
}

function sameRow(cells) {
  const r = rowIndex(cells[0]);
  return cells.every((c) => rowIndex(c) === r);
}

function sameCol(cells) {
  const c0 = colIndex(cells[0]);
  return cells.every((c) => colIndex(c) === c0);
}

function sameBox(cells) {
  const b = boxIndex(cells[0]);
  return cells.every((c) => boxIndex(c) === b) ? b : null;
}

// Elimina `mask` de las casillas de una unidad fuera de `keep`.
function eliminateOthersInUnit(state, unit, keep, mask) {
  const targets = [];
  for (const cell of unit.cells) {
    if (keep.includes(cell)) continue;
    if (state.values[cell] !== 0) continue;
    const hits = state.candidates[cell] & mask;
    for (const d of maskDigits(hits)) targets.push({ cell, kind: "eliminate", digit: d });
  }
  return targets;
}

// Elimina de `cells` los candidatos que no esten en `mask`.
function eliminateOthersInCells(state, cells, mask) {
  const targets = [];
  for (const cell of cells) {
    if (state.values[cell] !== 0) continue;
    const extra = state.candidates[cell] & ~mask;
    for (const d of maskDigits(extra)) targets.push({ cell, kind: "eliminate", digit: d });
  }
  return targets;
}

function makeDeduction(technique, tier, er, action, targets, evidence) {
  // `text` se construye desde `evidence` (no es un string fijo por tecnica):
  // nombra la unidad y los digitos reales para no depender solo del color.
  return { technique, tier, er, action, targets, evidence, text: explain({ technique, evidence }) };
}

// Casillas candidatas de un digito en una linea (fila o columna).
function lineDigitCells(state, line, digit) {
  return cellsOfMask(state.unitDigitCells(line, digit));
}

// Los peers comunes a una lista de casillas. Los usan las wings.
function commonPeers(cells) {
  let common = null;
  for (const cell of cells) {
    const set = new Set(PEERS[cell]);
    if (common === null) common = set;
    else common = new Set([...common].filter((c) => set.has(c)));
  }
  return common ? [...common].sort((a, b) => a - b) : [];
}

// true si `a` y `b` se ven (comparten fila, columna o caja). `PEERS` no incluye
// la propia casilla, asi que a === b da false.
function sees(a, b) {
  return PEERS[a].includes(b);
}

// Pares conjugados (links fuertes) de un digito: unidades con exactamente dos
// casillas candidatas. `type` filtra por tipo de unidad (fila/columna/caja).
function strongLinks(state, digit, type) {
  const links = [];
  for (const unit of UNITS) {
    if (type && unit.type !== type) continue;
    const cells = cellsOfMask(state.unitDigitCells(unit, digit));
    if (cells.length === 2) links.push({ unit, cells });
  }
  return links;
}

// Casillas bivaluadas: exactamente dos candidatos.
function bivaluedCells(state) {
  const out = [];
  for (let cell = 0; cell < state.values.length; cell++) {
    if (state.values[cell] === 0 && state.cellCount[cell] === 2) out.push(cell);
  }
  return out;
}

// Elimina `digit` de los peers comunes a dos casillas.
function eliminateFromCommonPeers(state, a, b, digit) {
  const targets = [];
  for (const cell of commonPeers([a, b])) {
    if (state.values[cell] !== 0) continue;
    if (state.candidates[cell] & bit(digit)) targets.push({ cell, kind: "eliminate", digit });
  }
  return targets;
}

// Detector: devuelve una deduccion o null. Nunca muta el estado.
function defineTechnique(id, tier, er, action, detect) {
  TECHNIQUES.push(Object.freeze({ id, tier, er, action, detect }));
}

/** Catalogo de tecnicas (tier 0 a 2) ordenado por ER ascendente. */
export const TECHNIQUES = [];

// ---------------------------------------------------------------------------
// Tier 0 - Singles
// ---------------------------------------------------------------------------

// Full House: una unidad con una sola casilla vacia. Coloca el digito que falta.
defineTechnique("full_house", 0, 1.0, "place", (state) => {
  for (const unit of UNITS) {
    const empty = state.unitEmptyCells(unit);
    if (empty.length !== 1) continue;
    const missing = maskDigits(state.unitMissingDigits(unit));
    if (missing.length !== 1) continue;
    const cell = empty[0];
    const digit = missing[0];
    return makeDeduction("full_house", 0, 1.0, "place", [{ cell, kind: "place", digit }], {
      unit: unitRef(unit),
      cells: [cell],
      digit,
      digits: null,
      byDigit: null,
    });
  }
  return null;
});

// Hidden Single: un digito con un solo candidato en una unidad. Coloca el digito
// en esa casilla. ER 1.2 en caja, 1.5 en fila/columna.
defineTechnique("hidden_single", 0, 1.5, "place", (state) => {
  for (const unit of HIDDEN_SINGLE_UNITS) {
    const missing = state.unitMissingDigits(unit);
    for (let d = 1; d <= DIM; d++) {
      if (!(missing & bit(d))) continue;
      const cells = cellsOfMask(state.unitDigitCells(unit, d));
      if (cells.length !== 1) continue;
      const er = unit.type === UNIT_TYPE.BOX ? 1.2 : 1.5;
      return makeDeduction("hidden_single", 0, er, "place", [
        { cell: cells[0], kind: "place", digit: d },
      ], {
        unit: unitRef(unit),
        cells: [cells[0]],
        digit: d,
        digits: null,
        byDigit: null,
      });
    }
  }
  return null;
});

// Naked Single: una casilla con un solo candidato. ER 2.3.
defineTechnique("naked_single", 0, 2.3, "place", (state) => {
  for (let cell = 0; cell < state.values.length; cell++) {
    if (state.values[cell] !== 0) continue;
    if (state.cellCount[cell] !== 1) continue;
    const digit = maskDigits(state.candidates[cell])[0];
    return makeDeduction("naked_single", 0, 2.3, "place", [{ cell, kind: "place", digit }], {
      unit: null,
      cells: [cell],
      digit,
      digits: null,
      byDigit: null,
    });
  }
  return null;
});

// ---------------------------------------------------------------------------
// Tier 1 - Locked candidates y subsets
// ---------------------------------------------------------------------------

// Pointing: en una caja, todos los candidatos de un digito caen en una misma
// linea. Elimina ese digito del resto de la linea, fuera de la caja. ER 2.6.
defineTechnique("locked_candidates_pointing", 1, 2.6, "eliminate", (state) => {
  for (const box of BOXES) {
    const missing = state.unitMissingDigits(box);
    for (let d = 1; d <= DIM; d++) {
      if (!(missing & bit(d))) continue;
      const cells = cellsOfMask(state.unitDigitCells(box, d));
      if (cells.length < 2 || cells.length > 3) continue;
      let line = null;
      if (sameRow(cells)) line = ROWS[rowIndex(cells[0])];
      else if (sameCol(cells)) line = COLS[colIndex(cells[0])];
      if (!line) continue;
      const targets = eliminateOthersInUnit(state, line, cells, bit(d));
      if (targets.length === 0) continue;
      return makeDeduction("locked_candidates_pointing", 1, 2.6, "eliminate", targets, {
        unit: unitRef(box),
        line: unitRef(line),
        cells,
        digit: d,
        digits: null,
        byDigit: [{ digit: d, cells }],
      });
    }
  }
  return null;
});

// Claiming: en una fila o columna, todos los candidatos de un digito caen en una
// misma caja. Elimina ese digito del resto de la caja. ER 2.8.
defineTechnique("locked_candidates_claiming", 1, 2.8, "eliminate", (state) => {
  for (const line of [...ROWS, ...COLS]) {
    const missing = state.unitMissingDigits(line);
    for (let d = 1; d <= DIM; d++) {
      if (!(missing & bit(d))) continue;
      const cells = cellsOfMask(state.unitDigitCells(line, d));
      if (cells.length < 2 || cells.length > 3) continue;
      const b = sameBox(cells);
      if (b === null) continue;
      const box = BOXES[b];
      const targets = eliminateOthersInUnit(state, box, cells, bit(d));
      if (targets.length === 0) continue;
      return makeDeduction("locked_candidates_claiming", 1, 2.8, "eliminate", targets, {
        unit: unitRef(line),
        box: unitRef(box),
        cells,
        digit: d,
        digits: null,
        byDigit: [{ digit: d, cells }],
      });
    }
  }
  return null;
});

// Naked Pair: dos casillas de una unidad con los mismos dos candidatos. Elimina
// esos dos digitos del resto de la unidad. ER 3.0.
defineTechnique("naked_pair", 1, 3.0, "eliminate", (state) => {
  for (const unit of UNITS) {
    const bivalued = unit.cells.filter(
      (cell) => state.values[cell] === 0 && state.cellCount[cell] === 2,
    );
    for (const pair of combinations(bivalued, 2)) {
      if (state.candidates[pair[0]] !== state.candidates[pair[1]]) continue;
      const mask = state.candidates[pair[0]];
      const targets = eliminateOthersInUnit(state, unit, pair, mask);
      if (targets.length === 0) continue;
      const digits = maskDigits(mask);
      return makeDeduction("naked_pair", 1, 3.0, "eliminate", targets, {
        unit: unitRef(unit),
        cells: pair,
        digit: null,
        digits,
        byDigit: digits.map((d) => ({ digit: d, cells: pair })),
      });
    }
  }
  return null;
});

// Hidden Pair: dos digitos cuyos candidatos en una unidad se limitan a las
// mismas dos casillas. Elimina los demas candidatos de esas casillas. ER 3.4.
defineTechnique("hidden_pair", 1, 3.4, "eliminate", (state) => {
  for (const unit of UNITS) {
    const missing = maskDigits(state.unitMissingDigits(unit));
    for (const pair of combinations(missing, 2)) {
      const cellsA = cellsOfMask(state.unitDigitCells(unit, pair[0]));
      const cellsB = cellsOfMask(state.unitDigitCells(unit, pair[1]));
      if (cellsA.length !== 2 || cellsB.length !== 2) continue;
      if (cellsA[0] !== cellsB[0] || cellsA[1] !== cellsB[1]) continue;
      const mask = bit(pair[0]) | bit(pair[1]);
      const targets = eliminateOthersInCells(state, cellsA, mask);
      if (targets.length === 0) continue;
      return makeDeduction("hidden_pair", 1, 3.4, "eliminate", targets, {
        unit: unitRef(unit),
        cells: cellsA,
        digit: null,
        digits: pair,
        byDigit: pair.map((d) => ({ digit: d, cells: cellsA })),
      });
    }
  }
  return null;
});

// Naked Triple: tres casillas de una unidad cuya union de candidatos tiene
// tamano 3. Elimina esos tres digitos del resto de la unidad. ER 3.6.
defineTechnique("naked_triple", 1, 3.6, "eliminate", (state) => {
  for (const unit of UNITS) {
    const free = unit.cells.filter((cell) => state.values[cell] === 0 && state.cellCount[cell] >= 2);
    for (const triple of combinations(free, 3)) {
      const mask = triple.reduce((acc, cell) => acc | state.candidates[cell], 0);
      if (popcount(mask) !== 3) continue;
      const targets = eliminateOthersInUnit(state, unit, triple, mask);
      if (targets.length === 0) continue;
      const digits = maskDigits(mask);
      return makeDeduction("naked_triple", 1, 3.6, "eliminate", targets, {
        unit: unitRef(unit),
        cells: triple,
        digit: null,
        digits,
        byDigit: digits.map((d) => ({ digit: d, cells: triple })),
      });
    }
  }
  return null;
});

// Hidden Triple: tres digitos contenidos en las mismas tres casillas de una
// unidad. Elimina los demas candidatos de esas casillas. ER 4.0; tier 2 (la
// tabla de niveles del research 4.2 lo pone en Dificil, no en Medio, aunque su
// hermano naked_triple sea tier 1).
defineTechnique("hidden_triple", 2, 4.0, "eliminate", (state) => {
  for (const unit of UNITS) {
    const missing = maskDigits(state.unitMissingDigits(unit));
    for (const triple of combinations(missing, 3)) {
      const sets = triple.map((d) => cellsOfMask(state.unitDigitCells(unit, d)));
      if (sets.some((cells) => cells.length === 0 || cells.length > 3)) continue;
      const union = [...new Set(sets.flat())].sort((a, b) => a - b);
      if (union.length !== 3) continue;
      const mask = triple.reduce((acc, d) => acc | bit(d), 0);
      const targets = eliminateOthersInCells(state, union, mask);
      if (targets.length === 0) continue;
      const digits = triple.slice().sort((a, b) => a - b);
      return makeDeduction("hidden_triple", 2, 4.0, "eliminate", targets, {
        unit: unitRef(unit),
        cells: union,
        digit: null,
        digits,
        byDigit: digits.map((d) => ({ digit: d, cells: sets[triple.indexOf(d)] })),
      });
    }
  }
  return null;
});

// ---------------------------------------------------------------------------
// Tier 2 - Cuadruples desnudos, fish y wings (research 3.7, 3.9, 3.10, 3.12, 3.13)
// ---------------------------------------------------------------------------

// Naked Quad: cuatro casillas de una unidad cuya union de candidatos tiene
// tamano 4. Elimina esos cuatro digitos del resto de la unidad. ER 5.0; tier 2.
defineTechnique("naked_quad", 2, 5.0, "eliminate", (state) => {
  for (const unit of UNITS) {
    const free = unit.cells.filter((cell) => state.values[cell] === 0 && state.cellCount[cell] >= 2);
    for (const quad of combinations(free, 4)) {
      const mask = quad.reduce((acc, cell) => acc | state.candidates[cell], 0);
      if (popcount(mask) !== 4) continue;
      const targets = eliminateOthersInUnit(state, unit, quad, mask);
      if (targets.length === 0) continue;
      const digits = maskDigits(mask);
      return makeDeduction("naked_quad", 2, 5.0, "eliminate", targets, {
        unit: unitRef(unit),
        cells: quad,
        digit: null,
        digits,
        byDigit: digits.map((d) => ({ digit: d, cells: quad })),
      });
    }
  }
  return null;
});

// Busca un fish basico de tamano `size`: `size` lineas definidoras (filas o
// columnas, en una sola orientacion) donde el digito tiene entre 2 y `size`
// casillas candidatas, y cuyas lineas cruzadas suman exactamente `size`. No
// elimina nada: devuelve la estructura para que el detector arme la deduccion.
function findFish(state, size) {
  const orientations = [
    { lines: ROWS, cross: COLS, crossIndex: colIndex },
    { lines: COLS, cross: ROWS, crossIndex: rowIndex },
  ];
  for (let d = 1; d <= DIM; d++) {
    for (const { lines, cross, crossIndex } of orientations) {
      const lineCells = lines.map((line) => lineDigitCells(state, line, d));
      for (const idx of combinations([...Array(9).keys()], size)) {
        if (idx.some((i) => lineCells[i].length < 2 || lineCells[i].length > size)) continue;
        const crossSet = new Set();
        for (const i of idx) for (const cell of lineCells[i]) crossSet.add(crossIndex(cell));
        if (crossSet.size !== size) continue;
        const coverIdx = [...crossSet].sort((a, b) => a - b);
        return {
          digit: d,
          base: idx.map((i) => lines[i]),
          cover: coverIdx.map((c) => cross[c]),
          baseCells: idx.flatMap((i) => lineCells[i]),
        };
      }
    }
  }
  return null;
}

function fishDeduction(id, tier, er, found) {
  const state = found.state;
  const targets = [];
  for (const line of found.cover) {
    targets.push(...eliminateOthersInUnit(state, line, found.baseCells, bit(found.digit)));
  }
  if (targets.length === 0) return null;
  return makeDeduction(id, tier, er, "eliminate", targets, {
    unit: null,
    cells: found.baseCells.slice().sort((a, b) => a - b),
    digit: found.digit,
    digits: null,
    byDigit: [{ digit: found.digit, cells: found.baseCells }],
    fish: {
      base: found.base.map(unitRef),
      cover: found.cover.map(unitRef),
      digit: found.digit,
    },
  });
}

// X-Wing: un digito aparece exactamente dos veces en cada una de dos lineas, y
// las cuatro casillas caen en las mismas dos lineas cruzadas. Elimina el digito
// del resto de esas dos lineas cruzadas, fuera de las definidoras. ER 3.2; tier 2
// (la tabla de niveles del research lo pone en Dificil, no en Medio).
defineTechnique("x_wing", 2, 3.2, "eliminate", (state) => {
  const found = findFish(state, 2);
  if (!found) return null;
  return fishDeduction("x_wing", 2, 3.2, { ...found, state });
});

// Swordfish: un digito aparece en 2 o 3 casillas de cada una de tres lineas, y
// todas caen en las mismas tres lineas cruzadas. Elimina el digito del resto de
// esas tres lineas cruzadas, fuera de las definidoras. ER 3.8; tier 2.
defineTechnique("swordfish", 2, 3.8, "eliminate", (state) => {
  const found = findFish(state, 3);
  if (!found) return null;
  return fishDeduction("swordfish", 2, 3.8, { ...found, state });
});

// XY-Wing: un pivote bivaluado XY y dos puntas XZ e YZ que ven al pivote. Elimina
// Z de las casillas que ven a las DOS puntas. ER 4.2; tier 2.
defineTechnique("xy_wing", 2, 4.2, "eliminate", (state) => {
  const bivalued = [];
  for (let cell = 0; cell < state.values.length; cell++) {
    if (state.values[cell] === 0 && state.cellCount[cell] === 2) bivalued.push(cell);
  }

  for (const pivot of bivalued) {
    const [x, y] = maskDigits(state.candidates[pivot]);
    for (const pincerA of bivalued) {
      if (pincerA === pivot || !sees(pivot, pincerA)) continue;
      const aCands = maskDigits(state.candidates[pincerA]);
      if (!aCands.includes(x) || aCands.includes(y)) continue; // debe ser XZ
      const z = aCands.find((v) => v !== x);
      if (z === undefined || z === y) continue;
      for (const pincerB of bivalued) {
        if (pincerB === pivot || pincerB === pincerA || !sees(pivot, pincerB)) continue;
        const bCands = maskDigits(state.candidates[pincerB]);
        if (!bCands.includes(y) || bCands.includes(x)) continue; // debe ser YZ
        if (!bCands.includes(z)) continue;
        const targets = [];
        for (const cell of commonPeers([pincerA, pincerB])) {
          if (state.values[cell] !== 0) continue;
          if (state.candidates[cell] & bit(z)) targets.push({ cell, kind: "eliminate", digit: z });
        }
        if (targets.length === 0) continue;
        return makeDeduction("xy_wing", 2, 4.2, "eliminate", targets, {
          unit: null,
          cells: [pivot, pincerA, pincerB],
          digit: z,
          digits: null,
          byDigit: [{ digit: z, cells: [pivot, pincerA, pincerB] }],
          wing: {
            pivot: { cell: pivot, candidates: [x, y] },
            pincers: [
              { cell: pincerA, candidates: [x, z] },
              { cell: pincerB, candidates: [y, z] },
            ],
            z,
          },
        });
      }
    }
  }
  return null;
});

// XYZ-Wing: como el XY-Wing pero el pivote tiene tres candidatos XYZ. Elimina Z
// de las casillas que ven al pivote y a las dos puntas. ER 4.4; tier 2.
defineTechnique("xyz_wing", 2, 4.4, "eliminate", (state) => {
  const bivalued = [];
  const trivalued = [];
  for (let cell = 0; cell < state.values.length; cell++) {
    if (state.values[cell] !== 0) continue;
    if (state.cellCount[cell] === 2) bivalued.push(cell);
    else if (state.cellCount[cell] === 3) trivalued.push(cell);
  }

  for (const pivot of trivalued) {
    const pivotCands = maskDigits(state.candidates[pivot]);
    for (const z of pivotCands) {
      const others = pivotCands.filter((v) => v !== z); // {x, y}
      for (const pincerA of bivalued) {
        if (!sees(pivot, pincerA)) continue;
        const aCands = maskDigits(state.candidates[pincerA]);
        if (!aCands.includes(others[0]) || !aCands.includes(z)) continue;
        for (const pincerB of bivalued) {
          if (pincerB === pincerA || !sees(pivot, pincerB)) continue;
          const bCands = maskDigits(state.candidates[pincerB]);
          if (!bCands.includes(others[1]) || !bCands.includes(z)) continue;
          const targets = [];
          for (const cell of commonPeers([pivot, pincerA, pincerB])) {
            if (state.values[cell] !== 0) continue;
            if (state.candidates[cell] & bit(z)) targets.push({ cell, kind: "eliminate", digit: z });
          }
          if (targets.length === 0) continue;
          return makeDeduction("xyz_wing", 2, 4.4, "eliminate", targets, {
            unit: null,
            cells: [pivot, pincerA, pincerB],
            digit: z,
            digits: null,
            byDigit: [{ digit: z, cells: [pivot, pincerA, pincerB] }],
            wing: {
              pivot: { cell: pivot, candidates: pivotCands.slice() },
              pincers: [
                { cell: pincerA, candidates: aCands.slice() },
                { cell: pincerB, candidates: bCands.slice() },
              ],
              z,
            },
          });
        }
      }
    }
  }
  return null;
});

// ---------------------------------------------------------------------------
// Tier 3 - Experto (research 3.11, 3.14, 3.15, 3.16, 3.18, 3.21).
//
// Etiquetas y solapamientos (research, incertidumbre 9): el motor reporta UNA
// etiqueta por deteccion, segun el orden del catalogo (ascendente por ER).
// - Skyscraper y 2-String Kite tienen formas distintas (links paralelos vs
//   perpendiculares), asi que no se disparan sobre el mismo patron.
// - Un Skyscraper no es un X-Wing: se exige que los extremos libres NO esten
//   alineados. Si el rectangulo completo existe, gana X-Wing (tier 2, menor ER).
// - La familia fish (X-Wing 2, Swordfish 3, Jellyfish 4) se prueba por tamano
//   creciente: un Jellyfish solo se reporta si no hay un fish mas chico.
// ER del research salvo W-Wing, que es estimado (ver STATUS).
// ---------------------------------------------------------------------------

// Jellyfish: fish de tamano 4 (research 3.11). ER 5.2.
defineTechnique("jellyfish", 3, 5.2, "eliminate", (state) => {
  const found = findFish(state, 4);
  if (!found) return null;
  return fishDeduction("jellyfish", 3, 5.2, { ...found, state });
});

// Skyscraper: dos links conjugados del mismo digito en lineas paralelas, con un
// extremo de cada uno en una linea base comun. Elimina el digito de las casillas
// que ven a los dos extremos libres (research 3.15). ER 4.0.
defineTechnique("skyscraper", 3, 4.0, "eliminate", (state) => {
  const orientations = [
    { type: UNIT_TYPE.ROW, crossIndex: colIndex, crossUnits: COLS },
    { type: UNIT_TYPE.COL, crossIndex: rowIndex, crossUnits: ROWS },
  ];
  for (let d = 1; d <= DIM; d++) {
    for (const { type, crossIndex, crossUnits } of orientations) {
      const links = strongLinks(state, d, type);
      for (let i = 0; i < links.length; i++) {
        for (let j = i + 1; j < links.length; j++) {
          const a = links[i];
          const b = links[j];
          const aCross = a.cells.map(crossIndex);
          const bCross = b.cells.map(crossIndex);
          const baseIndex = aCross.find((x) => bCross.includes(x));
          if (baseIndex === undefined) continue;
          const tipA = a.cells.find((c) => crossIndex(c) !== baseIndex);
          const tipB = b.cells.find((c) => crossIndex(c) !== baseIndex);
          // Si los extremos libres comparten la linea cruzada, es un X-Wing.
          if (crossIndex(tipA) === crossIndex(tipB)) continue;
          const targets = eliminateFromCommonPeers(state, tipA, tipB, d);
          if (targets.length === 0) continue;
          const baseUnit = crossUnits[baseIndex];
          const cells = [...new Set([...a.cells, ...b.cells])].sort((x, y) => x - y);
          return makeDeduction("skyscraper", 3, 4.0, "eliminate", targets, {
            unit: unitRef(baseUnit),
            cells,
            digit: d,
            digits: null,
            byDigit: [{ digit: d, cells: [tipA, tipB] }],
            units: [unitRef(a.unit), unitRef(b.unit), unitRef(baseUnit)],
            skyscraper: {
              parallel: [unitRef(a.unit), unitRef(b.unit)],
              base: unitRef(baseUnit),
              tips: [tipA, tipB],
              digit: d,
            },
          });
        }
      }
    }
  }
  return null;
});

// 2-String Kite: un link conjugado en una fila y otro en una columna, del mismo
// digito, con un extremo de cada uno en la misma caja (el codo). Elimina el
// digito de las casillas que ven a los dos extremos libres (research 3.16).
// ER 4.2 dentro de la banda 4.0-4.3 que da el research.
defineTechnique("two_string_kite", 3, 4.2, "eliminate", (state) => {
  for (let d = 1; d <= DIM; d++) {
    const rowLinks = strongLinks(state, d, UNIT_TYPE.ROW);
    const colLinks = strongLinks(state, d, UNIT_TYPE.COL);
    for (const r of rowLinks) {
      for (const c of colLinks) {
        let hingeR = null;
        let hingeC = null;
        for (const rc of r.cells) {
          for (const cc of c.cells) {
            if (rc !== cc && boxIndex(rc) === boxIndex(cc)) {
              hingeR = rc;
              hingeC = cc;
            }
          }
        }
        if (hingeR === null) continue;
        const tipR = r.cells.find((x) => x !== hingeR);
        const tipC = c.cells.find((x) => x !== hingeC);
        const targets = eliminateFromCommonPeers(state, tipR, tipC, d);
        if (targets.length === 0) continue;
        return makeDeduction("two_string_kite", 3, 4.2, "eliminate", targets, {
          unit: null,
          cells: [tipR, tipC, hingeR, hingeC],
          digit: d,
          digits: null,
          byDigit: [{ digit: d, cells: [tipR, tipC] }],
          units: [unitRef(r.unit), unitRef(c.unit)],
          kite: {
            row: unitRef(r.unit),
            col: unitRef(c.unit),
            hinge: [hingeR, hingeC],
            tips: [tipR, tipC],
            digit: d,
          },
        });
      }
    }
  }
  return null;
});

// Unique Rectangle (Type 1): cuatro casillas en dos cajas con candidatos {a,b};
// si tres son exactamente {a,b} y la cuarta tiene un candidato extra, esa cuarta
// no puede ser ni a ni b (romperia la unicidad) (research 3.21). ER 4.5.
//
// Depende de la suposicion de solucion unica: vale para todo puzzle de este
// generador (NFR-3), pero no es una verdad universal del sudoku. El texto del
// hint lo explica sin esconderlo.
defineTechnique("unique_rectangle", 3, 4.5, "eliminate", (state) => {
  const sameTower = [];
  const diffTower = [];
  for (let c1 = 0; c1 < DIM; c1++) {
    for (let c2 = c1 + 1; c2 < DIM; c2++) {
      (Math.floor(c1 / 3) === Math.floor(c2 / 3) ? sameTower : diffTower).push([c1, c2]);
    }
  }
  const sameFloor = [];
  const diffFloor = [];
  for (let r1 = 0; r1 < DIM; r1++) {
    for (let r2 = r1 + 1; r2 < DIM; r2++) {
      (Math.floor(r1 / 3) === Math.floor(r2 / 3) ? sameFloor : diffFloor).push([r1, r2]);
    }
  }
  const orientations = [
    { rows: diffFloor, cols: sameTower },
    { rows: sameFloor, cols: diffTower },
  ];
  for (const { rows, cols } of orientations) {
    for (const [r1, r2] of rows) {
      for (const [c1, c2] of cols) {
        const cells = [r1 * DIM + c1, r1 * DIM + c2, r2 * DIM + c1, r2 * DIM + c2];
        let shared = (1 << DIM) - 1;
        let ok = true;
        for (const cell of cells) {
          if (state.values[cell] !== 0) {
            ok = false;
            break;
          }
          shared &= state.candidates[cell];
        }
        if (!ok || popcount(shared) !== 2) continue;
        const exact = cells.filter((cell) => state.candidates[cell] === shared);
        const extra = cells.filter((cell) => state.candidates[cell] !== shared);
        if (exact.length !== 3 || extra.length !== 1) continue;
        const fourth = extra[0];
        const digits = maskDigits(shared);
        const targets = digits.map((digit) => ({ cell: fourth, kind: "eliminate", digit }));
        return makeDeduction("unique_rectangle", 3, 4.5, "eliminate", targets, {
          unit: null,
          cells,
          digit: null,
          digits,
          byDigit: digits.map((digit) => ({ digit, cells })),
          units: [],
          rectangle: { cells, digits, extra: fourth },
        });
      }
    }
  }
  return null;
});

// W-Wing: dos casillas bivaluadas identicas {w,x} conectadas por un link
// conjugado en uno de esos digitos, que une una vecina de cada extremo. Elimina
// el otro digito de las casillas que ven a las dos bivaluadas (research 3.14).
// ER 5.5 ESTIMADO: el research no confirma el ER del W-Wing simple (SE lo agrupa
// con WXYZ-Wing en 5.5-5.6). Ver STATUS y el reporte.
defineTechnique("w_wing", 3, 5.5, "eliminate", (state) => {
  const bivalued = bivaluedCells(state);
  for (let i = 0; i < bivalued.length; i++) {
    for (let j = i + 1; j < bivalued.length; j++) {
      const cellA = bivalued[i];
      const cellB = bivalued[j];
      if (state.candidates[cellA] !== state.candidates[cellB]) continue;
      const pairDigits = maskDigits(state.candidates[cellA]);
      for (const linkDigit of pairDigits) {
        const other = pairDigits.find((value) => value !== linkDigit);
        const links = strongLinks(state, linkDigit);
        for (const link of links) {
          const [p, q] = link.cells;
          if (p === cellA || p === cellB || q === cellA || q === cellB) continue;
          const connects =
            (sees(cellA, p) && sees(cellB, q)) || (sees(cellA, q) && sees(cellB, p));
          if (!connects) continue;
          const targets = eliminateFromCommonPeers(state, cellA, cellB, other);
          if (targets.length === 0) continue;
          return makeDeduction("w_wing", 3, 5.5, "eliminate", targets, {
            unit: null,
            cells: [cellA, cellB, p, q],
            digit: other,
            digits: null,
            byDigit: [{ digit: other, cells: [cellA, cellB] }],
            units: [unitRef(link.unit)],
            wWing: {
              pair: [cellA, cellB],
              candidates: pairDigits,
              linkCells: [p, q],
              linkUnit: unitRef(link.unit),
              linkDigit,
              digit: other,
            },
          });
        }
      }
    }
  }
  return null;
});

// Simple Colors (Color Trap y Color Wrap): colorea los candidatos de un digito
// siguiendo los links conjugados; o todos los de un color son el digito, o todos
// los del otro (research 3.18). ER 5.4.
defineTechnique("simple_colors", 3, 5.4, "eliminate", (state) => {
  for (let d = 1; d <= DIM; d++) {
    const links = strongLinks(state, d);
    if (links.length < 2) continue;
    const adjacency = new Map();
    const addEdge = (a, b) => {
      if (!adjacency.has(a)) adjacency.set(a, []);
      adjacency.get(a).push(b);
    };
    for (const link of links) {
      addEdge(link.cells[0], link.cells[1]);
      addEdge(link.cells[1], link.cells[0]);
    }

    const color = new Map();
    const visited = new Set();
    for (const start of adjacency.keys()) {
      if (visited.has(start)) continue;
      const component = [];
      color.set(start, 0);
      visited.add(start);
      const queue = [start];
      while (queue.length > 0) {
        const cell = queue.shift();
        component.push(cell);
        for (const nb of adjacency.get(cell) ?? []) {
          if (visited.has(nb)) continue;
          visited.add(nb);
          color.set(nb, 1 - color.get(cell));
          queue.push(nb);
        }
      }
      const buckets = [[], []];
      for (const cell of component) buckets[color.get(cell)].push(cell);

      // Color Wrap: dos casillas del mismo color caen en la misma unidad.
      for (const which of [0, 1]) {
        const group = buckets[which];
        let contradiction = false;
        for (let a = 0; a < group.length && !contradiction; a++) {
          for (let b = a + 1; b < group.length; b++) {
            if (sees(group[a], group[b])) {
              contradiction = true;
              break;
            }
          }
        }
        if (!contradiction) continue;
        const targets = group.map((cell) => ({ cell, kind: "eliminate", digit: d }));
        return makeDeduction("simple_colors", 3, 5.4, "eliminate", targets, {
          unit: null,
          cells: component.slice(),
          digit: d,
          digits: null,
          byDigit: null,
          units: [],
          colors: {
            type: "wrap",
            digit: d,
            cells: group.slice(),
            other: buckets[1 - which].slice(),
          },
        });
      }

      // Color Trap: una casilla fuera del componente que ve a los dos colores.
      for (const which of [0, 1]) {
        const group = buckets[which];
        const others = buckets[1 - which];
        for (let cell = 0; cell < state.values.length; cell++) {
          if (state.values[cell] !== 0) continue;
          if (!(state.candidates[cell] & bit(d))) continue;
          if (color.has(cell)) continue;
          if (!group.some((c) => sees(cell, c))) continue;
          if (!others.some((c) => sees(cell, c))) continue;
          return makeDeduction(
            "simple_colors",
            3,
            5.4,
            "eliminate",
            [{ cell, kind: "eliminate", digit: d }],
            {
              unit: null,
              cells: [cell, ...buckets[0], ...buckets[1]],
              digit: d,
              digits: null,
              byDigit: null,
              units: [],
              colors: { type: "trap", digit: d, cell, colors: [buckets[0].slice(), buckets[1].slice()] },
            },
          );
        }
      }
    }
  }
  return null;
});

// El orden de evaluacion es ascendente por ER (research 6.4): el motor prueba
// primero la tecnica mas simple aplicable. La pertenencia a un tier la define la
// tabla de niveles del research 4.2, no el ER; por eso el catalogo se ordena por
// ER pero el tier es un dato aparte de cada tecnica.
TECHNIQUES.sort((a, b) => a.er - b.er);

/**
 * Comprueba que una deduccion este justificada por el estado actual del tablero.
 * Un paso sin justificacion es un bug, no un redondeo: el rater lo verifica
 * antes de aplicar cada paso.
 *
 * @param {import("./analysis.js").AnalysisState} state
 * @param {object} deduction
 * @returns {{ok: boolean, reason?: string}}
 */
export function verifyDeduction(state, deduction) {
  if (!deduction || !Array.isArray(deduction.targets) || deduction.targets.length === 0) {
    return { ok: false, reason: "sin objetivos" };
  }
  for (const target of deduction.targets) {
    if (state.values[target.cell] !== 0) {
      return { ok: false, reason: `la casilla ${target.cell} ya tiene valor` };
    }
    if (target.kind === "place") {
      if (!(state.candidates[target.cell] & bit(target.digit))) {
        return { ok: false, reason: `el digito ${target.digit} no es candidato de ${target.cell}` };
      }
    } else if (target.kind === "eliminate") {
      if (!(state.candidates[target.cell] & bit(target.digit))) {
        return { ok: false, reason: `el digito ${target.digit} no es candidato de ${target.cell}` };
      }
    } else {
      return { ok: false, reason: `tipo de objetivo desconocido: ${target.kind}` };
    }
  }
  return { ok: true };
}

/**
 * Busca la primera deduccion aplicable segun el orden del catalogo (research
 * 6.4). `maxTier` acota las tecnicas consideradas.
 *
 * @param {import("./analysis.js").AnalysisState} state
 * @param {{maxTier?: number}} [options]
 * @returns {object | null}
 */
export function findDeduction(state, options = {}) {
  const { maxTier = Number.POSITIVE_INFINITY } = options;
  for (const technique of TECHNIQUES) {
    if (technique.tier > maxTier) continue;
    const found = technique.detect(state);
    if (found) return found;
  }
  return null;
}

export { cellsOfMask };
