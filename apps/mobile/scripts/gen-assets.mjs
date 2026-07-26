// Gera PNGs PLACEHOLDER de ícone/splash do HubPatients (marca simples: círculo
// branco com "+" azul). Troque pela arte final quando houver design.
//   node apps/mobile/scripts/gen-assets.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BLUE = [2, 132, 199, 255]; // #0284C7
const WHITE = [255, 255, 255, 255];
const CLEAR = [0, 0, 0, 0];

const crcTable = (() => {
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
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function png(size, { bg, logo = true }) {
  const c = size / 2;
  const circleR = size * (logo === 'small' ? 0.24 : 0.3);
  const plusLen = circleR * 0.62;
  const plusW = circleR * 0.2;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filtro 0
    for (let x = 0; x < size; x++) {
      const dx = x - c;
      const dy = y - c;
      let col = bg;
      if (logo && dx * dx + dy * dy <= circleR * circleR) {
        const inPlus =
          (Math.abs(dx) <= plusW && Math.abs(dy) <= plusLen) ||
          (Math.abs(dy) <= plusW && Math.abs(dx) <= plusLen);
        col = inPlus ? BLUE : WHITE;
      }
      raw[p++] = col[0];
      raw[p++] = col[1];
      raw[p++] = col[2];
      raw[p++] = col[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'icon.png'), png(1024, { bg: BLUE }));
writeFileSync(join(dir, 'adaptive-icon.png'), png(1024, { bg: CLEAR, logo: 'small' }));
writeFileSync(join(dir, 'splash-icon.png'), png(1024, { bg: CLEAR, logo: 'small' }));
writeFileSync(join(dir, 'favicon.png'), png(48, { bg: BLUE }));
console.log('Assets gerados em apps/mobile/assets/');
