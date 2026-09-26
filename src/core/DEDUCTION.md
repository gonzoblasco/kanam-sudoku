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
  tier: 0,                      // 0 = facil, 1 = medio (escalera de U2)
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
  },
  text: "...",                  // explicacion llana: la agrega U3, no U2
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
- **`text` lo agrega U3.** U2 deja el campo ausente. U3 lo completa sin cambiar la
  forma.

## Ids de la escalera U2 (tier 0 y 1)

| id | tier | ER | action |
|---|---|---|---|
| `full_house` | 0 | 1.0 | place |
| `hidden_single` | 0 | 1.2 (caja) / 1.5 (linea) | place |
| `naked_single` | 0 | 2.3 | place |
| `locked_candidates_pointing` | 1 | 2.6 | eliminate |
| `locked_candidates_claiming` | 1 | 2.8 | eliminate |
| `naked_pair` | 1 | 3.0 | eliminate |
| `hidden_pair` | 1 | 3.4 | eliminate |
| `naked_triple` | 1 | 3.6 | eliminate |
| `hidden_triple` | 1 | 4.0 | eliminate |

U3 extiende el catalogo (`TECHNIQUES`) con las familias dificiles (fish, wings,
chains, unicidad) y agrega el `text`. El orden de evaluacion es el orden del
catalogo, ascendente por ER (research 6.4).
