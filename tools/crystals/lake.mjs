// "Look closer": the lake salt half from the real-salt images (crystals/lake, LOOK-CLOSER-LAKE.md),
// used as they are (cropped, scaled, encoded only). The black salt half is the three.js render
// (render.html), unchanged; the diagonal between them is the render's own (read from it).
//   node tools/crystals/lake.mjs
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'public/images/crystals');
const LAKE = join(ROOT, 'crystals/lake');

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
await page.goto(pathToFileURL(join(ROOT, 'tools/crystals/render.html')).href);
await page.waitForFunction(() => document.documentElement.dataset.ready === '1', null, {
  timeout: 60_000,
});
const shot = async (w, h) =>
  Buffer.from(
    (await page.evaluate(([w, h]) => window.renderAt(w, h), [w, h])).split(',')[1],
    'base64',
  );
const sharpRender = await shot(3600, 1350);
const softRender = await shot(2880, 1080);
await browser.close();

/** Where the lake salt is (255) and the black salt (0): the render's bright grains, smoothed into one soft edge. */
async function mask(render, w, h) {
  // black salt grains are brown (red well above blue); lake grains are white, the gaps navy
  const { data } = await sharp(render)
    .removeAlpha()
    .resize(360, 135)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const brown = Buffer.alloc(360 * 135);
  for (let i = 0; i < brown.length; i++) brown[i] = data[i * 3] - data[i * 3 + 2] > 18 ? 255 : 0;
  const smooth = await sharp(brown, { raw: { width: 360, height: 135, channels: 1 } })
    .blur(5)
    .extractChannel(0)
    .raw()
    .toBuffer();
  // the lake where fewer than half the grains around are brown
  const hard = Buffer.alloc(smooth.length);
  for (let i = 0; i < hard.length; i++) hard[i] = smooth[i] < 128 ? 255 : 0;
  return sharp(hard, { raw: { width: 360, height: 135, channels: 1 } })
    .resize(w, h)
    .blur(Math.max(2, w / 150))
    .extractChannel(0)
    .raw()
    .toBuffer();
}

async function blend(render, lake, w, h, black = render) {
  const m = await mask(render, w, h);
  const a = await sharp(black).removeAlpha().raw().toBuffer();
  const b = await sharp(lake).removeAlpha().resize(w, h).raw().toBuffer();
  const out = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const t = m[i] / 255;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = a[i * 3 + c] * (1 - t) + b[i * 3 + c] * t;
  }
  return sharp(out, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toBuffer();
}

// sharp layer: lake-sharp at 1:1, its centre 3600 × 1350
const lakeSharp = await sharp(join(LAKE, 'lake-sharp.png'))
  .extract({ left: 0, top: Math.round((2400 - 1350) / 2), width: 3600, height: 1350 })
  .toBuffer();
// soft layer: the same region of lake-soft (sharp ÷ 2.5): 1440 × 540, scaled to 2880 × 1080
const lakeSoft = await sharp(join(LAKE, 'lake-soft.png'))
  .extract({ left: 0, top: Math.round((960 - 540) / 2), width: 1440, height: 540 })
  // the same tone as the black half's soft layer (render.mjs: brightness 0.78, no vignette)
  .modulate({ brightness: 0.78 })
  .toBuffer();

// SOFT_ONLY=1: rebuild only the soft layer
if (!process.env.SOFT_ONLY) {
  const sharpPng = await blend(sharpRender, lakeSharp, 3600, 1350);
  await sharp(sharpPng).avif({ quality: 52, effort: 6 }).toFile(join(OUT, 'field-sharp.avif'));
  await sharp(sharpPng).webp({ quality: 72, effort: 6 }).toFile(join(OUT, 'field-sharp.webp'));
  for (const [ext, enc] of [
    ['avif', (img, q) => img.avif({ quality: q, effort: 6 })],
    ['webp', (img, q) => img.webp({ quality: q, effort: 6 })],
  ]) {
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
}
// the black half gets render.mjs's defocus and dimming; the lake half is lake-soft as it is
const softBlack = await sharp(softRender).blur(5).modulate({ brightness: 0.78 }).png().toBuffer();
// (the mask is read from the undimmed render)
const softFinal = await blend(softRender, lakeSoft, 2880, 1080, softBlack);
await sharp(softFinal).avif({ quality: 50, effort: 6 }).toFile(join(OUT, 'field-soft.avif'));
await sharp(softFinal).webp({ quality: 78, effort: 6 }).toFile(join(OUT, 'field-soft.webp'));
console.log('public/images/crystals/field-{soft,sharp}.{avif,webp}');
