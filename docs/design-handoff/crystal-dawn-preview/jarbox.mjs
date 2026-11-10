import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
for (const [n, w, h] of [['d', 1440, 900], ['d2', 1280, 800], ['d3', 1920, 1080], ['m', 390, 844], ['m2', 360, 780], ['m3', 430, 932]]) {
  const mobile = w < 700;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript(() => sessionStorage.setItem('pyoor-intro', '1'));
  const p = await ctx.newPage();
  await p.goto(process.argv[2] + '/?heroStill', { waitUntil: 'load' });
  await p.waitForFunction(() => window.__pyoorHero?.frames > 10);
  await p.waitForTimeout(2500);
  const poster = await p.evaluate(() => { const r = document.querySelector('[data-hero] img').getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); });
  // hide everything but the canvas, to find the jar's pixels
  await p.addStyleTag({ content: 'header,[data-hero-copy],[data-hero] img,[data-hero] [aria-hidden]:not(canvas),[data-beat]{visibility:hidden!important}' });
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${process.argv[3]}/jb-${n}.png` });
  console.log(n, w, h, 'poster', JSON.stringify(poster));
  await ctx.close();
}
await b.close();
