# Contrato de deduccion - Kanam SUDOKU

<!-- project: github.com/gonzoblasco/kanam-sudoku -->

API interna compartida por el rater (U2), el motor de tecnicas y los hints (U3)
y la UI (U7). Define en un solo lugar que devuelve una deduccion, para que U3 no
tenga que reescribir el motor y la UI no tenga que adivinar la forma.

Implementacion: `src/core/techniques.js`. Primitivas: `src/core/analysis.js`.

## Forma

```js
{
  technique: "hidden_single",   // id canonico en INGLES, estable
  tier: 0,                      // 0 facil, 1 medio, 2 dificil, 3 experto
  er: 1.5,                      // rating de referencia (Sudoku Explainer)
  action: "place",              // "place" | "eliminate"
  targets: [                    // lo unico que muta el tablero
    { cell: 42, kind: "place", digit: 6 },
  ],
  evidence: {                   // que resaltar; no muta nada
    unit: { type: "row", index: 2 },  // o null
    cells: [42, 43],                  // casillas del razonamiento
    digit: 6,                         // digito principal, o null
    digits: [1, 7],                   // varios digitos (subsets), o null
    byDigit: [                        // casillas candidatas por digito, o null
      { digit: 1, cells: [42, 43] },
    ],
    // Campos extra que consumen algunos textos, o null:
    line: { type: "row", index: 2 },  // pointing: la linea dentro de la caja
    box: { type: "box", index: 3 },   // claiming: la caja dentro de la linea
    fish: { base: [...], cover: [...], digit: 6 }, // x_wing / swordfish
    wing: { pivot: {...}, pincers: [...], z: 3 },  // xy_wing / xyz_wing
  },
  text: "En la fila 3, el 6 solo cabe en ...",  // explicacion llana (U3)
}
```

## Reglas

- **`targets` es lo unico que muta el tablero.** Una deduccion sin targets no es
  una deduccion. `AnalysisState.applyDeduction` solo mira `targets`.
- **`evidence` es solo para mostrar.** No cambia el estado. Nombra la unidad y el
  digito en texto porque el resaltado no puede depender solo del color (NFR-4):
  la UI puede pintar, pero tambien tiene que poder decir "fila 3, digito 6".
- **Id en ingles.** La nomenclatura en español no es canonica (research, seccion
  8.1). El id es ingles y estable; el nombre en español vive en
  `TECHNIQUE_LABELS` y es solo etiqueta de UI.
- **Una deduccion tiene que estar justificada.** `verifyDeduction(state, d)`
  comprueba que cada target sea legal en el estado actual (casilla vacia, digito
  candidato). El rater verifica antes de aplicar; un paso sin justificacion es un
  bug, no un redondeo.
- **`text` es la explicacion llana**, en español, lista para mostrar. No es un
  string fijo por tecnica: se **construye desde `evidence`** con `explain()`, asi
  que nombra la unidad y los digitos reales de cada paso. Eso es un requisito de
  accesibilidad (NFR-4): un lector de pantalla tiene que poder usar el hint sin
  ver la grilla, y el resaltado de color no puede ser la unica fuente. U3 lo
  adjunta en `makeDeduction`.

## Tier: la tabla de niveles manda, no el ER

La **pertenencia a un tier la define la tabla de niveles del research (seccion
4.2)**, no una aritmetica de ER (SPEC 7bis). El ER **ordena** la evaluacion
ascendente dentro del catalogo (`TECHNIQUES.sort` por `er`) y sirve de
diagnostico, pero nunca decide el nivel: los ER se solapan entre tiers a
proposito (X-Wing tiene ER 3.2 y es Dificil; hidden triple 4.0 y naked triple
3.6).

| Tier | Nivel | Tecnicas |
|---|---|---|
| 0 | Facil | full house, hidden single, naked single |
| 1 | Medio | + locked candidates (pointing, claiming), naked pair, hidden pair, naked triple |
| 2 | Dificil | + hidden triple, naked quad, X-Wing, Swordfish, XY-Wing, XYZ-Wing |
| 3 | Experto | + unique rectangle, simple colors, X-Chain, Skyscraper, 2-String Kite, W-Wing, Jellyfish, XY-Chain |

## Ids del catalogo (tier 0 a 2)

| id | tier | ER | action | fuente del ER |
|---|---|---|---|---|
| `full_house` | 0 | 1.0 | place | research 2.1 |
| `hidden_single` | 0 | 1.2 (caja) / 1.5 (linea) | place | research 2.2 |
| `naked_single` | 0 | 2.3 | place | research 2.3 |
| `locked_candidates_pointing` | 1 | 2.6 | eliminate | research 3.1 |
| `locked_candidates_claiming` | 1 | 2.8 | eliminate | research 3.2 |
| `naked_pair` | 1 | 3.0 | eliminate | research 3.3 |
| `hidden_pair` | 1 | 3.4 | eliminate | research 3.4 |
| `naked_triple` | 1 | 3.6 | eliminate | research 3.5 |
| `hidden_triple` | 2 | 4.0 | eliminate | research 3.6 |
| `naked_quad` | 2 | 5.0 | eliminate | research 3.7 |
| `x_wing` | 2 | 3.2 | eliminate | research 3.9 |
| `swordfish` | 2 | 3.8 | eliminate | research 3.10 |
| `xy_wing` | 2 | 4.2 | eliminate | research 3.12 |
| `xyz_wing` | 2 | 4.4 | eliminate | research 3.13 |

U3b extiende el catalogo con la familia de tier 3 (chains, unicidad, colors,
