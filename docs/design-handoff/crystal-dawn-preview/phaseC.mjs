import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
for (const [n, w, h] of [['d', 1440, 900], ['m', 390, 844]]) {
  const mobile = w < 700;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  await p.goto(process.argv[2] + '/', { waitUntil: 'commit' });
  await p.waitForSelector('[data-dawn][data-phase="C"]', { timeout: 30000 });
  await p.waitForTimeout(380);
  await p.screenshot({ path: `${process.argv[3]}/pc-${n}.png` }); await ctx.close();
}
await b.close();
