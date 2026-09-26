// U1 - Modelo de tablero.
//
// Representacion: 81 celdas en una sola tira (array), indexadas 0..80 en
// orden fila por fila. Para un indice i:
//   row = Math.floor(i / 9)
//   col = i % 9
//   box = Math.floor(row / 3) * 3 + Math.floor(col / 3)
//
// String de 81 caracteres: `0` o `.` = celda vacia, `1`-`9` = celda con valor.
// Es el formato de entrada y salida del motor (parse / serialize).

/** Cantidad de celdas de un tablero 9x9. */
export const SIZE = 81;

/** Lado del tablero (filas y columnas). */
export const DIM = 9;

/** Lado de una caja (3x3). */
export const BOX_DIM = 3;

/** Valor para celda vacia. */
export const EMPTY = 0;

/** Indices de cada fila (9 filas de 9 celdas). */
export const ROWS = Object.freeze(
  Array.from({ length: DIM }, (_, r) =>
    Object.freeze(Array.from({ length: DIM }, (_, c) => r * DIM + c)),
  ),
);

/** Indices de cada columna. */
export const COLS = Object.freeze(
  Array.from({ length: DIM }, (_, c) =>
    Object.freeze(Array.from({ length: DIM }, (_, r) => r * DIM + c)),
  ),
);

/** Indices de cada caja 3x3, en orden de lectura (izq->der, arriba->abajo). */
export const BOXES = Object.freeze(
  Array.from({ length: DIM }, (_, b) => {
    const boxRow = Math.floor(b / BOX_DIM) * BOX_DIM;
    const boxCol = (b % BOX_DIM) * BOX_DIM;
    const cells = [];
    for (let r = 0; r < BOX_DIM; r++) {
      for (let c = 0; c < BOX_DIM; c++) {
        cells.push((boxRow + r) * DIM + (boxCol + c));
      }
    }
    return Object.freeze(cells);
  }),
);

/** Fila (0-8) de un indice de celda. */
export function rowOf(index) {
  return Math.floor(index / DIM);
}

/** Columna (0-8) de un indice de celda. */
export function colOf(index) {
  return index % DIM;
}

/** Caja (0-8) de un indice de celda. */
export function boxOf(index) {
  return Math.floor(index / DIM / BOX_DIM) * BOX_DIM + Math.floor((index % DIM) / BOX_DIM);
}

// Vecinos de cada celda (fila + columna + caja, sin repetir ni contarse a si
// misma). Se precalcula una vez: es la consulta mas usada por el solver.
const NEIGHBORS = Object.freeze(
  Array.from({ length: SIZE }, (_, i) => {
    const set = new Set();
    for (const n of ROWS[rowOf(i)]) set.add(n);
    for (const n of COLS[colOf(i)]) set.add(n);
    for (const n of BOXES[boxOf(i)]) set.add(n);
    set.delete(i);
    return Object.freeze([...set]);
  }),
);

/** Vecinos de una celda: las 20 celdas que comparten fila, columna o caja. */
export function neighborsOf(index) {
  return NEIGHBORS[index];
}

/**
 * Tablero de sudoku.
 *
 * `values` es un array de 81 numeros (0 = vacio, 1-9 = valor). `givens` es un
 * array de 81 booleanos que marca las celdas dadas (fijas) del puzzle. Una
 * celda es fija solo si es fija Y tiene valor.
 */
export class Board {
  constructor(values, givens) {
    if (values.length !== SIZE) {
      throw new RangeError(`el tablero necesita ${SIZE} celdas, llego ${values.length}`);
    }
    this.values = Array.from(values);
    this.givens = givens ? Array.from(givens) : new Array(SIZE).fill(false);
  }

  /** Valor (0-9) de una celda. */
  value(index) {
    return this.values[index];
  }

  /** true si la celda es dada (fija) y tiene valor. */
  isGiven(index) {
    return this.givens[index] === true && this.values[index] !== EMPTY;
  }

