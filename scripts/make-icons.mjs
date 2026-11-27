// Generates the PNG app icons in /public with no dependencies (raw PNG encoding via zlib).
// Design: blue tile, white coin, orange wedge = "the share someone else covered".
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [42, 120, 214];
const WHITE = [255, 255, 255];
const ORANGE = [235, 104, 52];

function colorAt(u, v) {
  // u, v in [-0.5, 0.5]
  const r = Math.hypot(u, v);
  const R = 0.29;
  if (r > R) return BG;
  // wedge from 12 o'clock clockwise, 120 degrees, slightly inset with a white gap
  const ang = (Math.atan2(u, -v) + 2 * Math.PI) % (2 * Math.PI);
  const inWedge = ang < (2 * Math.PI) / 3;
  if (inWedge && r < R - 0.035) {
    // 2px-style gap along the wedge edges
    const gap = 0.022;
    const d1 = Math.abs(u); // distance to 12 o'clock edge (when v<0)
    const a2 = (2 * Math.PI) / 3;
    const d2 = Math.abs(u * Math.cos(a2) + v * Math.sin(a2));
    if ((v < 0 && d1 < gap) || d2 < gap || r < gap * 1.2) return WHITE;
    return ORANGE;
  }
  return WHITE;
}

function render(size) {
  const SS = 4;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size - 0.5;
          const v = (y + (sy + 0.5) / SS) / size - 0.5;
          const c = colorAt(u, v);
          r += c[0]; g += c[1]; b += c[2];
        }
      const n = SS * SS;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = Math.round(r / n);
      raw[o + 1] = Math.round(g / n);
      raw[o + 2] = Math.round(b / n);
      raw[o + 3] = 255;
    }
  }
  return png(size, size, raw);
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(w, h, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/pwa-192.png', render(192));
writeFileSync('public/pwa-512.png', render(512));
writeFileSync('public/pwa-maskable-512.png', render(512));
writeFileSync('public/apple-touch-icon.png', render(180));
console.log('icons written to public/');
