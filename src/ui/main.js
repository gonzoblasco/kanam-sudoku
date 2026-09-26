// U4 - Punto de entrada de la app (Vite).
//
// Monta el tablero en #app. La logica del juego vive en `render.js` y en las
// funciones puras de `state.js`, `navigation.js` y `a11y.js`.

import "./styles.css";
import { mountGame } from "./render.js";

const root = document.getElementById("app");
mountGame(root);
