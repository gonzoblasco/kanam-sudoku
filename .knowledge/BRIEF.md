# BRIEF - Kanam SUDOKU

<!-- project: github.com/gonzoblasco/kanam-sudoku -->

## Que

Juego de sudoku web, offline-first (PWA), con motor de puzzles propio, hints que
explican la tecnica y accesibilidad de fabrica.

## Por que

Gonzo juega sudoku a diario y hoy depende de una app de terceros (Apple Arcade).
El objetivo es tener su propio juego: mismo vicio, ejecutado mejor, y sin anuncios
ni cuentas. Ademas es una pieza de portfolio tecnico (vanilla JS + PWA + a11y).

## Alcance de la v1

**Clasico 9x9, ejecutado mejor.** Sin variantes (nada de 6x6, 12x12, killer ni
diagonal) en la v1. El foco esta en la calidad de la ejecucion, no en la cantidad
de modos.

## Imprescindibles (definidos por Gonzo, 2026-09-26)

Los cuatro vienen de lo que hoy usa en Apple Arcade y no quiere perder:

1. **Notas / candidatos automaticos.** Marcar candidatos a mano y poder calcular
   los del tablero.
2. **Undo-redo y borrado seguro.** Deshacer/rehacer sin perder el estado, y que
   borrar un numero no rompa las notas.
3. **Timer, estadisticas e historial.** Tiempo por partida, mejores tiempos por
   dificultad, partidas guardadas.
4. **Hints que explican la tecnica.** No un "revela el numero": un "el 7 de esta
   fila solo puede ir aca porque...". Es el diferenciador contra el juego de Apple.

## No-objetivos de la v1

- Variantes de tablero (6x6, 12x12, jigsaw, killer, diagonal).
- Multijugador, ranking online, cuentas, telemetria.
- Backend. Todo local-first en el navegador.
- Anuncios, pagos, suscripciones.

## Stack

- **Vanilla JS (ES modules) + Vite.** El tablero es estado + DOM; un framework
  agrega peso y ceremonia sin devolver nada. Vite da build, dev server y base
  para la PWA. Decision del 2026-09-26, no por precedente.
- **Cero dependencias de runtime.** El motor de sudoku se escribe, no se importa:
  es el corazon del juego y de el dependen los hints y la dificultad.
- **PWA** (manifest + service worker) para jugar offline e instalarlo.
- **localStorage** para partidas guardadas, estadisticas y preferencias.
- **Tests con `node --test`** sobre el motor puro (sin DOM).

## Accesibilidad

De fabrica, no como parche: grilla navegable por teclado, roles y etiquetas ARIA
correctas, foco visible, contraste AA, y nada que dependa solo del color.

## Estado

- [x] Discovery (2026-09-26)
- [ ] Definition
- [ ] En desarrollo
- [ ] Live
- [ ] Archivado

## Decisiones clave

- **Clasico 9x9 primero** - pedido explicito de Gonzo; las variantes son ruido
  antes de que el core este bien.
- **Motor propio** - los hints con explicacion requieren entender la deduccion,
  y eso solo se puede si el solver es nuestro y expone el paso logico, no solo la
  solucion.
- **Vanilla + Vite** - ver Stack.
