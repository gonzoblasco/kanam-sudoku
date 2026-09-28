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

  // -------------------------------------------------------------------------
  // Tier 3
  // -------------------------------------------------------------------------
  jellyfish(d) {
    const { fish } = d.evidence;
    const { base, cover, digit } = fish;
    return (
      `Mirando cuatro ${unitTypePlural(base[0].type)} a la vez (${unitNumbers(base)}), el ` +
      `${digit} solo puede caer en cuatro ${unitTypePlural(cover[0].type)} ` +
      `(${unitNumbers(cover)}). Como cada una de esas ${unitTypePlural(base[0].type)} ` +
      `necesita su ${digit}, esas cuatro ${unitTypePlural(cover[0].type)} quedan ocupadas. ` +
      `En las demas casillas de ${unitsWithArticle(cover)}, fuera de ${unitsWithArticle(base)}, ` +
      `no puede haber ${digit}.`
    );
  },

  skyscraper(d) {
    const { skyscraper } = d.evidence;
    const { parallel, base, tips, digit } = skyscraper;
    return (
      `El ${digit} solo tiene dos lugares en la ${unitLabel(parallel[0])} y dos en la ` +
      `${unitLabel(parallel[1])}, y las dos parejas se tocan en la ${unitLabel(base)}. Como la ` +
      `${unitLabel(base)} solo admite un ${digit}, al menos uno de los dos extremos que ` +
      `sobresalen (${cellLabel(tips[0])} o ${cellLabel(tips[1])}) va a ser ${digit}. Entonces ` +
      `cualquier casilla que vea a esos dos extremos no puede ser ${digit}.`
    );
  },

  two_string_kite(d) {
    const { kite } = d.evidence;
    const { row, col, tips, hinge, digit } = kite;
    return (
      `En la ${unitLabel(row)} el ${digit} solo cabe en dos casillas, y en la ${unitLabel(col)} ` +
      `tambien: son las unicas de cada linea. Las dos parejas se tocan dentro de una misma caja ` +
      `(entre ${cellLabel(hinge[0])} y ${cellLabel(hinge[1])}). Eso obliga a que uno de los dos ` +
      `extremos libres (${cellLabel(tips[0])} o ${cellLabel(tips[1])}) sea ${digit}. Por eso la ` +
      `casilla que ve a los dos extremos no puede ser ${digit}.`
    );
  },

  unique_rectangle(d) {
    const { rectangle } = d.evidence;
    const { cells, digits, extra } = rectangle;
    const [a, b] = digits;
    return (
      `Estas cuatro casillas (${joinList(cells.map(cellLabel))}) admiten ${a} y ${b}, y tres de ` +
      `ellas no admiten ningun otro numero. Ese rectangulo es un patron mortal: si se ` +
      `completara alternando ${a} y ${b}, el tablero tendria dos soluciones distintas. Como ` +
      `este puzzle tiene solucion unica (lo garantiza el generador), el patron no puede ` +
      `completarse. Por eso la cuarta casilla (${cellLabel(extra)}), que es la unica que admite ` +
      `un numero de mas, no puede ser ${a} ni ${b}.`
    );
  },

  w_wing(d) {
    const { wWing } = d.evidence;
    const { pair, candidates, linkUnit, linkDigit, digit } = wWing;
    return (
      `Estas dos casillas (${cellLabel(pair[0])} y ${cellLabel(pair[1])}) tienen los mismos dos ` +
      `candidatos, ${digitsText(candidates)}, y estan conectadas porque el ${linkDigit} solo ` +
      `puede ir en dos lugares de la ${unitLabel(linkUnit)}, que tocan a cada una de las dos. ` +
      `Pase lo que pase, una de las dos casillas va a ser ${linkDigit} y la otra ${digit}, asi ` +
      `que una de ellas siempre es ${digit}. Por eso, la casilla que ve a las dos no puede ` +
      `ser ${digit}.`
    );
  },

  simple_colors(d) {
    const { colors } = d.evidence;
    const { digit } = colors;
    if (colors.type === "wrap") {
      const [a, b] = colors.cells;
      return (
        `Pinte todos los lugares posibles del ${digit} con dos colores, alternando por los ` +
        `pares: o todos los de un color son ${digit}, o todos los del otro. Estas dos casillas ` +
        `(${cellLabel(a)} y ${cellLabel(b)}) quedaron del mismo color y se ven entre si, asi ` +
        `que ese color no puede ser el correcto. Entonces el ${digit} no puede ir en ninguna ` +
        `de las casillas de ese color.`
      );
    }
    const { cell, colors: groups } = colors;
    const blue = groups[0][0];
    const green = groups[1][0];
    return (
      `Pinte todos los lugares posibles del ${digit} con dos colores, alternando por los ` +
      `pares: o todos los de un color son ${digit}, o todos los del otro. La casilla ` +
      `${cellLabel(cell)} ve a la vez una de un color (${cellLabel(blue)}) y una del otro ` +
      `(${cellLabel(green)}). Sea cual sea el color correcto, esa casilla queda al lado de ` +
      `un ${digit}, asi que no puede ser ${digit}.`
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
