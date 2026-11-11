import { chromium } from 'playwright-core';
const out = process.argv[3];
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
for (const [n, w, h] of [['d', 1440, 900], ['m', 390, 844]]) {
  const mobile = w < 700;
  // 1) CSS only: the page's JS chunks never arrive
  let ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  await ctx.route(/\/_next\/static\/chunks\/.*\.js/, (r) => r.abort());
  let p = await ctx.newPage();
  await p.goto(process.argv[2] + '/', { waitUntil: 'load' }); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/al-${n}-css.png` }); await ctx.close();
  // 2) canvas: the first frame of phase B (seed still at full strength)
  ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  p = await ctx.newPage();
  await p.goto(process.argv[2] + '/', { waitUntil: 'commit' });
  await p.waitForSelector('[data-dawn][data-phase="A"]', { timeout: 30000 });
  await p.waitForFunction(() => document.querySelector('[data-dawn]')?.dataset.canvas !== undefined); await p.waitForTimeout(250); await p.screenshot({ path: `${out}/al-${n}-canvas.png` }); await ctx.close();
}
await b.close(); console.log('ok');
