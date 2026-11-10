import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
const [, , base, out, dir] = process.argv;
const glyphs = readFileSync(dir + '/glyphs.json', 'utf8'), js = readFileSync(dir + '/opening.js', 'utf8');
const FR = [
  ['1-engraving-50', { engrave: 0.5, fill: 0, outline: 1, line: 0.5, hi: 0.55, body: 0, cue: 0, header: 0 }],
  ['2-sambhar-filled', { engrave: 1, fill: 1, outline: 0, line: 1, hi: 1, body: 1, cue: 1, header: 1 }],
  ['3-opening-40', { fill: 1, line: 1, hi: 1, header: 1, open: 0.4, jar: 0.33, glow: 0.08 }],
  ['4-jar-centred', { fill: 1, line: 1, header: 1, open: 1, drift: 0.25, halves: 0.35, jar: 1, glow: 0.11 }],
  ['5-headline-cta', { fill: 1, line: 0, header: 1, open: 1, drift: 1, halves: 0, jar: 1, glow: 0.11, copy: 1 }],
];
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
const info = {};
for (const [v, w, h, dpr] of [['desktop', 1440, 900, 1], ['mobile', 390, 844, 2]]) {
  const mobile = w < 700;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  await p.goto(base + '/?heroStill', { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => document.fonts.load('20px ' + getComputedStyle(document.documentElement).getPropertyValue('--font-tiro').split(',')[0], 'सांभर'));
  await p.addScriptTag({ content: `window.__GLYPHS = ${glyphs};\n${js}` });
  info[v] = await p.evaluate(() => SO.info());
  for (const [name, st] of FR) {
    await p.evaluate((st) => SO.render(st), st);
    await p.waitForTimeout(200);
    await p.screenshot({ path: `${out}/${v}-${name}.png` });
  }
  // a 2x crop of SAMBHAR with the gold line (filled, and engraving)
  const i = info[v];
  const clip = { x: Math.max(0, i.x0 - 70), y: i.baseline - i.capPx - 60, width: Math.min(w - Math.max(0, i.x0 - 70), i.inkWidthPx + 150), height: i.capPx + 120 };
  await p.evaluate(() => SO.render({ engrave: 1, fill: 1, outline: 0, line: 1, hi: 1, body: 0, cue: 0, header: 1 }));
  if (dpr === 1) {
    const c2 = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const p2 = await c2.newPage();
    await p2.goto(base + '/?heroStill', { waitUntil: 'load' }); await p2.waitForTimeout(2000);
    await p2.addScriptTag({ content: `window.__GLYPHS = ${glyphs};\n${js}` });
    for (const [n, st] of [['filled', { engrave: 1, fill: 1, outline: 0, line: 1 }], ['engraving', { engrave: 0.62, fill: 0, outline: 1, line: 0.7, header: 0 }]]) {
      await p2.evaluate((st) => SO.render(st), st); await p2.waitForTimeout(150);
      await p2.screenshot({ path: `${out}/crop-2x-${n}.png`, clip });
    }
    await c2.close();
  }
  await ctx.close();
}
writeFileSync(out + '/layout.json', JSON.stringify(info, null, 1));
await b.close(); console.log(JSON.stringify(info));
