// U6 - Tests de persistencia (version de esquema, corrupcion, stats).

import test from "node:test";
import assert from "node:assert/strict";

import {
  SCHEMA_VERSION,
  STORAGE_KEYS,
  RESULTS_LIMIT,
  migrate,
  loadMigrated,
  saveMigrated,
  clearStored,
  serializeGame,
  deserializeGame,
  saveGame,
  loadGame,
  clearGame,
  emptyStats,
  recordWin,
  saveStats,
  loadStats,
} from "../src/ui/persistence.js";

// Doble de localStorage, sin jsdom.
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    _map: map,
  };
}

function fullValues() {
  return new Array(81).fill(0).map((_, i) => (i % 9 === 0 ? 5 : 0));
}

const VALID_GAME = {
  puzzle: "5".repeat(81),
  values: fullValues(),
  notes: new Array(81).fill(0),
  elapsedMs: 12345,
  difficulty: "facil",
  won: false,
  history: null,
};

test("migrate: payload actual pasa sin cambios", () => {
  const payload = { schemaVersion: SCHEMA_VERSION, a: 1 };
  const result = migrate(payload);
  assert.equal(result.ok, true);
  assert.equal(result.value.a, 1);
});

test("migrate: payload viejo SIN schemaVersion se migra (no explota)", () => {
  // Formato anterior: sin schemaVersion, con `board` en vez de `values`.
  const old = { board: [1, 2, 3], elapsed: 5000, difficulty: "medio" };
  const result = migrate(old);
  assert.equal(result.ok, true);
  assert.equal(result.value.schemaVersion, 1);
  assert.deepEqual(result.value.values, [1, 2, 3]);
  assert.equal(result.value.elapsedMs, 5000);
  assert.equal(result.value.difficulty, "medio");
});

test("migrate: version futura se rechaza en vez de degradar", () => {
  const result = migrate({ schemaVersion: 99 });
  assert.equal(result.ok, false);
  assert.match(result.reason, /mayor/);
});

test("migrate: null y no-objeto se rechazan", () => {
  assert.equal(migrate(null).ok, false);
  assert.equal(migrate("texto").ok, false);
  assert.equal(migrate(42).ok, false);
});

test("loadMigrated: clave ausente -> sin recuperar nada", () => {
  const result = loadMigrated(fakeStorage(), "x");
  assert.equal(result.value, null);
  assert.equal(result.recovered, false);
});

test("loadMigrated: JSON corrupto -> recovered, sin crash", () => {
  const store = fakeStorage({ x: "{esto no es json" });
  const result = loadMigrated(store, "x");
  assert.equal(result.value, null);
  assert.equal(result.recovered, true);
  assert.match(result.reason, /corrupto/);
});

test("saveMigrated: agrega schemaVersion al guardar", () => {
  const store = fakeStorage();
  saveMigrated(store, "x", { a: 1 });
  const saved = JSON.parse(store.getItem("x"));
  assert.equal(saved.schemaVersion, SCHEMA_VERSION);
  assert.equal(saved.a, 1);
});

test("saveMigrated + loadMigrated: ida y vuelta", () => {
  const store = fakeStorage();
  saveMigrated(store, "x", { a: 1, b: [1, 2] });
  const result = loadMigrated(store, "x");
  assert.equal(result.value.a, 1);
  assert.deepEqual(result.value.b, [1, 2]);
});

test("clearStored: borra la clave", () => {
  const store = fakeStorage({ x: "{}" });
  clearStored(store, "x");
  assert.equal(store.getItem("x"), null);
});

// --- partida en curso -------------------------------------------------------

test("serializeGame / deserializeGame: ida y vuelta identica", () => {
  const game = {
    puzzle: "5".repeat(81),
    values: fullValues(),
    notes: new Array(81).fill(0).map((_, i) => (i % 2 ? 3 : 0)),
    elapsedMs: 999,
    difficulty: "medio",
    won: false,
    history: {
      cursor: 1,
      entries: [
        { values: fullValues(), notes: new Array(81).fill(0) },
        { values: fullValues(), notes: new Array(81).fill(1) },
      ],
    },
  };
  const round = deserializeGame(serializeGame(game));
  assert.deepEqual(round.values, game.values);
  assert.deepEqual(round.notes, game.notes);
  assert.equal(round.elapsedMs, 999);
  assert.equal(round.difficulty, "medio");
  assert.equal(round.history.cursor, 1);
  assert.equal(round.history.entries.length, 2);
});

test("deserializeGame: rechaza una forma invalida", () => {
  assert.equal(deserializeGame(null), null);
  assert.equal(deserializeGame({ values: [1, 2] }), null, "no tiene 81 valores");
});

