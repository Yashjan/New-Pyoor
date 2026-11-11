// usage: node record.mjs <base> <outDir> <name> <w> <h> [--video] [--cpu4] [--slow4g] [--reduced] [--skip=ms]
import { chromium } from 'playwright-core';
import { renameSync, mkdirSync } from 'node:fs';
const [, , base, out, name, w, h, ...flags] = process.argv;
const has = (f) => flags.includes(f);
const skipAt = +(flags.find((f) => f.startsWith('--skip='))?.split('=')[1] || 0);
const mobile = +w < 700;
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
const ctx = await b.newContext({
  viewport: { width: +w, height: +h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile,
  reducedMotion: has('--reduced') ? 'reduce' : 'no-preference',
  ...(has('--video') ? { recordVideo: { dir: out, size: { width: +w, height: +h } } } : {}),
});
await ctx.addInitScript(() => {
  const ft = [], ev = []; let last = 0;
  const lf = []; const tick = (t) => { if (last) { ft.push([t, t - last]); if (t - last > 50) lf.push([Math.round(last), Math.round(t - last)]); } last = t; if (!document.documentElement.hasAttribute('data-intro-done')) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const seen = new Set();
  const mo = new MutationObserver(() => {
    const d = document.querySelector('[data-dawn]')?.dataset.phase;
    if (d && !seen.has('phase ' + d)) { seen.add('phase ' + d); ev.push(['phase ' + d, performance.now()]); }
    for (const a of ['data-header-in', 'data-intro-play', 'data-jar-in', 'data-intro-done'])
      if (document.documentElement.hasAttribute(a) && !seen.has(a)) { seen.add(a); ev.push([a, performance.now()]); }
  });
  document.addEventListener('DOMContentLoaded', () => mo.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['data-phase', 'data-header-in', 'data-intro-play', 'data-jar-in', 'data-intro-done'] }));
  window.__rec = { ft, ev, lf };
});
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
const cdp = await ctx.newCDPSession(p);
if (has('--cpu4')) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
// DevTools "Slow 4G": 1.6 Mbps down, 750 kbps up, 562.5 ms RTT
if (has('--slow4g')) { await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 562.5, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }); }
await p.goto(base + '/', { waitUntil: 'commit', timeout: 120000 });
if (skipAt) { await p.waitForTimeout(skipAt); await p.mouse.click(+w / 2, +h / 3); }
await p.waitForFunction(() => document.documentElement.hasAttribute('data-intro-done'), null, { timeout: 60000, polling: 100 });
await p.waitForTimeout(2500); // let the hero intro settle on camera
const r = await p.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  const paint = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
  return { ...window.__rec, fcp: paint, dcl: nav?.domContentLoadedEventEnd, busy: document.getElementById('main')?.getAttribute('aria-busy'), overlay: !!document.querySelector('[data-dawn]'), cls: window.__cls };
});
const video = has('--video') ? await p.video().path() : null;
await ctx.close(); await b.close();
if (video) renameSync(video, `${out}/${name}.webm`);
// frame stats over the intro (first frame → done)
const startT = r.ev.find((e) => e[0].startsWith('phase'))?.[1] ?? 0, doneT = r.ev.find((e) => e[0] === 'data-intro-done')?.[1] ?? Infinity;
const ft = r.ft.filter(([t, d]) => d > 0 && t > startT && t <= doneT).map(([, d]) => d), sorted = [...ft].sort((a, b) => a - b), mean = ft.reduce((a, b) => a + b, 0) / ft.length;
const pct = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
const start = r.ev.find((e) => e[0].startsWith('phase'))?.[1];
console.log(JSON.stringify({
  name, frames: ft.length, avgFps: +(1000 / mean).toFixed(1), p95FrameMs: +pct(0.95).toFixed(1), p99FrameMs: +pct(0.99).toFixed(1), maxFrameMs: +sorted[sorted.length - 1].toFixed(1),
  over20ms: ft.filter((x) => x > 20).length, over33ms: ft.filter((x) => x > 33.4).length,
  fcp: r.fcp && +r.fcp.toFixed(0), introStart: start && +start.toFixed(0),
  events: Object.fromEntries(r.ev.map(([k, t]) => [k, +((t - (start ?? 0)) / 1000).toFixed(2)])),
  longFrames: r.lf.map(([t, d]) => [+((t - (start ?? 0)) / 1000).toFixed(2), d]), busyAfter: r.busy, overlayAfter: r.overlay, errors: errs,
}));
