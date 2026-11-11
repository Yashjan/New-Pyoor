import { chromium } from 'playwright-core';
const base = process.argv[2], out = process.argv[3];
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
for (const [n, w, h] of [['desktop', 1440, 900], ['phone', 390, 844]]) {
  const mobile = w < 700;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
  const p = await ctx.newPage();
  await p.goto(base + '/', { waitUntil: 'commit' });
  await p.waitForFunction(() => document.documentElement.hasAttribute('data-intro-done'), null, { timeout: 30000 });
  await p.waitForTimeout(150);
  await p.screenshot({ path: `${out}/swap-${n}-poster.png` }); // just after the reveal: the poster
  await p.waitForFunction(() => (window.__pyoorHero?.frames ?? 0) > 5, null, { timeout: 30000 });
  await p.waitForTimeout(1500); // the cross-fade has finished: WebGL
  await p.screenshot({ path: `${out}/swap-${n}-webgl.png` });
  const cls = await p.evaluate(() => window.__cls);
  // second visit, same session → fade only; then ?intro=always → full again
  await p.goto(base + '/', { waitUntil: 'commit' });
  const second = await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(document.documentElement.dataset.intro))));
  await p.goto(base + '/?intro=always', { waitUntil: 'commit' });
  const always = await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(document.documentElement.dataset.intro))));
  // product page: no intro at all
  await p.goto(base + '/product/herbal-black-salt', { waitUntil: 'commit' });
  const product = await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(document.documentElement.dataset.intro ?? 'none'))));
  console.log(n, JSON.stringify({ cls: +cls.toFixed(4), secondVisit: second, introAlways: always, productPage: product }));
  await ctx.close();
}
await b.close();