  /** true si la celda esta vacia. */
  isEmpty(index) {
    return this.values[index] === EMPTY;
  }

  /** Fila (0-8) de un indice. */
  row(index) {
    return rowOf(index);
  }

  /** Columna (0-8) de un indice. */
  col(index) {
    return colOf(index);
  }

  /** Caja (0-8) de un indice. */
  box(index) {
    return boxOf(index);
  }

  /** Vecinos de un indice (20 celdas de fila, columna y caja). */
  neighbors(index) {
    return NEIGHBORS[index];
  }

  /** Copia independiente del tablero. */
  clone() {
    return new Board(this.values, this.givens);
  }

  /**
   * Coloca un valor en una celda editable. Devuelve true si el cambio se
   * aplico. Las celdas fijas y los valores fuera de rango se rechazan.
   */
  set(index, value) {
    if (this.isGiven(index)) return false;
    if (value !== EMPTY && (!Number.isInteger(value) || value < 1 || value > DIM)) {
      throw new RangeError(`valor fuera de rango: ${value}`);
    }
    this.values[index] = value;
    return true;
  }

  /** Vacia una celda editable. Devuelve true si el cambio se aplico. */
  clear(index) {
    return this.set(index, EMPTY);
  }

  /**
   * Candidatos legales de una celda segun las reglas (lo que la celda podria
   * valer sin chocar con sus vecinos). Array de 1 a 9 valores; vacio si no hay.
   */
  candidates(index) {
    if (this.values[index] !== EMPTY) return [];
    const used = new Uint8Array(DIM + 1);
    for (const n of NEIGHBORS[index]) used[this.values[n]] = 1;
    const out = [];
    for (let v = 1; v <= DIM; v++) if (!used[v]) out.push(v);
    return out;
  }

  /** true si todas las celdas tienen valor. No dice si la solucion es valida. */
  isFull() {
    return this.values.every((v) => v !== EMPTY);
  }

  /** String de 81 caracteres (`0` para vacio). */
  serialize() {
    return this.values.map((v) => (v === EMPTY ? "0" : String(v))).join("");
  }

  /**
   * Tablero desde un string de 81 caracteres (`0` o `.` = vacio, `1`-`9` =
   * valor). Las celdas con valor del string quedan marcadas como dadas; cada
   * celda se puede volver a marcar con `setGiven`.
   */
  static parse(text) {
    if (typeof text !== "string") {
      throw new TypeError("el puzzle debe ser un string");
    }
    const clean = text.replace(/\s+/g, "");
    if (clean.length !== SIZE) {
      throw new RangeError(`el puzzle necesita ${SIZE} caracteres, llego ${clean.length}`);
    }
    const values = new Array(SIZE).fill(EMPTY);
    const givens = new Array(SIZE).fill(false);
    for (let i = 0; i < SIZE; i++) {
      const ch = clean[i];
      if (ch === "0" || ch === ".") continue;
      if (ch < "1" || ch > "9") {
        throw new RangeError(`caracter invalido en la posicion ${i}: "${ch}"`);
      }
      values[i] = Number(ch);
      givens[i] = true;
    }
    return new Board(values, givens);
  }

  /** Tablero vacio (todas las celdas editables). */
  static empty() {
    return new Board(new Array(SIZE).fill(EMPTY), new Array(SIZE).fill(false));
  }

  /** Tablero de una grilla de valores, sin celdas fijas. */
  static fromValues(values) {
    return new Board(values, new Array(SIZE).fill(false));
  }
}

/** Atajo de `Board.parse`. */
export function parse(text) {
  return Board.parse(text);
}

/** Atajo de `board.serialize()` sobre un tablero o un array de valores. */
export function serialize(board) {
  if (board instanceof Board) return board.serialize();
  return board.map((v) => (v === EMPTY ? "0" : String(v))).join("");
}

/** true si el indice esta dentro del tablero. */
export function isValidIndex(index) {
  return Number.isInteger(index) && index >= 0 && index < SIZE;
}
