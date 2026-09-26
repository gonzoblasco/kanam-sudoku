// U2 - Tests del generador pseudoaleatorio con semilla.

import test from "node:test";
import assert from "node:assert/strict";

import { createRng, deriveSeed, randomInt, shuffle } from "../src/core/random.js";

test("createRng: misma semilla, misma secuencia", () => {
  const a = createRng(1234);
  const b = createRng(1234);
  for (let i = 0; i < 50; i++) assert.equal(a(), b());
});

test("createRng: semillas distintas, secuencias distintas", () => {
  const a = createRng(1);
  const b = createRng(2);
  let differences = 0;
  for (let i = 0; i < 50; i++) if (a() !== b()) differences++;
  assert.ok(differences > 40, `solo ${differences} diferencias`);
});

test("createRng: valores en [0, 1)", () => {
  const rng = createRng(7);
  for (let i = 0; i < 200; i++) {
    const value = rng();
    assert.ok(value >= 0 && value < 1, `fuera de rango: ${value}`);
  }
});

test("randomInt: dentro de [0, max)", () => {
  const rng = createRng(99);
  for (let i = 0; i < 200; i++) {
    const value = randomInt(rng, 9);
    assert.ok(Number.isInteger(value));
    assert.ok(value >= 0 && value < 9);
  }
});

test("shuffle: no muta y devuelve una permutacion", () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const copy = input.slice();
  const out = shuffle(input, createRng(3));
  assert.deepEqual(input, copy, "no deberia mutar la entrada");
  assert.equal(out.length, input.length);
  assert.deepEqual([...out].sort((a, b) => a - b), copy);
});

test("shuffle: determinista para la misma semilla", () => {
  const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], createRng(42));
  const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], createRng(42));
  assert.deepEqual(a, b);
});

test("deriveSeed: estable y distinta por indice", () => {
  assert.equal(deriveSeed(10, 0), deriveSeed(10, 0));
  const seeds = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((n) => deriveSeed(10, n)));
  assert.equal(seeds.size, 8);
});
