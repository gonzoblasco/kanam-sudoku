// U4/U5/U6/U8 - Punto de entrada de la app (Vite).
//
// Monta el tablero en #app con una sesion persistida en localStorage y registra
// el service worker en produccion. La logica del juego vive en `session.js`,
// `state.js`, `notes.js`, `history.js`, `timer.js`, `persistence.js`, `hints.js`
// y las funciones puras de `navigation.js` y `a11y.js`.

import "./styles.css";
import { mountGame } from "./render.js";
import { GameSession } from "./session.js";
import { registerServiceWorker } from "./pwa.js";

const root = document.getElementById("app");
const session = new GameSession({ storage: globalThis.localStorage });
mountGame(root, { session });

// El SW solo se registra en produccion: en dev pelea con el HMR de Vite.
registerServiceWorker({ mode: import.meta.env.MODE });