test("saveGame + loadGame: ida y vuelta en localStorage", () => {
  const store = fakeStorage();
  saveGame(store, VALID_GAME);
  const { game, recovered } = loadGame(store);
  assert.equal(recovered, false);
  assert.deepEqual(game.values, VALID_GAME.values);
  assert.equal(game.elapsedMs, 12345);
});

test("loadGame: partida guardada corrupta -> recovered, sin crash", () => {
  const store = fakeStorage({ [STORAGE_KEYS.GAME]: "{{{" });
  const { game, recovered, reason } = loadGame(store);
  assert.equal(game, null);
  assert.equal(recovered, true);
  assert.ok(reason);
});

test("loadGame: partida guardada sin forma -> recovered", () => {
  const store = fakeStorage();
  saveMigrated(store, STORAGE_KEYS.GAME, { values: [1, 2, 3] });
  const { game, recovered } = loadGame(store);
  assert.equal(game, null);
  assert.equal(recovered, true);
});

test("clearGame: borra la partida", () => {
  const store = fakeStorage();
  saveGame(store, VALID_GAME);
  clearGame(store);
  assert.equal(loadGame(store).game, null);
});

// --- estadisticas -----------------------------------------------------------

test("emptyStats: arranca en cero", () => {
  const stats = emptyStats();
  assert.equal(stats.played, 0);
  assert.equal(stats.won, 0);
  assert.equal(stats.streak, 0);
  assert.deepEqual(stats.best, {});
  assert.deepEqual(stats.results, []);
});

test("recordWin: suma jugada, victoria y racha; guarda el mejor por nivel", () => {
  let stats = emptyStats();
  stats = recordWin(stats, { difficulty: "facil", ms: 60000 });
  assert.equal(stats.played, 1);
  assert.equal(stats.won, 1);
  assert.equal(stats.streak, 1);
  assert.equal(stats.best.facil, 60000);

  stats = recordWin(stats, { difficulty: "facil", ms: 45000 });
  assert.equal(stats.best.facil, 45000, "mejora el mejor tiempo");

  stats = recordWin(stats, { difficulty: "facil", ms: 90000 });
  assert.equal(stats.best.facil, 45000, "un tiempo peor no pisa el mejor");
  assert.equal(stats.streak, 3);
});

test("recordWin: no muta las estadisticas de entrada", () => {
  const stats = emptyStats();
  const next = recordWin(stats, { difficulty: "facil", ms: 1000 });
  assert.equal(stats.played, 0, "el original queda intacto");
  assert.equal(next.played, 1);
});

test("recordWin: el historial guarda las ultimas N", () => {
  let stats = emptyStats();
  for (let i = 0; i < RESULTS_LIMIT + 5; i++) {
    stats = recordWin(stats, { difficulty: "facil", ms: 1000 + i });
  }
  assert.equal(stats.results.length, RESULTS_LIMIT);
  // la mas nueva primero
  assert.equal(stats.results[0].ms, 1000 + RESULTS_LIMIT + 4);
});

test("abandonar una partida NO ensucia las estadisticas", () => {
  // Regla critica: solo `recordWin` toca las stats. Abandonar = no llamarlo.
  const store = fakeStorage();
  let stats = emptyStats();
  stats = recordWin(stats, { difficulty: "facil", ms: 30000 });
  saveStats(store, stats);

  // el jugador abandona: no se registra nada
  const loaded = loadStats(store).stats;
  assert.equal(loaded.played, 1);
  assert.equal(loaded.won, 1);
  assert.equal(loaded.streak, 1);
});

test("saveStats + loadStats: ida y vuelta", () => {
  const store = fakeStorage();
  const stats = recordWin(emptyStats(), { difficulty: "dificil", ms: 120000 });
  saveStats(store, stats);
  const loaded = loadStats(store).stats;
  assert.equal(loaded.won, 1);
  assert.equal(loaded.best.dificil, 120000);
});

test("loadStats: almacenamiento corrupto -> stats limpias, recovered", () => {
  const store = fakeStorage({ [STORAGE_KEYS.STATS]: "no-json" });
  const { stats, recovered, reason } = loadStats(store);
  assert.equal(recovered, true);
  assert.ok(reason);
  assert.equal(stats.played, 0);
  assert.equal(stats.streak, 0);
});

test("loadStats: sin nada guardado -> stats limpias, sin recovered", () => {
  const { stats, recovered } = loadStats(fakeStorage());
  assert.equal(recovered, false);
  assert.equal(stats.played, 0);
});
