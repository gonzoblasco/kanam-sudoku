// U1 - Tests del solver y del contador de soluciones.

import test from "node:test";
import assert from "node:assert/strict";

import { Board, parse } from "../src/core/board.js";
import { isSolved, findConflicts } from "../src/core/validator.js";
import { SOLVE_STATUS, countSolutions, solve, solveGrid } from "../src/core/solver.js";

function valuesOf(text) {
  return text.split("").map(Number);
}

// Puzzle facil, solucion unica conocida.
const EASY = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const EASY_SOLUTION = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

// Derivado de EASY_SOLUTION quitando dadas hasta que deja de haber una unica
// solucion: dos grillas distintas lo resuelven.
const MULTI = "004070002000190308000300507050000003020800000700004050001007080200000000305080100";
const MULTI_SOLUTION_A = "834576912567192348192348567458761293629853471713924856941237685286415739375689124";
const MULTI_SOLUTION_B = "134578692567192348892346517458761923629853471713924856941637285286415739375289164";

// Valido en fila, columna y caja, pero sin solucion: la celda 0 no puede ser 4
// una vez que el resto de la grilla esta fijado.
const UNSOLVABLE = "430608010602090308090302060809060403020803090703020806060507080207010605040206070";

// Duplicado en la fila 1 y en la caja 1 (dos 5 en las celdas 0 y 2).
const INVALID = "535070000600195000098000060800060003400803001700020006060000280000419005000080079";

// Puzzle de dificultad alta, para el chequeo de rendimiento.
const HARD = "000000907000420180000705026100904000050000040000507009920108000034059000507000000";

// Puzzle de ejemplo de Wikipedia: solucion unica.
const WIKI = "000000010400000000020000000000050407008000300001090000300400200050100000000806000";

test("solve: puzzle facil, solucion correcta", () => {
  const result = solve(parse(EASY));
  assert.equal(result.status, SOLVE_STATUS.SOLVED);
  assert.equal(result.solution.join(""), EASY_SOLUTION);
  assert.equal(isSolved(result.solution), true);
});

test("solve: no muta la entrada", () => {
  const values = valuesOf(EASY);
  const before = values.join("");
  solve(values);
  assert.equal(values.join(""), before);
});

test("solve: tablero ya resuelto se devuelve tal cual", () => {
  const result = solve(parse(EASY_SOLUTION));
  assert.equal(result.status, SOLVE_STATUS.SOLVED);
  assert.equal(result.solution.join(""), EASY_SOLUTION);
});

test("solve: tablero vacio se resuelve a una grilla valida", () => {
  const result = solve(Board.empty());
  assert.equal(result.status, SOLVE_STATUS.SOLVED);
  assert.equal(isSolved(result.solution), true);
});

test("solve: tablero invalido se reporta con sus conflictos", () => {
  const result = solve(parse(INVALID));
  assert.equal(result.status, SOLVE_STATUS.INVALID);
  assert.equal(result.solution, null);
  assert.ok(result.conflicts.length > 0);
  const row = result.conflicts.find((c) => c.type === "row" && c.index === 0);
  assert.ok(row);
  assert.deepEqual(row.cells, [0, 2]);
  assert.equal(row.value, 5);
});

test("solve: tablero valido sin solucion se reporta, no cuelga", () => {
  const values = valuesOf(UNSOLVABLE);
  assert.deepEqual(findConflicts(values), []); // sin duplicados en ninguna region
  const result = solve(values);
  assert.equal(result.status, SOLVE_STATUS.UNSOLVABLE);
  assert.equal(result.solution, null);
});

test("solve: tablero parcial con mas de una solucion devuelve una valida", () => {
  const result = solve(parse(MULTI));
  assert.equal(result.status, SOLVE_STATUS.SOLVED);
  assert.equal(isSolved(result.solution), true);
  assert.ok([MULTI_SOLUTION_A, MULTI_SOLUTION_B].includes(result.solution.join("")));
});

test("solve: puzzle de dificultad alta, rapido y correcto", () => {
  const start = performance.now();
  const result = solve(parse(HARD));
  const elapsed = performance.now() - start;
  assert.equal(result.status, SOLVE_STATUS.SOLVED);
  assert.equal(isSolved(result.solution), true);
  assert.ok(elapsed < 1000, `tardo ${elapsed.toFixed(1)} ms`);
});

test("solve: puzzle de wikipedia con solucion unica", () => {
  const result = solve(parse(WIKI));
  assert.equal(result.status, SOLVE_STATUS.SOLVED);
  assert.equal(isSolved(result.solution), true);
  assert.equal(countSolutions(valuesOf(WIKI), 2), 1);
});

test("countSolutions: solucion unica cuenta 1", () => {
  assert.equal(countSolutions(valuesOf(EASY), 2), 1);
  assert.equal(countSolutions(valuesOf(WIKI), 2), 1);
});

test("countSolutions: mas de una solucion, corte en 2", () => {
  assert.equal(countSolutions(valuesOf(MULTI), 2), 2);
});

test("countSolutions: corte en 2 no explora todo el arbol", () => {
  // el tablero vacio tiene muchisimas soluciones: el tope debe respetarse
  const start = performance.now();
  const count = countSolutions(Board.empty().values, 2);
  const elapsed = performance.now() - start;
  assert.equal(count, 2);
  assert.ok(elapsed < 500, `tardo ${elapsed.toFixed(1)} ms`);
});

test("countSolutions: cap 1 devuelve 1 aunque haya mas", () => {
  assert.equal(countSolutions(valuesOf(MULTI), 1), 1);
});

test("countSolutions: tablero invalido o sin solucion cuenta 0", () => {
  assert.equal(countSolutions(valuesOf(INVALID), 2), 0);
  assert.equal(countSolutions(valuesOf(UNSOLVABLE), 2), 0);
});

test("countSolutions: no muta la entrada", () => {
  const values = valuesOf(MULTI);
  const before = values.join("");
  countSolutions(values, 2);
  assert.equal(values.join(""), before);
});

test("countSolutions: valida el tamano de la entrada", () => {
  assert.throws(() => countSolutions([1, 2, 3], 2), RangeError);
});

test("solveGrid: atajo que devuelve grilla o null", () => {
  assert.equal(solveGrid(parse(EASY)).join(""), EASY_SOLUTION);
  assert.equal(solveGrid(parse(UNSOLVABLE)), null);
});

test("solve: la grilla resuelta de un puzzle dado es unica y re-resoluble", () => {
  // resolver, tratar la solucion como puzzle nuevo, resolver de nuevo
  const first = solve(parse(EASY)).solution;
  const second = solve(first).solution;
  assert.deepEqual(second, first);
});
