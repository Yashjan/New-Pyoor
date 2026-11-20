// "Look closer" (components/sections/Crystals): the salt field's two layers, from one three.js
// scene (render.html) in headless Chrome:
//   public/images/crystals/field-soft.{avif,webp}    2880 × 1080: defocused and dimmed
//   public/images/crystals/field-sharp.{avif,webp}   3600 × 1350: razor-sharp, for the loupe (2.5×)
//   public/images/crystals/field-sharp-m.{avif,webp} 2700 × 1013: the same for phones (≤ 350 KB)
//   node tools/crystals/render.mjs
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'public/images/crystals');
const browser = await chromium.launch({
  channel: 'chrome',
  args: [
    '--use-gl=angle',
    '--use-angle=gl-egl',
    '--ignore-gpu-blocklist',
    '--enable-gpu',
    '--allow-file-access-from-files',
  ],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.error(e));
await page.goto(pathToFileURL(join(ROOT, 'tools/crystals/render.html')).href);
await page.waitForFunction(() => document.documentElement.dataset.ready === '1', null, {
  timeout: 60_000,
});
const shot = async (w, h) =>
  Buffer.from(
    (await page.evaluate(([w, h]) => window.renderAt(w, h), [w, h])).split(',')[1],
    'base64',
  );

const sharpPng = await shot(3600, 1350);
await sharp(sharpPng).avif({ quality: 52, effort: 6 }).toFile(join(OUT, 'field-sharp.avif'));
await sharp(sharpPng).webp({ quality: 72, effort: 6 }).toFile(join(OUT, 'field-sharp.webp'));
// phones (≤ 768px): the macro at 1.5× instead of 2× (2700 × 1013), each format tuned to ≤ 350 KB
for (const [ext, enc] of [
  ['avif', (img, q) => img.avif({ quality: q, effort: 6 })],
  ['webp', (img, q) => img.webp({ quality: q, effort: 6 })],
]) {
  // the highest quality that fits; a little smaller if even low quality doesn't
  let buf;
  let w = 2700;
  let q = 60;
  for (;;) {
    const png = await sharp(sharpPng)
      .resize(w, Math.round((w * 3) / 8))
      .png()
      .toBuffer();
    for (q = 60; q >= 30; q -= 4) {
      buf = await enc(sharp(png), q).toBuffer();
      if (buf.length <= 350 * 1024) break;
    }
    if (buf.length <= 350 * 1024 || w <= 1800) break;
    w -= 300;
  }
  writeFileSync(join(OUT, `field-sharp-m.${ext}`), buf);
  console.log(`field-sharp-m.${ext}`, `${w}px q${q}`, Math.round(buf.length / 1024) + ' KB');
}
const softPng = await sharp(await shot(2880, 1080))
  .blur(5)
  .modulate({ brightness: 0.78 })
  .png()
  .toBuffer();
await sharp(softPng).avif({ quality: 50, effort: 6 }).toFile(join(OUT, 'field-soft.avif'));
await sharp(softPng).webp({ quality: 78, effort: 6 }).toFile(join(OUT, 'field-soft.webp'));
await browser.close();
console.log('public/images/crystals/field-{soft,sharp}.{avif,webp}');
