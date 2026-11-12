import { test, expect, type Page, type CDPSession } from '@playwright/test';

/**
 * Scrolling is never held: from the first paint, through the SAMBHAR engraving and the fill,
 * one scroll input moves the page AND the SAMBHAR handoff (the word fades, the line draws).
 * Then a slow scroll through the Journey moves each scrubbed section smoothly.
 */

type Probe = { y: number; opacity: number; journey: number; opening: number };
const probe = (page: Page) =>
  page.evaluate<Probe>(() => {
    const o = document.querySelector<HTMLElement>('[data-opening]');
    const j = document.querySelector<HTMLElement>('[data-journey]');
    return {
      y: window.scrollY,
      opacity: o ? Number(getComputedStyle(o).opacity) : 1,
      journey: Number(j?.dataset.progress ?? 0),
      opening: Number(o?.dataset.progress ?? 0),
    };
  });

/** One scroll input of `dy` px: a wheel on desktop, a finger drag on the phone. */
async function scrollInput(page: Page, cdp: CDPSession, touch: boolean, dy: number) {
  if (!touch) {
    await page.mouse.move(700, 450);
    await page.mouse.wheel(0, dy);
    return;
  }
  const x = 195;
  const y0 = 760;
  const steps = 8;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y0 - (dy * i) / steps }],
    });
    await page.waitForTimeout(16); // one move per frame, like a finger
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Loads the homepage and returns once `at` ms have passed since navigation started. */
async function loadAndWait(page: Page, at: number) {
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForFunction(
    (t) => performance.now() >= t && !!document.querySelector('[data-opening]'),
    at,
    { polling: 16 },
  );
}

for (const [name, at] of [
  ['a: during the engraving (0.5 s)', 500],
  ['b: during the fill (3 s)', 3000],
  ['c: after the intro (6 s)', 6000],
] as const) {
  test(`${name}: the first scroll moves the page and the handoff within 300 ms`, async ({
    page,
  }, info) => {
    const touch = info.project.name === 'phone';
    const cdp = await page.context().newCDPSession(page);
    await loadAndWait(page, at);
    const before = await probe(page);
    expect(before.y).toBe(0);
    await scrollInput(page, cdp, touch, 400);
    const t0 = Date.now(); // from the end of the input (a finger drag itself takes ~150 ms)
    let after = before;
    while (Date.now() - t0 < 300) {
      after = await probe(page);
      if (after.y > 0 && after.opacity < before.opacity - 0.01) break;
      await page.waitForTimeout(16);
    }
    console.log(`${info.project.name} ${name}: ${Date.now() - t0} ms`, before, after);
    expect(after.y, 'scrollY moved').toBeGreaterThan(0);
    expect(after.opacity, 'the handoff moved (SAMBHAR fades)').toBeLessThan(before.opacity - 0.01);
  });
}

test('d: a slow scroll through the Journey moves every scrubbed section smoothly', async ({
  page,
}, info) => {
  const touch = info.project.name === 'phone';
  const cdp = await page.context().newCDPSession(page);
  await loadAndWait(page, 500);
  const end = await page.evaluate(() => window.innerHeight * 5); // JOURNEY_VH
  const samples: Probe[] = [await probe(page)];
  for (let i = 0; i < 400 && samples.at(-1)!.journey < 0.999; i++) {
    await scrollInput(page, cdp, touch, 80);
    await page.waitForTimeout(90);
    samples.push(await probe(page));
    if (process.env.DEBUG_SCROLL) console.log(Date.now(), JSON.stringify(samples.at(-1)));
    if (samples.at(-1)!.y > end + 600) break;
  }
  // let the scrub settle
  await page.waitForTimeout(1000);
  samples.push(await probe(page));
  const worst = (k: 'journey' | 'opening') =>
    Math.max(...samples.slice(1).map((s, i) => s[k] - samples[i]![k]));
  const back = (k: 'journey' | 'opening') =>
    Math.min(...samples.slice(1).map((s, i) => s[k] - samples[i]![k]));
  console.log(
    `${info.project.name} d: ${samples.length} steps, final`,
    samples.at(-1),
    'largest step: journey',
    worst('journey').toFixed(3),
    'opening',
    worst('opening').toFixed(3),
  );
  expect(samples.at(-1)!.journey, 'reached the end of the Journey').toBeGreaterThan(0.99);
  expect(worst('journey'), 'Journey: no step over 10%').toBeLessThanOrEqual(0.1);
  expect(worst('opening'), 'opening: no step over 10%').toBeLessThanOrEqual(0.1);
  expect(back('journey'), 'Journey never jumps back').toBeGreaterThanOrEqual(-0.001);
  expect(back('opening'), 'opening never jumps back').toBeGreaterThanOrEqual(-0.001);
});

