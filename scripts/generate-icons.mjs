// U8 - Generador de iconos PWA.
//
// Escribe PNG a mano con `node:zlib` (built-in): sin dependencias, y sin bajar
// iconos de internet. Corre con `node scripts/generate-icons.mjs` y deja los
// archivos en `public/icons/`.

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "public", "icons");

// --- codificador PNG minimo (RGBA, 8 bits, sin interlazado) ---

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(size, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profundidad de bits
  ihdr[9] = 6; // color type RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filtro: ninguno
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- dibujo del icono ---

const BLUE = [28, 78, 138];
const WHITE = [255, 255, 255];
const DARK = [20, 56, 100];

function drawIcon(size, { maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4);

  const put = (x, y, [r, g, b]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = 255;
  };

  const fillRect = (x0, y0, x1, y1, color) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) put(x, y, color);
  };

  // Fondo a sangre.
  fillRect(0, 0, size, size, BLUE);

  // Tablero centrado. Maskable deja mas margen (zona segura del circulo).
  const margin = Math.round(size * (maskable ? 0.18 : 0.1));
  const inner = size - margin * 2;
  fillRect(margin, margin, size - margin, size - margin, WHITE);

  const step = inner / 3;
  const line = Math.max(2, Math.round(size * 0.02));
  const half = Math.floor(line / 2);

  // Grilla: 2 verticales y 2 horizontales gruesas (tercios).
  for (let i = 1; i <= 2; i++) {
    const at = Math.round(margin + step * i);
    fillRect(at - half, margin, at - half + line, size - margin, BLUE);
    fillRect(margin, at - half, size - margin, at - half + line, BLUE);
  }

  // Borde del tablero.
  fillRect(margin, margin, size - margin, margin + line, DARK);
  fillRect(margin, size - margin - line, size - margin, size - margin, DARK);
  fillRect(margin, margin, margin + line, size - margin, DARK);
  fillRect(size - margin - line, margin, size - margin, size - margin, DARK);

  // Algunas casillas "dadas" pintadas, para que se lea como sudoku.
  const given = [
    [0, 0],
    [1, 2],
    [2, 1],
  ];
  const cell = Math.floor(step) - line;
  for (const [col, row] of given) {
    const x0 = Math.round(margin + step * col) + line;
    const y0 = Math.round(margin + step * row) + line;
    fillRect(x0, y0, x0 + cell, y0 + cell, BLUE);
  }

  return px;
}

// --- salida ---

const TARGETS = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const target of TARGETS) {
  const png = encodePng(target.size, drawIcon(target.size, { maskable: target.maskable }));
  writeFileSync(join(OUT_DIR, target.file), png);
  console.log(`${target.file}: ${png.length} bytes (${target.size}x${target.size})`);
}
console.log(`iconos generados en ${OUT_DIR}`);
