// U6 - Tests de la sesion (partida + cronometro + estadisticas + persistencia).

import test from "node:test";
import assert from "node:assert/strict";

import { GameSession, LEVELS } from "../src/ui/session.js";
import { emptyStats, loadStats, loadGame, saveStats, STORAGE_KEYS } from "../src/ui/persistence.js";
import { DIFFICULTY } from "../src/core/rater.js";

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

// Reloj falso para no esperar de verdad.
function fakeClock(start = 0) {
  let now = start;
  return { now: () => now, advance: (ms) => { now += ms; } };
}

// Generador falso: un puzzle chico y determinista, sin correr el generador real.
// Devuelve `measured` igual al nivel pedido, como el generador real cuando matchea.
const PUZZLE = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const SOLUTION = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
function fakeGenerate(options = {}) {
  return {
    puzzle: PUZZLE,
    solution: SOLUTION,
    measured: options.difficulty ?? DIFFICULTY.EASY,
    maxTier: 0,
  };
}

function session(options = {}) {
  const clock = options.clock ?? fakeClock();
  const s = new GameSession({
    storage: options.storage ?? fakeStorage(),
    generate: options.generate ?? fakeGenerate,
    now: clock.now,
    seed: 1,
  });
  return { s, clock };
}

test("startNew: arranca una partida del nivel pedido", () => {
  const { s } = session();
  s.startNew(DIFFICULTY.EASY);
  assert.equal(s.hasGame(), true);
  assert.equal(s.game.value(0), 5);
  assert.equal(s.timer.isRunning(), true, "el cronometro arranca");
});

test("LEVELS: facil, medio y dificil", () => {
  assert.deepEqual([...LEVELS], [DIFFICULTY.EASY, DIFFICULTY.MEDIUM, DIFFICULTY.HARD]);
});

test("ganar: detiene el cronometro y actualiza estadisticas", () => {
  const { s, clock } = session();
  s.startNew(DIFFICULTY.EASY);
  clock.advance(30000);
  // resolver el tablero
  for (let i = 0; i < 81; i++) {
    if (s.game.value(i) === 0) s.game.board.values[i] = Number(SOLUTION[i]);
  }
  s.afterMutation();
  assert.equal(s.won, true);
  assert.equal(s.timer.isStopped(), true, "el cronometro se detiene al resolver");
  assert.equal(s.stats.won, 1);
  assert.equal(s.stats.played, 1);
  assert.equal(s.stats.streak, 1);
  assert.equal(s.stats.best[DIFFICULTY.EASY], 30000);
});

test("abandonar NO ensucia las estadisticas", () => {
  const store = fakeStorage();
  const { s } = session({ storage: store });
  s.startNew(DIFFICULTY.EASY);
  s.place(2, 4);
  s.abandon();
  const stats = loadStats(store).stats;
  assert.equal(stats.played, 0, "abandonar no cuenta como jugada");
  assert.equal(stats.won, 0);
  assert.equal(stats.streak, 0);
  assert.equal(loadGame(store).game, null, "la partida abandonada se borra");
});

test("pausa: el tiempo en pausa no se acumula", () => {
  const { s, clock } = session();
  s.startNew(DIFFICULTY.EASY);
  clock.advance(5000);
  s.togglePause(); // pausa
  assert.equal(s.timer.isRunning(), false);
  clock.advance(10000); // pausa larga
  assert.equal(s.timer.elapsed(), 5000, "el tiempo pausado no cuenta");
  s.togglePause(); // reanuda
  clock.advance(2000);
  assert.equal(s.timer.elapsed(), 7000);
});

test("persistencia: la partida en curso se guarda y se retoma", () => {
  const store = fakeStorage();
  const clock = fakeClock();
  const first = new GameSession({ storage: store, generate: fakeGenerate, now: clock.now, seed: 1 });
  first.startNew(DIFFICULTY.MEDIUM);
  first.place(2, 4);
  first.toggleNote(3, 7);
  clock.advance(8000);
  first.persist();

  // reabrir: misma storage
  const second = new GameSession({ storage: store, generate: fakeGenerate, now: clock.now, seed: 1 });
  const { restored } = second.load();
  assert.equal(restored, true, "se retoma la partida guardada");
  assert.equal(second.game.value(2), 4);
  assert.equal(second.game.notes[3] & (1 << 6), 1 << 6, "las notas vuelven");
  assert.equal(second.timer.elapsed(), 8000, "el tiempo vuelve");
  assert.equal(second.difficulty, DIFFICULTY.MEDIUM);
});

test("load: sin nada guardado, arranca limpio", () => {
  const { s } = session();
  const result = s.load();
  assert.equal(result.restored, false);
  assert.equal(result.recovered, false);
  assert.equal(s.hasGame(), true, "arranca una partida nueva");
  assert.equal(s.stats.played, 0);
});

test("load: partida corrupta -> arranca limpio y avisa (no crash)", () => {
  const store = fakeStorage({ [STORAGE_KEYS.GAME]: "{{{" });
  const { s, clock } = session({ storage: store });
  const result = s.load();
  assert.equal(result.recovered, true);
  assert.ok(result.reason);
  assert.equal(s.recovered, result.reason);
  assert.equal(s.hasGame(), true, "igual arranca una partida nueva");
  assert.equal(s.timer.isRunning(), true);
  void clock;
});

test("load: estadisticas y partida se cargan juntas", () => {
  const store = fakeStorage();
  const { s: first } = session({ storage: store });
  first.startNew(DIFFICULTY.EASY);
  first.stats = { ...emptyStats(), played: 3, won: 2, streak: 2, best: { facil: 1000 }, results: [] };
  first.persist();
  // guardar stats
  saveStats(store, first.stats);

  const { s: second } = session({ storage: store });
  second.load();
  assert.equal(second.stats.won, 2);
  assert.equal(second.stats.streak, 2);
  assert.equal(second.hasGame(), true);
});

test("restart: reinicia la partida actual", () => {
  const { s } = session();
  s.startNew(DIFFICULTY.EASY, 1);
  s.place(2, 4);
  s.restart();
  assert.equal(s.game.value(2), 0, "el tablero vuelve a empezar");
  assert.equal(s.won, false);
});

test("undo/redo en la sesion persisten el estado", () => {
  const store = fakeStorage();
  const { s } = session({ storage: store });
  s.startNew(DIFFICULTY.EASY);
  s.place(2, 4);
  s.toggleNote(3, 5);
  s.undo();
  assert.equal(s.game.notes[3], 0);
  // y lo persistido refleja el estado deshecho
  const saved = loadGame(store).game;
  assert.equal(saved.notes[3], 0);
});
