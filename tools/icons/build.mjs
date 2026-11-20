// The site's icons from app/icon.png (the logo's mark on ivory):
//   app/favicon.ico            16, 32 and 48 px (PNG-in-ICO)
//   public/icons/icon-512.png  for the web manifest (app/manifest.ts), and a maskable one
//   node tools/icons/build.mjs
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(ROOT, 'app/icon.png');
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map((s) => sharp(SRC).resize(s, s).ensureAlpha().png().toBuffer()));
const head = Buffer.alloc(6);
head.writeUInt16LE(0, 0);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(sizes.length, 4);
const dir = Buffer.alloc(16 * sizes.length);
let off = 6 + dir.length;
sizes.forEach((s, i) => {
  const b = 16 * i;
  dir.writeUInt8(s, b);
  dir.writeUInt8(s, b + 1);
  dir.writeUInt8(0, b + 2);
  dir.writeUInt8(0, b + 3);
  dir.writeUInt16LE(1, b + 4);
  dir.writeUInt16LE(32, b + 6);
  dir.writeUInt32LE(pngs[i].length, b + 8);
  dir.writeUInt32LE(off, b + 12);
  off += pngs[i].length;
});
writeFileSync(join(ROOT, 'app/favicon.ico'), Buffer.concat([head, dir, ...pngs]));
mkdirSync(join(ROOT, 'public/icons'), { recursive: true });
await sharp(SRC).resize(512, 512).png().toFile(join(ROOT, 'public/icons/icon-512.png'));
// maskable: the mark inside the 80% safe zone, on ivory
const inner = await sharp(SRC).resize(400, 400).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#f5f1e8' } })
  .composite([{ input: inner, left: 56, top: 56 }])
  .png()
  .toFile(join(ROOT, 'public/icons/icon-maskable-512.png'));
console.log('app/favicon.ico, public/icons/icon-512.png, icon-maskable-512.png');
