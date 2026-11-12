import { test, expect, type Page, type CDPSession } from '@playwright/test';

/**
 * Scrolling is never held: from the first paint, through the SAMBHAR engraving and the fill,
 * one scroll input moves the page AND the SAMBHAR split (the seam draws, the panels part).
 * Then a slow scroll through the Journey moves each scrubbed section smoothly.
 */

type Probe = { y: number; split: number; journey: number };
const probe = (page: Page) =>
  page.evaluate<Probe>(() => {
    const o = document.querySelector<HTMLElement>('[data-opening]');
    const j = document.querySelector<HTMLElement>('[data-journey]');
    return {
      y: window.scrollY,
      split: Number(o?.dataset.progress ?? 0),
      journey: Number(j?.dataset.progress ?? 0),
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
  test(`${name}: the first scroll moves the page and starts the split within 300 ms`, async ({
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
      if (after.y > 0 && after.split > 0) break;
      await page.waitForTimeout(16);
    }
    console.log(`${info.project.name} ${name}: ${Date.now() - t0} ms`, before, after);
    expect(after.y, 'scrollY moved').toBeGreaterThan(0);
    expect(after.split, 'the split started (the seam draws)').toBeGreaterThan(0);
  });
}

test('d: a slow scroll through the Journey moves every scrubbed section smoothly', async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const touch = info.project.name === 'phone';
  const cdp = await page.context().newCDPSession(page);
  await loadAndWait(page, 500);
  const end = await page.evaluate(() => window.innerHeight * 6); // SPLIT_VH + JOURNEY_VH
  const samples: Probe[] = [await probe(page)];
  for (let i = 0; i < 800 && samples.at(-1)!.journey < 0.999; i++) {
    await scrollInput(page, cdp, touch, 40);
    await page.waitForTimeout(90);
    samples.push(await probe(page));
    if (process.env.DEBUG_SCROLL) console.log(Date.now(), JSON.stringify(samples.at(-1)));
    if (samples.at(-1)!.y > end + 600) break;
  }
  // let the scrub settle
  await page.waitForTimeout(1000);
  samples.push(await probe(page));
  const worst = (k: 'journey' | 'split') =>
    Math.max(...samples.slice(1).map((s, i) => s[k] - samples[i]![k]));
  const back = (k: 'journey' | 'split') =>
    Math.min(...samples.slice(1).map((s, i) => s[k] - samples[i]![k]));
  console.log(
    `${info.project.name} d: ${samples.length} steps, final`,
    samples.at(-1),
    'largest step: journey',
    worst('journey').toFixed(3),
    'split',
    worst('split').toFixed(3),
  );
  expect(samples.at(-1)!.journey, 'reached the end of the Journey').toBeGreaterThan(0.99);
  expect(worst('journey'), 'Journey: no step over 10%').toBeLessThanOrEqual(0.1);
  expect(worst('split'), 'split: no step over 10%').toBeLessThanOrEqual(0.1);
  expect(back('journey'), 'Journey never jumps back').toBeGreaterThanOrEqual(-0.001);
  expect(back('split'), 'split never jumps back').toBeGreaterThanOrEqual(-0.001);
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
    // every frame: the 3D canvas must never show unmasked during step 2 (except the late
    // crossfade, which fades the whole layer)
    await page.addInitScript(() => {
      const w = window as unknown as { __unmasked: number };
      w.__unmasked = 0;
      const check = () => {
        const j = document.querySelector<HTMLElement>('[data-journey]');
        const layer = document.querySelector<HTMLElement>('[data-jar-layer]');
        const c = layer?.querySelector('canvas');
        const s = Number(j?.dataset.progress ?? 0);
        if (c && layer && s > 0.6 && s < 0.94) {
          const cs = getComputedStyle(c);
          const mask = getComputedStyle(layer).maskImage;
          const fading = layer.style.opacity !== '';
          if (cs.visibility === 'visible' && cs.opacity !== '0' && mask === 'none' && !fading)
            w.__unmasked++;
        }
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
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
          split: Number(
            document.querySelector<HTMLElement>('[data-opening]')?.dataset.progress ?? 0,
          ),
        };
      });
    type R = Awaited<ReturnType<typeof read>>;
    const stuck: string[] = [];
    const reveal: R[] = [];
    let prev = await read();
    let steps = 0;
    let splitAt = -1; // the step at which the split had started
    while (prev.y < prev.max - 2 && steps < 600) {
      await scrollInput(page, cdp, touch, touch ? 120 : 100);
      await page.waitForTimeout(110);
      const now = await read();
      steps++;
      if (splitAt < 0 && now.split > 0) splitAt = steps;
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
      `stuck ${stuck.length}; split from step ${splitAt};`,
      `reveal samples ${reveal.length} (3D shown in ${off.length}), worst centre offset`,
      off.length ? (Math.max(...off) * 100).toFixed(1) + '%' : 'n/a',
      `; engraving held while 3D not ready: ${engravingHeld}`,
    );
    if (stuck.length) console.log(stuck.slice(0, 10).join('\n'));
    if (process.env.DEBUG_SCROLL) console.log(JSON.stringify(reveal));
    const unmasked = await page.evaluate(
      () => (window as unknown as { __unmasked: number }).__unmasked,
    );
    console.log(`${info.project.name} e: unmasked frames ${unmasked}`);
    expect(unmasked, 'no unmasked 3D frame in step 2').toBe(0);
    expect(stuck, 'every step scrolls').toEqual([]);
    expect(splitAt, 'the split starts with the first step').toBe(1);
    expect(prev.y, 'reached the end').toBeGreaterThanOrEqual(prev.max - 2);
    expect(engravingHeld, 'the engraving stays while the 3D is not ready').toBe(true);
    if (!delayGlb) expect(off.length, 'the 3D jar was revealed').toBeGreaterThan(0);
    for (const o of off)
      expect(o, '3D jar centred on the engraving (±5%)').toBeLessThanOrEqual(0.05);
  });
}

