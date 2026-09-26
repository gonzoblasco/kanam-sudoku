# Kanam SUDOKU

<!-- project: github.com/gonzoblasco/kanam-sudoku -->

Sudoku web offline-first, con motor de puzzles propio y hints que explican la
tecnica en vez de revelar el numero.

## Stack

- Vanilla JS (ES modules)
- Vite (build + dev server + base PWA)
- Cero dependencias de runtime
- `node --test` para el motor

## Empezar

```bash
npm install
npm run dev      # servidor de desarrollo
npm test         # tests del motor
npm run build    # build de produccion
```

## Estructura

```
src/
  core/      motor puro: solver, generador, validador, tecnicas
  ui/        tablero, input, render
  store/     persistencia local (localStorage)
test/        tests del motor
.knowledge/  memoria del proyecto (brief, spec, status)
```
