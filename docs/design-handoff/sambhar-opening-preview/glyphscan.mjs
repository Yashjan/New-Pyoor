import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const S = process.argv[2];
const g = JSON.parse(readFileSync(S + '/sambhar/glyphs.json', 'utf8'));
const font = readFileSync(S + '/sambhar/cormorant-500-latin.woff2').toString('base64');
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const p = await b.newPage();
await p.setContent(`<style>@font-face{font-family:C;src:url(data:font/woff2;base64,${font})}</style><span style="font:500 100px C">SAMBHAR</span>`);
await p.evaluate(() => document.fonts.ready);
const r = await p.evaluate((g) => {
  const out = {};
  // bars: rasterise H and A at 1000 units = 1000 px, flip y
  for (const [ch, xs] of [['H', [300, 380, 460]], ['A', [330, 355, 380]]]) {
    const c = document.createElement('canvas'); c.width = 1000; c.height = 1000;
    const x = c.getContext('2d'); x.translate(0, 900); x.scale(1, -1);
    x.fill(new Path2D(g.glyphs[ch].d));
    const d = x.getImageData(0, 0, 1000, 1000).data;
    out[ch] = xs.map((col) => { const rows = []; for (let y = 0; y < 1000; y++) if (d[(y * 1000 + col) * 4 + 3] > 128) rows.push(900 - y); return [col, rows.length ? [Math.min(...rows), Math.max(...rows)] : null]; });
  }
  // the font's own kerning, as Chrome applies it (font-kerning: normal), in font units
  const m = document.createElement('canvas').getContext('2d'); m.font = '500 1000px C';
  const w = (s) => m.measureText(s).width;
  m.fontKerning = 'normal';
  out.kern = {};
  for (const pr of ['SA', 'AM', 'MB', 'BH', 'HA', 'AR']) out.kern[pr] = Math.round(w(pr) - w(pr[0]) - w(pr[1]));
  m.fontKerning = 'normal'; out.word = Math.round(w('SAMBHAR'));
  return out;
}, g);
console.log(JSON.stringify(r));
await b.close();
