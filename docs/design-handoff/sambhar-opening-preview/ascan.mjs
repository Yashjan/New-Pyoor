import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const g = JSON.parse(readFileSync(process.argv[2] + '/sambhar/glyphs.json', 'utf8'));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const p = await b.newPage();
console.log(await p.evaluate((d) => {
  const c = document.createElement('canvas'); c.width = 1000; c.height = 1000;
  const x = c.getContext('2d'); x.translate(0, 900); x.scale(1, -1); x.fill(new Path2D(d));
  const px = x.getImageData(0, 0, 1000, 1000).data, res = [];
  for (const col of [240, 270, 300, 330, 380, 410, 440, 470]) {
    const segs = []; let on = false, s = 0;
    for (let y = 899; y >= 0; y--) { const f = px[(y * 1000 + col) * 4 + 3] > 128; const u = 900 - y; if (f && !on) { on = true; s = u; } if (!f && on) { on = false; segs.push([s, u - 1]); } }
    res.push(col + ': ' + JSON.stringify(segs));
  }
  return res.join('\n');
}, g.glyphs.A.d));
await b.close();
