// U5 - Notas por celda (logica pura, testeable).
//
// Cada celda tiene una mascara de 9 bits: `bit (d-1)` encendido = el candidato d
// esta anotado. Es la misma convencion que `analysis.js` (research 6.1), asi que
// el tablero de notas y el motor de candidatos hablan el mismo idioma.
//
// Las funciones mutan el array que reciben y lo devuelven, igual que `Board.set`:
// el historial de undo guarda copias, asi que mutar no es un problema.

import { SIZE } from "../core/board.js";
import { analyze, bit, maskDigits } from "../core/analysis.js";

/** Notas vacias: 81 mascaras en 0. */
export function emptyNotes() {
  return new Array(SIZE).fill(0);
}

/** true si la celda tiene el candidato anotado. */
export function hasNote(notes, cell, digit) {
  return (notes[cell] & bit(digit)) !== 0;
}

/** Prende o apaga una nota y devuelve el array. */
export function toggleNote(notes, cell, digit) {
  notes[cell] ^= bit(digit);
  return notes;
}

/** Fija una nota en on/off. */
export function setNote(notes, cell, digit, on) {
  if (on) notes[cell] |= bit(digit);
  else notes[cell] &= ~bit(digit);
  return notes;
}

/** Borra todas las notas de una celda. */
export function clearNotes(notes, cell) {
  notes[cell] = 0;
  return notes;
}

/** Digitos anotados en una celda, ascendente. */
export function noteDigits(notes, cell) {
  return maskDigits(notes[cell]);
}

/**
 * Candidatos legales reales de un tablero, como mascaras por celda. Usa el motor
 * de `analysis.js`: no recalcula la logica de candidatos aca.
 *
 * @param {number[]} values 81 valores
 * @returns {number[]} 81 mascaras (0 en celdas con valor)
 */
export function candidateMasks(values) {
  return analyze(values).candidates.slice();
}

/**
 * Auto-notas: reemplaza las notas de las celdas vacias por sus candidatos
 * legales reales. Las celdas con valor quedan sin notas.
 */
export function autoNotes(notes, values) {
  const masks = candidateMasks(values);
  for (let cell = 0; cell < SIZE; cell++) {
    notes[cell] = values[cell] === 0 ? masks[cell] : 0;
  }
  return notes;
}

/**
 * Texto legible de las notas de una celda: "2, 5 y 7", o "" si no hay ninguna.
 * Lo usa el aria-label para que un lector de pantalla pueda leer las notas.
 */
export function notesText(notes, cell) {
  const digits = noteDigits(notes, cell);
  if (digits.length === 0) return "";
  if (digits.length === 1) return String(digits[0]);
  return `${digits.slice(0, -1).join(", ")} y ${digits[digits.length - 1]}`;
}
