# SPEC v1 - Kanam SUDOKU

<!-- project: github.com/gonzoblasco/kanam-sudoku -->

Fecha: 2026-09-26. Fuente: BRIEF.md + respuestas de Gonzo (clasico 9x9, y los
cuatro imprescindibles).

## 1. Definicion del producto

Sudoku clasico 9x9, jugable en cualquier navegador, instalable como PWA y
funcional sin conexion. El valor diferencial son los **hints que explican la
tecnica**: el juego razona sobre el tablero y muestra el paso logico, no el
numero final.

## 2. Requisitos funcionales

- **FR-1 Tablero.** Grilla 9x9 con las 9 cajas 3x3. Celdas dadas (fijas) y
  celdas editables. Validacion visual de conflictos (fila, columna, caja).
- **FR-2 Input.** Cargar un numero, borrar, y alternar modo nota. Soporte de
  teclado completo (flechas para moverse, 1-9 para cargar, Supr para borrar,
  `N` para modo nota) y puntero.
- **FR-3 Notas.** Modo nota por celda; marcar y desmarcar candidatos. Borrar un
  numero no rompe las notas de la celda. Ademas: calculo de candidatos del
  tablero ("que numeros son posibles aca segun las reglas").
- **FR-4 Undo / redo.** Historial de jugadas reversible: cargar numero, borrar,
  marcar/desmarcar nota. Sin perdida de estado y sin limites arbitrarios bajos.
- **FR-5 Timer.** Cronometro por partida. Pausa (y el cronometro no corre en
  pausa). Se detiene al resolver.
- **FR-6 Estadisticas.** Mejor tiempo por dificultad, partidas jugadas y
  ganadas, racha. Persistidas localmente.
- **FR-7 Historial.** Partida en curso recuperable al volver a abrir el juego.
- **FR-8 Dificultad.** Escala real y verificable (ver NFR-3), no un conteo de
  celdas vacias. Seleccion de dificultad al empezar.
- **FR-9 Hints que explican.** El sistema detecta la tecnica mas simple
  aplicable al tablero y la explica en lenguaje llano, señalando la celda o el
  grupo involucrado. Nunca un "revela el numero" sin razon.
- **FR-10 Nueva partida / reiniciar.** Empezar una partida nueva en la misma
  dificultad o en otra; reiniciar la actual.

## 3. Requisitos no funcionales

- **NFR-1 Offline-first.** Funciona sin red despues de la primera carga. Sin
  backend, sin cuentas, sin telemetria.
- **NFR-2 Rendimiento.** Generar un puzzle no bloquea la interfaz de forma
  perceptible; el motor puro es testeable sin DOM.
- **NFR-3 Solucion unica.** Todo puzzle generado tiene exactamente una solucion.
  Verificado por el propio generador, no asumido.
- **NFR-4 Accesibilidad.** Grilla navegable por teclado, roles y etiquetas ARIA
  correctas, foco visible, contraste AA, y ninguna informacion que dependa solo
  del color.
- **NFR-5 Cero dependencias de runtime.** Sin librerias de UI ni de sudoku.
- **NFR-6 Tests.** `node --test` sobre el motor, incluyendo los casos borde:
  puzzle invalido, multiple solucion, tablero resuelto.

## 4. Non-goals

Variantes de tablero, multijugador, ranking online, cuentas, backend, anuncios,
pagos.

## 5. Escenarios de aceptacion

1. **Partida completa.** Elijo dificultad, juego, uso notas y undo, resuelvo el
   tablero, el timer se detiene y la partida entra a las estadisticas.
2. **Recuperacion.** Cierro el navegador a mitad de partida, vuelvo, y retomo
   con el mismo tablero, tiempo y notas.
3. **Hint honesto.** En un tablero trabado pido un hint y recibo la explicacion
   de una tecnica aplicable, con la celda/region identificada y el porque.
4. **Sin red.** Con la PWA instalada, abro el juego en modo avion y funciona.
5. **Solo teclado.** Completo una partida entera sin tocar el mouse.

## 6. Desglose en unidades

| Unidad | Alcance | Depende de |
|---|---|---|
| **U1** | Modelo de tablero + solver + validador (puro, testeable) | - |
| **U2** | Generador con solucion unica + primitivas de analisis + rater base (singles, locked candidates, subsets) | U1 |
| **U3** | Motor de tecnicas con explicacion: extiende el rater a la escalera completa y redacta el texto del hint | U1, U2 |
| **U4** | UI del tablero: render, input, teclado, a11y | U1 |
| **U5** | Notas + undo/redo | U1, U4 |
| **U6** | Timer, estadisticas, persistencia e historial | U1, U4 |
| **U7** | Hints en UI cableados al motor de tecnicas | U3, U4 |
| **U8** | PWA offline + deploy | U4 |

