// Salt-pans approval stills: real renders (?saltPans), with the final beat's copy overlaid.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const [, , base, out] = process.argv; mkdirSync(out, { recursive: true });
const FR = [['a-mounds-appearing', 0.815, false], ['b-white-pans', 0.87, false], ['c-pink-pans', 1, true]];
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
for (const [v, w, h, dpr] of [['desktop', 1440, 900, 1], ['mobile', 390, 844, 2]]) {
  const mobile = w < 700;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base + '/?heroStill&saltPans', { waitUntil: 'load' });
  await p.waitForFunction(() => document.documentElement.hasAttribute('data-intro-done'), null, { timeout: 40000 });
  await p.waitForFunction(() => (window.__pyoorHero?.frames ?? 0) > 5, null, { timeout: 40000 });
  await p.addStyleTag({ content: 'nextjs-portal{display:none!important} html{scrollbar-gutter:auto!important}' });
  await p.evaluate(() => {
    const b3 = document.querySelector('[data-beat="3"]');
    b3.querySelector('.py-eyebrow').style.display = 'none';
    b3.querySelector('.py-lead').style.display = 'none';
    const q = document.createElement('p');
    q.className = 'py-display py-d-m'; q.style.margin = '0 0 10px'; q.style.textWrap = 'balance';
    q.innerHTML = 'We grew up watching the lake turn from <em class="py-italic" style="white-space:nowrap">white to pink.</em>';
    b3.prepend(q);
    window.__copy = (on) => { b3.style.setProperty('visibility', on ? 'visible' : 'hidden', 'important'); b3.style.setProperty('opacity', on ? '1' : '0', 'important'); };
  });
  for (const [n, q, copy] of FR) {
    await p.evaluate(([q, h]) => window.scrollTo(0, Math.round((1.2 + 4.2 * q) * h)), [q, h]);
    await p.waitForFunction((q) => Math.abs(window.__pyoorHero.p - q) < 0.002, q, { timeout: 15000 }).catch(() => console.log('no settle', q));
    await p.waitForTimeout(700);
    await p.evaluate((c) => window.__copy(c), copy);
    await p.waitForTimeout(200);
    await p.screenshot({ path: `${out}/${v}-${n}.png` });
  }
  console.log(v, 'errors', JSON.stringify(errs));
  await ctx.close();
}
await b.close();
