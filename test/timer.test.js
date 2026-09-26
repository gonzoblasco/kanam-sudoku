// U6 - Tests del cronometro.

import test from "node:test";
import assert from "node:assert/strict";

import { Timer, formatDuration } from "../src/ui/timer.js";

// Reloj falso controlado a mano: los tests no esperan de verdad.
function fakeClock(start = 0) {
  let now = start;
  return {
    now: () => now,
    advance: (ms) => { now += ms; },
  };
}

test("formatDuration: mm:ss y h:mm:ss", () => {
  assert.equal(formatDuration(0), "00:00");
  assert.equal(formatDuration(1000), "00:01");
  assert.equal(formatDuration(59000), "00:59");
  assert.equal(formatDuration(60000), "01:00");
  assert.equal(formatDuration(3599000), "59:59");
  assert.equal(formatDuration(3600000), "1:00:00");
  assert.equal(formatDuration(-500), "00:00");
});

test("arranca detenido, sin tiempo", () => {
  const timer = new Timer();
  assert.equal(timer.isRunning(), false);
  assert.equal(timer.elapsed(), 0);
  assert.equal(timer.formatted(), "00:00");
});

test("corriendo: el tiempo crece con el reloj", () => {
  const clock = fakeClock();
  const timer = new Timer(clock.now);
  timer.start();
  clock.advance(5000);
  assert.equal(timer.elapsed(), 5000);
  assert.equal(timer.formatted(), "00:05");
});

test("pausa: el tiempo de pausa NO cuenta", () => {
  const clock = fakeClock();
  const timer = new Timer(clock.now);
  timer.start();
  clock.advance(3000);
  timer.pause();
  assert.equal(timer.elapsed(), 3000, "al pausar queda lo corrido");

  // pasa tiempo con el cronometro pausado
  clock.advance(10000);
  assert.equal(timer.elapsed(), 3000, "el tiempo en pausa no se acumula");
});

test("reanudar: sigue desde lo acumulado, sin el hueco de la pausa", () => {
  const clock = fakeClock();
  const timer = new Timer(clock.now);
  timer.start();
  clock.advance(3000);
  timer.pause();
  clock.advance(10000); // pausa larga
  timer.start();
  clock.advance(2000);
  assert.equal(timer.elapsed(), 5000, "3000 + 2000, sin los 10000 de pausa");
});

test("start: no hace nada si ya corre", () => {
  const clock = fakeClock();
  const timer = new Timer(clock.now);
  timer.start();
  clock.advance(1000);
  assert.equal(timer.start(), false);
  clock.advance(1000);
  assert.equal(timer.elapsed(), 2000, "no reinicia ni duplica el tramo");
});

test("stop: detiene y no vuelve a correr", () => {
  const clock = fakeClock();
  const timer = new Timer(clock.now);
  timer.start();
  clock.advance(4000);
  timer.stop();
  assert.equal(timer.isStopped(), true);
  assert.equal(timer.isRunning(), false);
  clock.advance(5000);
  assert.equal(timer.elapsed(), 4000, "detenido no avanza");
  assert.equal(timer.start(), false, "no reanuda despues de detenido");
});

test("toJSON: guarda el tiempo de juego efectivo", () => {
  const clock = fakeClock();
  const timer = new Timer(clock.now);
  timer.start();
  clock.advance(7000);
  const data = timer.toJSON();
  // Corriendo: lo corrido todavia no esta en `accumulated`, asi que el JSON
  // guarda el tiempo efectivo, no el tramo interno.
  assert.equal(data.elapsedMs, 7000);
  assert.equal(data.stopped, false);
});

test("fromJSON: reabre pausado, sin contar el tiempo de cierre", () => {
  const clock = fakeClock(100000);
  const saved = { elapsedMs: 12000, stopped: false };
  const timer = Timer.fromJSON(saved, clock.now);
  assert.equal(timer.elapsed(), 12000, "retoma el acumulado, no el tiempo de cierre");
  assert.equal(timer.isRunning(), false, "reabre pausado");
  // si el jugador sigue, cuenta desde aca
  timer.start();
  clock.advance(3000);
  assert.equal(timer.elapsed(), 15000);
});

test("ida y vuelta: toJSON -> fromJSON conserva el acumulado", () => {
  const clock = fakeClock();
  const timer = new Timer(clock.now);
  timer.start();
  clock.advance(8000);
  const restored = Timer.fromJSON(timer.toJSON(), clock.now);
  assert.equal(restored.elapsed(), 8000);
});
