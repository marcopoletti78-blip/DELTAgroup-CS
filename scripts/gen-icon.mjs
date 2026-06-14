// Genera src/assets/icon-pwa.png (512x512): triangolo bianco bordato su sfondo
// blu #1E40AF, nello stile del logo dell'header (polygon 256,92 422,402 90,402,
// stroke bianco 52px, join arrotondato). Nessuna dipendenza esterna: rasterizza
// a mano (distanza dai segmenti) e codifica il PNG con zlib.
import zlib from "node:zlib";
import { writeFileSync } from "node:fs";

const SIZE = 512;
const HALF_STROKE = 26; // strokeWidth 52 / 2
// Sfondo #1E40AF
const BG = [30, 64, 175];
const FG = [255, 255, 255];

// Vertici del triangolo (come nel logo header, viewBox 512)
const V = [
  [256, 92],
  [422, 402],
  [90, 402],
];
const EDGES = [
  [V[0], V[1]],
  [V[1], V[2]],
  [V[2], V[0]],
];

// Distanza punto-segmento
function distSeg(px, py, [[ax, ay], [bx, by]]) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Costruisce i byte RGB della bitmap. La copertura del bordo è anti-aliased
// (1px di transizione) usando la distanza minima dai tre lati con join tondi.
const raw = Buffer.alloc(SIZE * SIZE * 3);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const px = x + 0.5, py = y + 0.5;
    let d = Infinity;
    for (const e of EDGES) d = Math.min(d, distSeg(px, py, e));
    // copertura: 1 dentro il bordo, 0 fuori, transizione lineare di 1px
    let cov = HALF_STROKE + 0.5 - d;
    cov = Math.max(0, Math.min(1, cov));
    const i = (y * SIZE + x) * 3;
    raw[i] = Math.round(BG[0] + (FG[0] - BG[0]) * cov);
    raw[i + 1] = Math.round(BG[1] + (FG[1] - BG[1]) * cov);
    raw[i + 2] = Math.round(BG[2] + (FG[2] - BG[2]) * cov);
  }
}

// ── Codifica PNG (color type 2 = RGB, bit depth 8) ──────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 2;  // color type RGB
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

// Scanline con filtro 0 (None) in testa a ogni riga
const stride = SIZE * 3;
const filtered = Buffer.alloc((stride + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  filtered[y * (stride + 1)] = 0;
  raw.copy(filtered, y * (stride + 1) + 1, y * stride, y * stride + stride);
}
const idat = zlib.deflateSync(filtered, { level: 9 });

const png = Buffer.concat([
  sig,
  chunk("IHDR", ihdr),
  chunk("IDAT", idat),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = process.argv[2];
writeFileSync(out, png);
console.log(`PNG scritto: ${out} (${png.length} byte)`);
