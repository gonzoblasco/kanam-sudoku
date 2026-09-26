// U6 - Persistencia en localStorage (logica pura, testeable).
//
// Todo payload lleva `schemaVersion`. Un JSON sin version es deuda: si cambia la
// forma, no hay como migrar. Aca hay version + una migracion (hoy casi identidad)
// y el manejo de datos corruptos o ausentes: la app arranca limpia y lo informa,
// nunca crashea.
//
// El almacenamiento se inyecta (`storage`) para poder testear con un doble sin
// jsdom. Si no se pasa, se usa `globalThis.localStorage` cuando existe.

/** Version actual del esquema de persistencia. */
export const SCHEMA_VERSION = 1;

/** Claves de almacenamiento. */
export const STORAGE_KEYS = Object.freeze({
  GAME: "kanam.sudoku.game",
  STATS: "kanam.sudoku.stats",
});

/** Cuantas partidas terminadas se guardan en el historial. */
export const RESULTS_LIMIT = 10;

/**
 * Migraciones por version de origen. `0` = payload sin `schemaVersion` (formato
 * anterior al versionado). Cada paso devuelve el payload en la version siguiente.
 */
const MIGRATIONS = {
  // 0 -> 1: se le agrega schemaVersion y se normalizan los nombres de campo.
  0: (old) => ({
    schemaVersion: 1,
    puzzle: old.puzzle ?? null,
    values: old.values ?? old.board ?? null,
    notes: old.notes ?? null,
    elapsedMs: old.elapsedMs ?? old.elapsed ?? 0,
    difficulty: old.difficulty ?? null,
    won: Boolean(old.won),
    history: old.history ?? null,
  }),
};

/**
 * Aplica las migraciones hasta la version actual.
 *
 * @returns {{ok: boolean, value: any|null, reason?: string}}
 */
export function migrate(payload, target = SCHEMA_VERSION) {
  if (payload == null || typeof payload !== "object") {
    return { ok: false, value: null, reason: "payload ausente o no es un objeto" };
  }
  let version = Number(payload.schemaVersion);
  if (!Number.isFinite(version)) version = 0; // sin version = formato viejo
  if (version > target) {
    // De una version futura: no se puede bajar sin perder datos.
    return { ok: false, value: null, reason: `version ${version} mayor a la soportada ${target}` };
  }

  let current = payload;
  while (version < target) {
    const step = MIGRATIONS[version];
    if (!step) return { ok: false, value: null, reason: `sin migracion desde la version ${version}` };
    current = step(current);
    version = Number(current.schemaVersion) || version + 1;
  }
  return { ok: true, value: current };
}

// Lectura cruda con manejo de errores: nunca lanza.
function readRaw(storage, key) {
  try {
    const raw = storage?.getItem(key);
    if (raw == null) return { present: false, raw: null };
    return { present: true, raw };
  } catch {
    return { present: true, raw: null, failed: true };
  }
}

// Escritura cruda: devuelve false si no se pudo guardar (cuota, permiso).
function writeRaw(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Resuelve el almacenamiento: el inyectado o `localStorage` si existe. */
function resolveStorage(storage) {
  if (storage) return storage;
  return typeof globalThis !== "undefined" ? globalThis.localStorage : undefined;
}

/**
 * Carga un payload con migracion. `recovered: true` significa que habia algo
 * guardado que no se pudo usar (JSON roto, version incompatible) y se ignoro.
 *
 * @returns {{value: any|null, recovered: boolean, reason: string|null}}
 */
export function loadMigrated(storage, key) {
  const store = resolveStorage(storage);
  const { present, raw, failed } = readRaw(store, key);
  if (!present) return { value: null, recovered: false, reason: null };
  if (failed) return { value: null, recovered: true, reason: "no se pudo leer el almacenamiento" };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { value: null, recovered: true, reason: "el JSON guardado esta corrupto" };
  }

  const result = migrate(parsed);
  if (!result.ok) return { value: null, recovered: true, reason: result.reason };
  return { value: result.value, recovered: false, reason: null };
}

/** Guarda un payload versionado. */
export function saveMigrated(storage, key, value) {
  return writeRaw(resolveStorage(storage), key, { schemaVersion: SCHEMA_VERSION, ...value });
}

