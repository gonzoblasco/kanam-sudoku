# AUDIT - kanam-sudoku

**Fecha:** 2026-10-28
**Auditor:** Kanam (CORE) - medición directa contra el repo, no lectura de README
**Sync con GitHub:** SYNC (`gonzoblasco/kanam-sudoku`)

---

## 1. Veredicto

**Cumple, con margen.** 257 tests del motor en verde en 1.28s y build de Vite verde (55.98 kB, 17.40 kB gzip). Es el mayor volumen de tests unitarios del conjunto respecto de su tamaño: 19M en disco, 18M de los cuales son `node_modules`.

La tesis del proyecto -hints que explican la técnica en vez de revelar el número- está soportada por un motor puro testeado sin navegador.

---

## 2. Estado técnico medido

| Dimensión | Dato real |
|---|---|
| Tests | **257 passed, 0 fail** (18 archivos, `node --test`, 1.28s) |
| Build | **Verde** - Vite con service worker (`dist/sw.js`, 2.35 kB) |
| CI | **Solo `deploy.yml`** - deploya, no testea |
| Último commit | 2026-10-20 |
| Peso en disco | 19M (reconstruible: 18M `node_modules`) |

---

## 3. Promesas vs realidad

| Promesa | Fuente | Realidad medida |
|---|---|---|
| "`npm test` corre el motor puro con `node --test` y no necesita navegador" | README | **Cierto.** 257 tests pasan sin browser en 1.28s. |
| "Hints que explican la técnica en vez de revelar el número" | README | Soportado por `.knowledge/RESEARCH-TECNICAS.md` y el motor de técnicas. |
| Test end-to-end con navegador real | README | La sección existe; el e2e no se corrió en esta auditoría (requiere Chromium). |

**Delta principal:** ninguno. El README describe exactamente lo que el repo hace.

---

## 4. Deuda

- **`deploy.yml` sin `ci.yml`**: hay deploy automático pero ningún gate de tests. Se puede deployar un commit con tests rojos.
- **E2E no verificado**: el README lo menciona pero no está en el flujo automático.
- **19M**: el más liviano de los web, sin problema.

---

## 5. Qué haría falta para cerrarlo

1. Agregar `ci.yml` con `npm test` + `npm run build` antes del deploy (o como `needs:` de `deploy.yml`).
2. Verificar el e2e de navegador real y documentar si pasa.

---

_Auditoría generada el 2026-10-28. 257 tests de corrida real con `node --test`._
