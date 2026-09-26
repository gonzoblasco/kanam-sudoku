// U2 - Generador pseudoaleatorio con semilla.
//
// El motor necesita aleatoriedad reproducible: el generador recibe una semilla
// y para la misma semilla produce siempre el mismo puzzle. Nada de Math.random
// en el motor, porque los tests no serian deterministas.
//
// Algoritmo: mulberry32 (PRNG de 32 bits, rapido y de calidad suficiente para
// barajar). Es puro: solo depende del estado interno que arranca en la semilla.

/**
 * Crea un PRNG determinista a partir de una semilla.
 *
 * @param {number} seed semilla (cualquier entero; se normaliza a 32 bits)
 * @returns {() => number} funcion que devuelve un float en [0, 1)
 */
export function createRng(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Entero aleatorio en [0, maxExclusive).
 *
 * @param {() => number} rng
 * @param {number} maxExclusive
 */
export function randomInt(rng, maxExclusive) {
  return Math.floor(rng() * maxExclusive);
}

/**
 * Baraja una copia del array con Fisher-Yates. No muta la entrada.
 *
 * @template T
 * @param {T[]} items
 * @param {() => number} rng
 * @returns {T[]}
 */
export function shuffle(items, rng) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * Deriva una semilla nueva a partir de una semilla base y un indice, para poder
 * pedir "el intento N" de un generador sin depender del estado interno.
 *
 * @param {number} seed
 * @param {number} n
 */
export function deriveSeed(seed, n) {
  return (Math.imul(seed >>> 0, 0x9e3779b1) + Math.imul(n + 1, 0x85ebca6b)) >>> 0;
}
