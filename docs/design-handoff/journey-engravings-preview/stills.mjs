// Journey engravings, approval stills: the SVGs dropped into the real Journey section.
//   node stills.mjs <base-url> <svg-dir> <out-dir>   (needs playwright-core)
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const [, , base, dir, out] = process.argv;
const svgs = ['01-brine', '02-sun', '03-harvest', '04-carry', '05-jar'].map((n) =>
  readFileSync(`${dir}/${n}.svg`, 'utf8'),
);
const CSS = `nextjs-portal,[data-site-header]{display:none!important} #journey li{max-width:520px}
#journey [class*="num"]{font-variant-numeric:lining-nums}
#journey svg{display:block;width:100%;height:auto}
#journey svg path{stroke-width:calc(var(--u)*.75)}
#journey svg .a{stroke-width:calc(var(--u)*.5)}
#journey svg .b{stroke-width:var(--u)}
#journey svg .c{stroke-width:calc(var(--u)*1.25)}
#journey svg .d{stroke-width:calc(var(--u)*1.4)}`;

const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
for (const [v, w, h] of [
  ['desktop', 1440, 900],
  ['mobile', 390, 844],
]) {
  // reduced motion gives the un-pinned Journey layout, so every chapter can be photographed
  const ctx = await b.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
    isMobile: w < 700,
    hasTouch: w < 700,
    reducedMotion: 'reduce',
  });
  const p = await ctx.newPage();
  await p.goto(base + '/', { waitUntil: 'load' });
  await p.waitForTimeout(3000); // let React hydrate before the chapters are edited
  await p.addStyleTag({ content: CSS });
  await p.evaluate((svgs) => {
    const lis = [...document.querySelectorAll('#journey li')];
    lis.forEach((li, i) => {
      const box = document.createElement('div');
      box.innerHTML = svgs[i];
      li.querySelector('[role=img]').replaceWith(box);
      const svg = box.firstChild;
      svg.style.setProperty('--u', String(640 / svg.getBoundingClientRect().width));
    });
    lis[3].querySelector('h3').textContent = 'Carry';
    lis[3].querySelector('p').textContent =
      'Heaped in baskets, the salt is carried from the pans by hand. [CONFIRM]';
    lis[4].querySelector('p').textContent =
      'For kala namak, lake salt is processed with harad, baheda and amla. [CONFIRM full process] Packed at Sambhar in clear 1 kg jars, each marked with its batch and dates.';
    // the self-drawing state: every path gets its own window of a single 0–1 draw;
    // groups of short strokes fade up as they start, so round caps never show as dots
    window.draw = (svg, e) => {
      const ps = [...svg.querySelectorAll('path')];
      ps.forEach((q, i) => {
        const L = +q.dataset.m || q.getTotalLength();
        const a = Math.min(1, Math.max(0, (e - (i / ps.length) * 0.7) / 0.3));
        const base = +(q.getAttribute('opacity') || 1);
        q.style.strokeDasharray = `${L} ${L * 2}`;
        q.style.strokeDashoffset = String(L * (1 - a));
        q.style.opacity = String(base * (q.dataset.m ? Math.min(1, a / 0.18) : a > 0 ? 1 : 0));
      });
    };
  }, svgs);
  const lis = await p.$$('#journey li');
  for (let i = 0; i < 5; i++) await lis[i].screenshot({ path: `${out}/${v}-0${i + 1}.png` });
  await p.evaluate(() => window.draw(document.querySelectorAll('#journey li svg')[3], 0.55));
  await p.waitForTimeout(100);
  await lis[3].screenshot({ path: `${out}/${v}-04-mid-draw.png` });
  await ctx.close();
}
await b.close();
