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