## 7. Criterios de aceptacion por unidad

- **U1:** dado un tablero valido, el solver lo resuelve; dado uno invalido o sin
  solucion, lo dice sin colgarse. Tests borde incluidos.
- **U2:** todo puzzle generado tiene solucion unica (verificado), y las
  dificultades se distinguen por tecnicas requeridas, no por cantidad de huecos.
- **U3:** cada tecnica detectada devuelve una explicacion legible con la celda o
  region y el razonamiento; los casos de prueba son tableros reales.
- **U4:** se puede cargar un numero con teclado y con puntero; el foco es
  visible; las etiquetas ARIA describen fila, columna, caja, valor y notas.
- **U5:** undo/redo reconstruye exactamente el estado previo, incluidas notas.
- **U6:** el timer sobrevive un reload; las estadisticas se actualizan solo al
  ganar.
- **U7:** el hint señala la tecnica y la region correcta en un tablero de prueba
  conocido.
- **U8:** la PWA carga offline y es instalable; build verde.

## 7bis. Borde U2 / U3 (decidido 2026-09-26)

El generador necesita medir dificultad, y medir dificultad necesita los puzzles. La
resolucion es cortar por **estructura compartida, no por tecnica**:

- **U2 entrega** el generador (solucion unica garantizada) mas las **primitivas de
  analisis** que el rater y los hints comparten: candidatos por celda, unidades
  (filas/columnas/cajas), peers, y el contrato de salida de una deduccion
  (`{technique, cells, value, eliminated}`). Sobre eso implementa el **rater base**
  con las tecnicas de tier 0 y 1 (singles, locked candidates, subsets), que son las
  que definen si un puzzle es facil o medio.
- **U3 extiende** el mismo rater con las familias dificiles (fish, wings, chains,
  unicidad) y agrega lo que U2 no puede: el **texto llano** del hint.

Razon: partir por tecnica obligaria a U3 a reescribir el motor de U2. Partir por
estructura deja un solo motor que crece. El catalogo de tecnicas y los datos de
deteccion estan en `RESEARCH-TECNICAS.md` (secciones 6 y la escalera de la 4).

**Criterio de dificultad adoptado:** tecnicas requeridas, no cantidad de huecos.
El conteo de huecos no mide dificultad y no es explicable por el motor de hints.
Base y desacuerdo documentados en `RESEARCH-TECNICAS.md` seccion 4.3.

### Escalera autoritativa (decidida 2026-09-26)

El corte es por **ER de la tecnica mas dificil usada**, siguiendo el research 4.2.
La tabla del research manda sobre cualquier lista de tecnicas suelta:

| Tier | Nivel | Corta en | Tecnicas |
|---|---|---|---|
| 0 | Facil | ER <= 2.3 | full house / last digit, hidden single, naked single |
| 1 | Medio | ER <= 3.6 | + locked candidates (pointing, claiming), naked pair, hidden pair, naked triple |
| 2 | Dificil | ER <= 4.4 | + **hidden triple**, naked quad, X-Wing, Swordfish, XY-Wing, XYZ-Wing |
| 3 | Experto | ER <= 7.0 | + unique rectangle, simple colors, X-Chain, Skyscraper, 2-String Kite, W-Wing, Jellyfish, XY-Chain |

**Caso que origino la tabla:** `hidden_triple` tiene ER 4.0, que queda **por encima
del corte de Medio (3.6)**. Pertenece al tier 2 (Dificil), no al 1, aunque se
parezca a su hermano `naked_triple` (ER 3.6, si tier 1). La simetria del nombre no
manda; manda el ER. Lo detecto Kanam DEV al implementar U2, en vez de forzar el
nivel para que cuadrara.

U2 alcanza tier 0-1. Un puzzle que necesita una tecnica de tier 2+ **no se
resuelve** con el rater base: devuelve `solved: false`, `difficulty: null` y el
tier maximo alcanzado. Eso es correcto, no un fallo: significa "este puzzle es mas
dificil que medio".

## 8. Riesgos

- **Dificultad real es dificil.** Contar huecos no mide dificultad; medir por
  tecnicas requiere que U3 exista. Mitigacion: U3 antes de cerrar la escalera de
  dificultad de U2.
- **Hints que suenan a libro.** El valor esta en explicar en lenguaje llano, no
  en citar la tecnica. Requiere trabajo de redaccion, no solo de logica.
- **Generacion lenta en dificultades altas.** Mitigacion: generar en el cliente
  con corte y reintento; si no alcanza, pre-generar un banco de puzzles.
