// U5 - Tests de las notas por celda.

import test from "node:test";
import assert from "node:assert/strict";

import {
  emptyNotes,
  hasNote,
  toggleNote,
  setNote,
  clearNotes,
  noteDigits,
  notesText,
  candidateMasks,
  autoNotes,
} from "../src/ui/notes.js";
import { bit } from "../src/core/analysis.js";
import { Board } from "../src/core/board.js";

const PUZZLE = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";

test("emptyNotes: 81 ceros", () => {
  const notes = emptyNotes();
  assert.equal(notes.length, 81);
  assert.ok(notes.every((n) => n === 0));
});

test("toggleNote: prende y apaga el bit del candidato", () => {
  const notes = emptyNotes();
  toggleNote(notes, 2, 5);
  assert.equal(hasNote(notes, 2, 5), true);
  assert.equal(hasNote(notes, 2, 4), false);
  toggleNote(notes, 2, 5);
  assert.equal(hasNote(notes, 2, 5), false);
});

test("toggleNote: no toca otras celdas ni otros digitos", () => {
  const notes = emptyNotes();
  toggleNote(notes, 2, 5);
  toggleNote(notes, 2, 7);
  assert.equal(notes[2], bit(5) | bit(7));
  assert.equal(notes[3], 0);
});

test("setNote: fija en on y off", () => {
  const notes = emptyNotes();
  setNote(notes, 10, 3, true);
  assert.equal(hasNote(notes, 10, 3), true);
  setNote(notes, 10, 3, false);
  assert.equal(hasNote(notes, 10, 3), false);
  // fijar dos veces en true no rompe
  setNote(notes, 10, 3, true);
  setNote(notes, 10, 3, true);
  assert.equal(noteDigits(notes, 10).join(","), "3");
});

test("clearNotes: borra todas las de una celda", () => {
  const notes = emptyNotes();
  toggleNote(notes, 5, 1);
  toggleNote(notes, 5, 9);
  clearNotes(notes, 5);
  assert.deepEqual(noteDigits(notes, 5), []);
});

test("noteDigits: ascendente", () => {
  const notes = emptyNotes();
  for (const d of [7, 2, 5]) toggleNote(notes, 0, d);
  assert.deepEqual(noteDigits(notes, 0), [2, 5, 7]);
});

test("notesText: uno, varios y ninguno", () => {
  const notes = emptyNotes();
  assert.equal(notesText(notes, 0), "");
  toggleNote(notes, 0, 4);
  assert.equal(notesText(notes, 0), "4");
  toggleNote(notes, 0, 7);
  toggleNote(notes, 0, 2);
  assert.equal(notesText(notes, 0), "2, 4 y 7");
});

test("candidateMasks: candidatos legales reales del motor", () => {
  const values = PUZZLE.split("").map(Number);
  const masks = candidateMasks(values);
  assert.equal(masks.length, 81);
  // la celda 0 (dada 5) no tiene candidatos
  assert.equal(masks[0], 0);
  // la celda 2 debe tener candidatos reales (los que el motor calcula)
  assert.ok(masks[2] > 0, "la celda vacia 2 deberia tener candidatos");
});

test("candidateMasks: coincide con los candidatos de Board", () => {
  // Board.candidates es la otra via del core; deben coincidir.
  const board = Board.parse(PUZZLE);
  const masks = candidateMasks(board.values);
  for (let i = 0; i < 81; i++) {
    const expected = board.candidates(i).reduce((acc, d) => acc | bit(d), 0);
    assert.equal(masks[i], expected, `celda ${i}`);
  }
});

test("autoNotes: rellena celdas vacias y deja las dadas sin notas", () => {
  const values = PUZZLE.split("").map(Number);
  const notes = emptyNotes();
  autoNotes(notes, values);
  for (let i = 0; i < 81; i++) {
    if (values[i] !== 0) assert.equal(notes[i], 0, `la dada ${i} no lleva notas`);
  }
  // una celda vacia con candidatos reales los tiene anotados
  assert.ok(notes[2] > 0);
});

test("autoNotes: reemplaza notas previas hechas a mano", () => {
  const values = PUZZLE.split("").map(Number);
  const notes = emptyNotes();
  toggleNote(notes, 2, 1);
  toggleNote(notes, 2, 2);
  toggleNote(notes, 2, 3);
  const before = notes[2];
  autoNotes(notes, values);
  assert.notEqual(notes[2], before, "las notas a mano se reemplazan por los candidatos reales");
});