/** Borra una clave. */
export function clearStored(storage, key) {
  try {
    resolveStorage(storage)?.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

// --- partida en curso -------------------------------------------------------

/**
 * Serializa una partida para guardarla.
 *
 * @param {{puzzle: string, values: number[], notes: number[], elapsedMs: number,
 *          difficulty: string|null, won: boolean, history: object|null}} game
 */
export function serializeGame(game) {
  const history = game.history
    ? {
        cursor: game.history.cursor,
        entries: game.history.entries.map((entry) => ({
          values: Array.from(entry.values),
          notes: Array.from(entry.notes),
        })),
      }
    : null;
  return {
    puzzle: game.puzzle,
    values: Array.from(game.values),
    notes: Array.from(game.notes),
    elapsedMs: game.elapsedMs,
    difficulty: game.difficulty ?? null,
    won: Boolean(game.won),
    history,
  };
}

/**
 * Deserializa una partida. Devuelve null si el payload no tiene la forma minima.
 */
export function deserializeGame(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (!Array.isArray(payload.values) || payload.values.length !== 81) return null;
  const notes = Array.isArray(payload.notes) && payload.notes.length === 81
    ? Array.from(payload.notes)
    : new Array(81).fill(0);
  const history = payload.history && Array.isArray(payload.history.entries)
    ? {
        cursor: Number(payload.history.cursor) || 0,
        entries: payload.history.entries.map((entry) => ({
          values: Array.from(entry.values ?? []),
          notes: Array.from(entry.notes ?? []),
        })),
      }
    : null;
  return {
    puzzle: payload.puzzle ?? null,
    values: Array.from(payload.values),
    notes,
    elapsedMs: Number(payload.elapsedMs) || 0,
    difficulty: payload.difficulty ?? null,
    won: Boolean(payload.won),
    history,
  };
}

/** Guarda la partida en curso. */
export function saveGame(storage, game) {
  return saveMigrated(storage, STORAGE_KEYS.GAME, serializeGame(game));
}

/**
 * Carga la partida guardada.
 * @returns {{game: object|null, recovered: boolean, reason: string|null}}
 */
export function loadGame(storage) {
  const { value, recovered, reason } = loadMigrated(resolveStorage(storage), STORAGE_KEYS.GAME);
  if (!value) return { game: null, recovered, reason };
  const game = deserializeGame(value);
  if (!game) return { game: null, recovered: true, reason: "la partida guardada no tiene la forma esperada" };
  return { game, recovered: false, reason: null };
}

export function clearGame(storage) {
  return clearStored(resolveStorage(storage), STORAGE_KEYS.GAME);
}

// --- estadisticas -----------------------------------------------------------

/** Estadisticas vacias. */
export function emptyStats() {
  return {
    played: 0,
    won: 0,
    streak: 0,
    best: {}, // dificultad -> mejor tiempo en ms
    results: [], // partidas terminadas, las ultimas RESULTS_LIMIT
  };
}

/**
 * Registra una victoria. Es el UNICO mutador de estadisticas: abandonar una
 * partida no cambia nada (FR-6, y el test que lo cubre).
 *
 * @param {object} stats
 * @param {{difficulty?: string|null, ms: number, at?: number}} result
 * @returns {object} estadisticas nuevas (no muta la entrada)
 */
export function recordWin(stats, result) {
  const next = {
    played: stats.played + 1,
    won: stats.won + 1,
    streak: stats.streak + 1,
    best: { ...stats.best },
    results: Array.from(stats.results),
  };
  const difficulty = result.difficulty ?? "sin-nivel";
  const current = next.best[difficulty];
  if (current == null || result.ms < current) next.best[difficulty] = result.ms;
  next.results.unshift({
    difficulty: result.difficulty ?? null,
    ms: result.ms,
    at: result.at ?? null,
  });
  if (next.results.length > RESULTS_LIMIT) next.results.length = RESULTS_LIMIT;
  return next;
}

export function saveStats(storage, stats) {
  return saveMigrated(storage, STORAGE_KEYS.STATS, stats);
}

/**
 * Carga las estadisticas.
 * @returns {{stats: object, recovered: boolean, reason: string|null}}
 */
export function loadStats(storage) {
  const { value, recovered, reason } = loadMigrated(resolveStorage(storage), STORAGE_KEYS.STATS);
  if (!value) return { stats: emptyStats(), recovered, reason };
  return {
    stats: {
      played: Number(value.played) || 0,
      won: Number(value.won) || 0,
      streak: Number(value.streak) || 0,
      best: value.best && typeof value.best === "object" ? { ...value.best } : {},
      results: Array.isArray(value.results) ? value.results.slice(0, RESULTS_LIMIT) : [],
    },
    recovered: false,
    reason: null,
  };
}

export function clearStats(storage) {
  return clearStored(resolveStorage(storage), STORAGE_KEYS.STATS);
}
