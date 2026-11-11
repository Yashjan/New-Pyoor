// v2 stills: only the frames under review — mobile 1 and 2, desktop 4 and 5, the 2× engraving crop.
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
const [, , base, out, dir] = process.argv;
const glyphs = readFileSync(dir + '/glyphs-clean.json', 'utf8'), js = readFileSync(dir + '/opening.js', 'utf8');
const ALL = {
  '1-engraving-50': { engrave: 0.5, fill: 0, outline: 1, line: 0.5, hi: 0.55, body: 0, cue: 0, header: 0 },
  '2-sambhar-filled': { engrave: 1, fill: 1, outline: 0, line: 1, hi: 1, body: 1, cue: 1, header: 1 },
  '4-jar-centred': { fill: 1, line: 1, header: 1, open: 1, drift: 0.2, halves: 1, jar: 1, glow: 0.11 },
  '5-headline-cta': { fill: 1, line: 0, header: 1, open: 1, drift: 1, halves: 0, jar: 1, glow: 0.11, copy: 1, slide: 1 },
};
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
const open = async (w, h, dpr) => {
  const mobile = w < 700;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  await p.goto(base + '/?heroStill', { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => document.fonts.load('20px ' + getComputedStyle(document.documentElement).getPropertyValue('--font-tiro').split(',')[0], 'सांभर'));
  await p.addScriptTag({ content: `window.__GLYPHS = ${glyphs};\n${js}` });
  return [ctx, p];
};
const info = {};
for (const [v, w, h, dpr, names] of [['desktop', 1440, 900, 1, ['4-jar-centred', '5-headline-cta']], ['mobile', 390, 844, 2, ['1-engraving-50', '2-sambhar-filled']]]) {
  const [ctx, p] = await open(w, h, dpr);
  info[v] = await p.evaluate(() => SO.info());
  info[v].bag = await p.evaluate(() => document.querySelector('[data-site-header] button[aria-haspopup]')?.innerText.split('\n')[0]);
  for (const n of names) { await p.evaluate((st) => SO.render(st), ALL[n]); await p.waitForTimeout(250); await p.screenshot({ path: `${out}/${v}-${n}.png` }); }
  await ctx.close();
}
// the 2× engraving crop, same framing and state as v1
const [c2, p2] = await open(1440, 900, 2);
const i = await p2.evaluate(() => SO.info());
const clip = { x: Math.max(0, i.x0 - 70), y: i.baseline - i.capPx - 60, width: Math.min(1440 - Math.max(0, i.x0 - 70), i.inkWidthPx + 150), height: i.capPx + 120 };
await p2.evaluate(() => SO.render({ engrave: 0.62, fill: 0, outline: 1, line: 0.7, header: 0 })); await p2.waitForTimeout(200);
await p2.screenshot({ path: `${out}/crop-2x-sambhar-engraving.png`, clip });
await p2.evaluate(() => SO.render({ engrave: 1, fill: 0, outline: 1, line: 1, header: 0 })); await p2.waitForTimeout(200);
await p2.screenshot({ path: `${out}/crop-2x-sambhar-engraving-complete.png`, clip });
await c2.close();
writeFileSync(out + '/layout.json', JSON.stringify(info, null, 1));
await b.close(); console.log(JSON.stringify(info));
