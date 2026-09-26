// U4/U5/U6 - Punto de entrada de la app (Vite).
//
// Monta el tablero en #app con una sesion persistida en localStorage. La logica
// del juego vive en `session.js`, `state.js`, `notes.js`, `history.js`,
// `timer.js`, `persistence.js` y las funciones puras de `navigation.js` y
// `a11y.js`.

import "./styles.css";
import { mountGame } from "./render.js";
import { GameSession } from "./session.js";

const root = document.getElementById("app");
const session = new GameSession({ storage: globalThis.localStorage });
mountGame(root, { session });