for (const delayGlb of [false, true]) {
  test(`e: top to bottom in small steps${delayGlb ? ', the GLB 5 s late' : ''}: every step scrolls, the 3D jar lands on the engraving`, async ({
    page,
  }, info) => {
    test.setTimeout(240_000);
    const touch = info.project.name === 'phone';
    const cdp = await page.context().newCDPSession(page);
    if (delayGlb)
      await page.route('**/models/**', async (route) => {
        await new Promise((r) => setTimeout(r, 5000));
        await route.continue();
      });
    await loadAndWait(page, 500);
    const read = () =>
      page.evaluate(() => {
        const j = document.querySelector<HTMLElement>('[data-journey]');
        const eng = document.querySelector('[data-veil] [data-jar]');
        const e = eng?.getBoundingClientRect();
        const h = window.__pyoorHero;
        return {
          y: window.scrollY,
          max: document.documentElement.scrollHeight - window.innerHeight,
          s: Number(j?.dataset.progress ?? 0),
          eng: e ? [e.left, e.top, e.right, e.bottom] : null,
          engOpacity: eng ? Number(getComputedStyle(eng).opacity) : 0,
          box: h?.box ?? null,
          shown: !!h?.shown,
        };
      });
    type R = Awaited<ReturnType<typeof read>>;
    const stuck: string[] = [];
    const reveal: R[] = [];
    let prev = await read();
    let steps = 0;
    while (prev.y < prev.max - 2 && steps < 600) {
      await scrollInput(page, cdp, touch, touch ? 120 : 100);
      await page.waitForTimeout(110);
      const now = await read();
      steps++;
      if (now.y <= prev.y) stuck.push(`step ${steps}: y ${prev.y} -> ${now.y} (s ${now.s})`);
      // step 2's reveal, as the jar is filled in (STEP.reveal, 0.35–0.85 of 0.6–1)
      if (now.s > 0.86 && now.s < 0.96) reveal.push(now);
      prev = now;
    }
    // the jar where the engraving is: centres within 5% of the engraving's box
    const off = reveal
      .filter((r) => r.shown && r.box && r.eng)
      .map((r) => {
        const [a, b, c, d] = r.eng as [number, number, number, number];
        const [p, q, u, v] = r.box as [number, number, number, number];
        return Math.max(
          Math.abs((p + u) / 2 - (a + c) / 2) / (c - a),
          Math.abs((q + v) / 2 - (b + d) / 2) / (d - b),
        );
      });
    const engravingHeld = reveal.filter((r) => !r.shown).every((r) => r.engOpacity > 0.5);
    console.log(
      `${info.project.name} e${delayGlb ? ' (GLB +5 s)' : ''}: ${steps} steps to y ${prev.y}/${prev.max};`,
      `stuck ${stuck.length};`,
      `reveal samples ${reveal.length} (3D shown in ${off.length}), worst centre offset`,
      off.length ? (Math.max(...off) * 100).toFixed(1) + '%' : 'n/a',
      `; engraving held while 3D not ready: ${engravingHeld}`,
    );
    if (stuck.length) console.log(stuck.slice(0, 10).join('\n'));
    if (process.env.DEBUG_SCROLL) console.log(JSON.stringify(reveal));
    expect(stuck, 'every step scrolls').toEqual([]);
    expect(prev.y, 'reached the end').toBeGreaterThanOrEqual(prev.max - 2);
    expect(engravingHeld, 'the engraving stays while the 3D is not ready').toBe(true);
    if (!delayGlb) expect(off.length, 'the 3D jar was revealed').toBeGreaterThan(0);
    for (const o of off)
      expect(o, '3D jar centred on the engraving (±5%)').toBeLessThanOrEqual(0.05);
  });
}