test('f: a reload from the middle starts at the top, the whole SAMBHAR on screen', async ({
  page,
}) => {
  await page.goto('/#journey');
  await page.evaluate(() => window.scrollTo(0, 5000));
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const o = document.querySelector<HTMLElement>('[data-opening]')!;
    const panels = [...o.querySelectorAll<HTMLElement>('[data-panel]')];
    return {
      y: window.scrollY,
      hash: location.hash,
      visible: getComputedStyle(o).visibility,
      split: Number(o.dataset.progress ?? 0),
      transforms: panels.map((p) => getComputedStyle(p).transform),
    };
  });
  console.log('f:', r);
  expect(r.y).toBe(0);
  expect(r.hash, 'the #hash is dropped on reload').toBe('');
  expect(r.visible).toBe('visible');
  expect(r.split).toBe(0);
  for (const t of r.transforms) expect(t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true);
});

test('g: every ScrollTrigger keeps its start and end (after load and 10 s later)', async ({
  page,
}, info) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await page.waitForFunction(() => !!(window as { __pyoorTriggers?: unknown }).__pyoorTriggers);
  await page.waitForTimeout(300);
  const get = () =>
    page.evaluate(() =>
      (window as unknown as { __pyoorTriggers: () => [number, number][] }).__pyoorTriggers(),
    );
  const a = await get();
  await page.waitForTimeout(10_000);
  const b = await get();
  console.log(`${info.project.name} g: ${JSON.stringify(a)} | 10 s later ${JSON.stringify(b)}`);
  expect(b).toEqual(a);
});

/** The intro's state: the ink's clip, the cue's opacity, finite animations still running. */
const intro = (page: Page) =>
  page.evaluate(() => {
    const o = document.querySelector<HTMLElement>('[data-opening]')!;
    const ink = o.querySelector('[data-ink]')!;
    const cue = o.querySelector('[data-cue]')!;
    const running = document.getAnimations().filter((a) => {
      const t = (a.effect as KeyframeEffect | null)?.target;
      return (
        t &&
        o.contains(t) &&
        a.playState === 'running' &&
        isFinite(Number(a.effect?.getComputedTiming().endTime))
      );
    }).length;
    return {
      t: Math.round(performance.now()),
      clip: getComputedStyle(ink).clipPath,
      cue: Number(getComputedStyle(cue).opacity),
      done: document.documentElement.hasAttribute('data-intro-done'),
      running,
      y: window.scrollY,
    };
  });

test('h: untouched, the intro fills at ~2.4 s and is done by ~4.8 s', async ({ page }, info) => {
  await loadAndWait(page, 2200);
  const before = await intro(page);
  await loadAndWaitMore(page, 3500);
  const filled = await intro(page);
  await loadAndWaitMore(page, 5100);
  const end = await intro(page);
  console.log(`${info.project.name} h:`, before, filled, end);
  expect(before.clip, 'no fill before 2.4 s').toContain('inset');
  expect(before.cue).toBe(0);
  expect(filled.cue, 'cue not yet in at 3.5 s').toBe(0);
  expect(end.cue, 'cue in by ~4.8 s').toBe(1);
  expect(end.running).toBe(0);
  expect(end.done).toBe(true);
});

test('i: a scroll at 1 s finishes the intro within ~0.3 s and scrolls at once', async ({
  page,
}, info) => {
  const touch = info.project.name === 'phone';
  const cdp = await page.context().newCDPSession(page);
  await loadAndWait(page, 1000);
  await scrollInput(page, cdp, touch, 200);
  const t0 = Date.now();
  let s = await intro(page);
  while (Date.now() - t0 < 600 && (s.running > 0 || s.cue < 1)) {
    await page.waitForTimeout(25);
    s = await intro(page);
  }
  const took = Date.now() - t0;
  console.log(`${info.project.name} i: finished ${took} ms after the input`, s);
  expect(s.y, 'scrolled').toBeGreaterThan(0);
  expect(s.running, 'every intro animation finished').toBe(0);
  expect(s.cue).toBe(1);
  expect(took).toBeLessThanOrEqual(450);
});

async function loadAndWaitMore(page: Page, at: number) {
  await page.waitForFunction((t) => performance.now() >= t, at, { polling: 16 });
}
