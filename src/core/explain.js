// U3 - Motor de explicaciones: convierte una deduccion en texto llano.
//
// El texto NO es una frase fija por tecnica: se construye desde `evidence`, asi
// que nombra la unidad y los digitos reales de cada paso. Eso es un requisito de
// accesibilidad (NFR-4): un lector de pantalla tiene que poder usar el hint sin
// ver la grilla, y el resaltado de color no puede ser la unica fuente.
//
// Base de redaccion: campo "Explicacion llana" de `RESEARCH-TECNICAS.md` secciones
// 2 y 3, parametrizado con el estado real. No se agrega teoria nueva.
//
// Uso: `explain(deduction)` devuelve un string en español. `findDeduction` lo
// adjunta al campo `text` de cada deduccion.

import { UNIT_TYPE, unitLabel } from "./analysis.js";

/** "fila 3, columna 5" (1-based). */
export function cellLabel(cell) {
  return `fila ${Math.floor(cell / 9) + 1}, columna ${(cell % 9) + 1}`;
}

function rowOf(cell) {
  return Math.floor(cell / 9) + 1;
}

function colOf(cell) {
  return (cell % 9) + 1;
}

function joinList(items) {
  if (items.length === 0) return "";
  if (items.length === 1) return String(items[0]);
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

function digitsText(digits) {
  return joinList(digits.map(String));
}

/** Numeros de unidad sin articulo, para meter en una frase: "1, 6 y 7". */
function unitNumbers(units) {
  return joinList(units.map((u) => u.index + 1));
}

function unitTypePlural(type) {
  if (type === UNIT_TYPE.ROW) return "filas";
  if (type === UNIT_TYPE.COL) return "columnas";
  return "cajas";
}

/** "las filas 1 y 4" / "las columnas 2 y 7" / "las cajas 3, 5 y 7". */
function unitsWithArticle(units) {
  return `las ${unitTypePlural(units[0].type)} ${unitNumbers(units)}`;
}

/**
 * Describe las casillas de un subset nombrando la coordenada que las distingue
 * dentro de la unidad, en vez de repetir "fila X, columna Y" en cada una.
 *
 * - En una fila, las casillas se distinguen por columna: "las casillas de las
 *   columnas 3, 5 y 7".
 * - En una columna, por fila: "las casillas de las filas 1, 2 y 9".
 * - En una caja no hay un eje unico, asi que se listan las coordenadas.
 */
function subsetPhrase(unit, cells) {
  const sorted = cells.slice().sort((a, b) => a - b);
  if (unit.type === UNIT_TYPE.ROW) {
    return `las casillas de las columnas ${joinList(sorted.map(colOf))}`;
  }
  if (unit.type === UNIT_TYPE.COL) {
    return `las casillas de las filas ${joinList(sorted.map(rowOf))}`;
  }
  return `las casillas ${joinList(sorted.map((c) => `(fila ${rowOf(c)}, columna ${colOf(c)})`))}`;
}

const EXPLAINERS = {
  // -------------------------------------------------------------------------
  // Tier 0
  // -------------------------------------------------------------------------
  full_house(d) {
    const { unit, cells, digit } = d.evidence;
    return (
      `La ${unitLabel(unit)} ya tiene ocho casillas llenas. ` +
      `Falta un solo numero: el ${digit}. La unica casilla vacia es ${cellLabel(cells[0])}; ` +
      `ahi va el ${digit}.`
    );
  },

  hidden_single(d) {
    const { unit, cells, digit } = d.evidence;
    return (
      `En la ${unitLabel(unit)}, el ${digit} solo cabe en una casilla: ${cellLabel(cells[0])}. ` +
      `Aunque esa casilla tenga otras anotaciones, el ${digit} no tiene otro lugar en la unidad, ` +
      `asi que va ahi.`
    );
  },

  naked_single(d) {
    const { cells, digit } = d.evidence;
    return (
      `En la casilla ${cellLabel(cells[0])} ya no cabe ningun otro numero: ` +
      `su fila, su columna y su caja ya usan los demas. Solo queda el ${digit}.`
    );
  },

  // -------------------------------------------------------------------------
  // Tier 1
  // -------------------------------------------------------------------------
  locked_candidates_pointing(d) {
    const { unit, line, digit } = d.evidence;
    return (
      `En la ${unitLabel(unit)}, el ${digit} solo puede ir en la ${unitLabel(line)}. ` +
      `Como la ${unitLabel(unit)} necesita un ${digit}, ese ${digit} va a caer en ` +
      `la ${unitLabel(line)}. Entonces, en el resto de la ${unitLabel(line)}, fuera de ` +
      `la ${unitLabel(unit)}, no puede haber ${digit}.`
    );
  },

  locked_candidates_claiming(d) {
    const { unit, box, digit } = d.evidence;
    return (
      `En la ${unitLabel(unit)}, el ${digit} solo puede ir dentro de la ${unitLabel(box)}. ` +
      `Entonces, en el resto de la ${unitLabel(box)}, no puede haber ${digit}.`
    );
  },

  naked_pair(d) {
    const { unit, cells, digits } = d.evidence;
    return (
      `En la ${unitLabel(unit)}, ${subsetPhrase(unit, cells)} solo admiten ` +
      `${digitsText(digits)}. Entre las dos se reparten esos dos numeros, asi que ningun otro ` +
      `lugar de la ${unitLabel(unit)} puede ser ${digitsText(digits)}.`
    );
  },

  hidden_pair(d) {
    const { unit, cells, digits } = d.evidence;
    return (
      `En la ${unitLabel(unit)}, los numeros ${digitsText(digits)} solo caben en ` +
      `${subsetPhrase(unit, cells)}. Aunque tengan otras anotaciones, esas otras no pueden ir ` +
      `ahi: esas dos casillas son para el ${digitsText(digits)}.`
    );
  },

  naked_triple(d) {
    const { unit, cells, digits } = d.evidence;
    return (
      `En la ${unitLabel(unit)}, ${subsetPhrase(unit, cells)}, juntas, solo pueden ` +
      `recibir ${digitsText(digits)}. Entre las tres se reparten esos numeros, asi que en el ` +
      `resto de la ${unitLabel(unit)} no puede ir ninguno de ellos.`
    );
  },

  // -------------------------------------------------------------------------
  // Tier 2
  // -------------------------------------------------------------------------
  hidden_triple(d) {
    const { unit, cells, digits } = d.evidence;
    return (
      `En la ${unitLabel(unit)}, los numeros ${digitsText(digits)} solo caben en ` +
      `${subsetPhrase(unit, cells)}. Cualquier otra anotacion en ellas no puede ir ahi.`
    );
  },

  naked_quad(d) {
    const { unit, cells, digits } = d.evidence;
    return (
      `En la ${unitLabel(unit)}, ${subsetPhrase(unit, cells)}, juntas, solo pueden ` +
      `recibir ${digitsText(digits)}. Entre las cuatro se reparten esos numeros, asi que en el ` +
      `resto de la ${unitLabel(unit)} no puede ir ninguno de ellos.`
    );
  },

  x_wing(d) {
    const { fish } = d.evidence;
    const { base, cover, digit } = fish;
    return (
      `El ${digit} aparece solo dos veces en la ${unitLabel(base[0])} y solo dos veces en ` +
      `la ${unitLabel(base[1])}, y en las dos cae en las mismas dos casillas: las ` +
      `${unitTypePlural(cover[0].type)} ${unitNumbers(cover)}. Entre esas cuatro casillas se ` +
      `acomodan los dos ${digit}. Entonces, en ${unitsWithArticle(cover)}, fuera de ` +
      `${unitsWithArticle(base)}, no puede haber ${digit}.`
    );
  },

  swordfish(d) {
    const { fish } = d.evidence;
    const { base, cover, digit } = fish;
    return (
      `El ${digit} solo puede ir en dos o tres casillas de cada una de estas tres ` +
      `${unitTypePlural(base[0].type)} (${unitNumbers(base)}), y todas caen dentro de las mismas ` +
      `tres ${unitTypePlural(cover[0].type)} (${unitNumbers(cover)}). Cada una de esas ` +
      `${unitTypePlural(base[0].type)} necesita un ${digit}, y los tres ${digit} se acomodan en ` +
      `${unitsWithArticle(cover)}. Entonces, en ${unitsWithArticle(cover)}, fuera de ` +
      `${unitsWithArticle(base)}, no puede haber ${digit}.`
    );
  },

  xy_wing(d) {
    const { wing } = d.evidence;
    const { pivot, pincers, z } = wing;
    const [x, y] = pivot.candidates;
    const a = pincers[0];
    const b = pincers[1];
    const ax = a.candidates.find((v) => v !== z);
    const by = b.candidates.find((v) => v !== z);
    return (
      `Mira estas tres casillas. La del medio (${cellLabel(pivot.cell)}) tiene ${x} y ${y}; ` +
      `una punta (${cellLabel(a.cell)}) tiene ${ax} y ${z}; la otra (${cellLabel(b.cell)}) tiene ` +
      `${by} y ${z}. Si el medio es ${x}, la primera punta es ${z}; si el medio es ${y}, la ` +
      `segunda punta es ${z}. En cualquier caso, una de las dos puntas es ${z}. Entonces la ` +
      `casilla que ve a las dos puntas no puede ser ${z}.`
    );
  },

  xyz_wing(d) {
    const { wing } = d.evidence;
    const { pivot, pincers, z } = wing;
    const others = pivot.candidates.filter((v) => v !== z);
    const [x, y] = others;
    const a = pincers[0];
    const b = pincers[1];
    return (
      `Aca la casilla del medio (${cellLabel(pivot.cell)}) tiene ${x}, ${y} y ${z}; una punta ` +
      `(${cellLabel(a.cell)}) tiene ${x} y ${z}; la otra (${cellLabel(b.cell)}) tiene ${y} y ${z}. ` +
      `Si el medio fuera ${x}, una punta seria ${z}; si fuera ${y}, la otra punta seria ${z}; y ` +
      `si fuera ${z}, el mismo seria ${z}. De cualquier forma hay un ${z} entre esas tres ` +
      `casillas. Entonces las casillas que ven a las tres no pueden ser ${z}.`
    );
  },
};

/**
 * Construye el texto llano (español) de una deduccion a partir de su `evidence`.
 *
 * @param {object} deduction
 * @returns {string}
 */
export function explain(deduction) {
  const builder = EXPLAINERS[deduction.technique];
  if (!builder) {
    // Tecnica sin redaccion propia: no deberia pasar en tier 0-2. Se devuelve
    // algo honesto en vez de inventar teoria.
    const cells = deduction.evidence?.cells ?? [];
    return `Deduccion por la tecnica ${deduction.technique} sobre las casillas ` +
      `${joinList(cells.map(cellLabel))}.`;
  }
  return builder(deduction);
}

export { EXPLAINERS };
