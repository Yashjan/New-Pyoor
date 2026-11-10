// "Sambhar is engraved" opening — still-frame preview, injected into the real homepage.
// window.SO.render(state) draws one frame. State (all 0–1 unless noted):
//   engrave  outline drawing progress (letters staggered)   fill   ink fill
//   outline  outline opacity          line   gold line length (from the centre)
//   hi / body / cue / header          text and header opacity
//   open     how far the horizon has opened                  jar   jar rise (ease applied inside)
//   halves   opacity of the two SAMBHAR halves               drift  extra outward drift of the halves
//   glow     dawn glow strength in the gap                   copy   headline + CTA opacity
//   slide    desktop: the jar's glide from the centre to 62% of the width (ease-settle inside)
// v2: glyphs are the union-cleaned static paths (y-down font units); halves stay full navy and
//     drift off-screen; phones span 92% (16px gutters) with 0.75px strokes.
(function () {
  const G = window.__GLYPHS; // { upm, cap, glyphs: { S: { adv, contours[], bounds } … } }
  const WORD = 'SAMBHAR';
  const TRACK = 40; // 0.04em, in font units
  // optical spacing: added to the tracking for each pair (font units; the font kerns none of them)
  const PAIR = { SA: -28, AM: -28, MB: 10, BH: 6, HA: -34, AR: -36 };
  const LINE_UNITS = 300; // the gold line: 300/1000 em above the baseline (H bar 315–337, A bar 262–283)
  const NAVY = '#18214a', GOLD = '#a8823f', GOLD7 = '#7a5c26';
  const ns = 'http://www.w3.org/2000/svg';
  const el = (n, a = {}, p) => { const e = document.createElementNS(ns, n); for (const k in a) e.setAttribute(k, a[k]); if (p) p.append(e); return e; };
  const clamp = (x) => Math.min(1, Math.max(0, x));
  const settle = (t) => 1 - Math.pow(1 - clamp(t), 3);

  let inkPx, W, H, em, x0, lineY, baseline, cap, letters, root, svg, halves, lineEl, glowRect, gapClip, jarWrap, jar, hi, body, cue, copy, extra;

  function layout() {
    W = innerWidth; H = innerHeight;
    // positions in font units
    let x = 0; letters = [];
    for (let i = 0; i < WORD.length; i++) {
      const ch = WORD[i], g = G.glyphs[ch];
      letters.push({ ch, x });
      if (i < WORD.length - 1) x += g.adv + TRACK + PAIR[ch + WORD[i + 1]];
    }
    const inkL = G.glyphs.S.bounds[0], inkR = letters[6].x + G.glyphs.R.bounds[2];
    const inkW = inkR - inkL;
    inkPx = W < 700 ? W - 32 : 0.78 * W; // phones: 92% (16px gutters); desktop: 78% of the width
    em = (inkPx / inkW) * 1000;
    x0 = W / 2 - ((inkL + inkW / 2) * em) / 1000;
    lineY = Math.round(H * 0.5) + 0.5;
    baseline = lineY + (LINE_UNITS * em) / 1000;
    cap = (G.cap * em) / 1000;
  }

  function build() {
    root = document.createElement('div');
    root.id = 'so';
    root.style.cssText = 'position:fixed;inset:0;z-index:45;pointer-events:none;background:linear-gradient(#f5f1e8 0%,#f5f1e8 52%,#efe6d6 100%)';
    document.body.append(root);
    // the jar sits under the letters, clipped to the opening
    jarWrap = document.createElement('div');
    jarWrap.style.cssText = 'position:absolute;inset:0';
    jar = document.createElement('img');
    jar.src = '/images/renders/jar-black.webp';
    jar.style.cssText = 'position:absolute;left:0;top:0;transform-origin:50% 100%';
    jarWrap.append(jar);
    svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: 'position:absolute;inset:0;overflow:visible' });
    const defs = el('defs', {}, svg);
    const rg = el('radialGradient', { id: 'so-glow', cx: '50%', cy: '50%', r: '50%' }, defs);
    el('stop', { offset: '0', 'stop-color': GOLD, 'stop-opacity': '1' }, rg);
    el('stop', { offset: '0.55', 'stop-color': GOLD, 'stop-opacity': '0.35' }, rg);
    el('stop', { offset: '1', 'stop-color': GOLD, 'stop-opacity': '0' }, rg);
    gapClip = el('clipPath', { id: 'so-gap' }, defs);
    el('rect', { x: 0, y: 0, width: W, height: 0 }, gapClip);
    // the dawn glow, only inside the opening
    glowRect = el('ellipse', { fill: 'url(#so-glow)' }, svg);
    // two copies of the word: the top half and the bottom half, split along the gold line
    halves = ['top', 'bottom'].map((side) => {
      const cp = el('clipPath', { id: 'so-' + side }, defs);
      el('rect', side === 'top' ? { x: -W, y: -H, width: 3 * W, height: H + lineY } : { x: -W, y: lineY, width: 3 * W, height: 2 * H }, cp);
      const outer = el('g', {}, svg);
      const g = el('g', { 'clip-path': `url(#so-${side})` }, outer);
      const fill = [], stroke = [];
      for (const L of letters) {
        const t = `translate(${x0 + (L.x * em) / 1000} ${baseline}) scale(${em / 1000})`; // paths are y-down
        const gf = el('g', { transform: t }, g), gs = el('g', { transform: t }, g);
        fill.push([el('path', { d: G.glyphs[L.ch].d, fill: NAVY }, gf)]); // original outline: counters stay open
        stroke.push(G.glyphs[L.ch].contours.map((d) => el('path', { d, fill: 'none', stroke: GOLD, 'stroke-width': W < 700 ? 0.75 : 1, 'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gs)));
      }
      return { outer, fill, stroke };
    });
    lineEl = el('rect', { fill: GOLD, height: 1 }, svg);
    // a static grain (±2 levels) over the glow: breaks the 8-bit steps that otherwise show as rings
    const nc = document.createElement('canvas'); nc.width = nc.height = 128;
    const nx = nc.getContext('2d'), img = nx.createImageData(128, 128);
    for (let k = 0; k < img.data.length; k += 4) { const l = Math.random() < 0.5; img.data[k] = img.data[k + 1] = img.data[k + 2] = l ? 255 : 40; img.data[k + 3] = Math.floor(Math.random() * 9); }
    nx.putImageData(img, 0, 0);
    const grain = document.createElement('div');
    grain.style.cssText = `position:absolute;inset:0;background:url(${nc.toDataURL()})`;
    root.append(jarWrap, svg, grain);
    // the small texts, on the type scale
    hi = document.createElement('p');
    hi.textContent = 'सांभर'; hi.lang = 'hi';
    hi.style.cssText = `position:absolute;left:0;right:0;margin:0;text-align:center;font-family:var(--font-tiro),serif;font-size:20px;line-height:24px;color:${GOLD7}`;
    body = document.createElement('p');
    body.className = 'py-lead';
    body.textContent = 'Black salt and lake salt from India’s largest inland salt lake.';
    body.style.cssText = 'position:absolute;left:24px;right:24px;margin:0 auto;max-width:36ch;text-align:center';
    cue = document.createElement('div');
    cue.className = 'py-eyebrow';
    cue.innerHTML = 'Scroll<i style="display:block;width:1px;height:34px;margin:10px auto 0;background:#a8823f"></i>';
    cue.style.cssText = 'position:absolute;left:0;right:0;bottom:28px;text-align:center;color:var(--text-muted)';
    copy = document.createElement('div');
    copy.style.cssText = 'position:absolute;display:flex;flex-direction:column;gap:28px';
    const h = document.querySelector('[data-hero-copy] h1').cloneNode(true);
    h.className = 'py-display py-d-l';
    h.querySelectorAll('span').forEach((s) => (s.style.animation = 'none', s.style.transform = 'none'));
    const cta = document.querySelector('[data-hero-copy] [class*=cta]').cloneNode(true);
    cta.style.animation = 'none';
    // the trust row and the gold hero Horizon under the CTA (text column width only)
    const trust = document.querySelector('[data-hero-copy] [class*=trust]').cloneNode(true);
    const hz = document.querySelector('[data-hero-copy] [data-hero-horizon]').cloneNode(true);
    for (const e of [trust, hz, ...hz.querySelectorAll('*')]) { e.style.animation = 'none'; e.style.transform = 'none'; e.style.opacity = '1'; e.style.visibility = 'visible'; }
    hz.style.width = '100%'; hz.style.maxWidth = '520px'; hz.style.marginTop = '-8px';
    trust.style.width = '100%'; trust.style.maxWidth = '520px';
    extra = [trust, hz];
    copy.append(h, cta, trust, hz);
    root.append(hi, body, cue, copy);
    // hide the current hero's own first screen; the opening replaces it
    const st = document.createElement('style');
    st.textContent = '[data-hero-copy],[data-hero] canvas,[data-hero] img,[data-beat],[data-hero] [aria-hidden="true"]{visibility:hidden!important}';
    document.head.append(st);
  }

  function render(s) {
    const S = Object.assign({ engrave: 1, fill: 1, outline: 0, line: 1, hi: 1, body: 0, cue: 0, header: 1, open: 0, jar: 0, halves: 1, drift: 0, glow: 0, copy: 0, jarY: 0, slide: 0 }, s);
    const travel = 0.27 * H; // full opening: each half moves ~27% of the height
    const up = S.open * travel + S.drift * 0.36 * H, // drift 1: both halves are past the viewport edges
      down = 0.9 * up; // the bottom half moves 10% less
    // the word, its two halves
    const hb = document.querySelector('[data-site-header]').getBoundingClientRect().bottom;
    const topClip = document.querySelector('#so-top rect');
    topClip.setAttribute('y', hb + up); topClip.setAttribute('height', Math.max(0, lineY - hb - up)); // in the half's own (moved) space
    halves.forEach((hf, k) => {
      hf.outer.setAttribute('transform', `translate(0 ${k === 0 ? -up : down})`);
      hf.outer.setAttribute('opacity', S.halves);
      hf.stroke.forEach((paths, i) => {
        // letters engrave one after another (staggered ~0.06 s of a ~1.2 s draw), contours in order
        const li = clamp((S.engrave * 1.36 - i * 0.06) / 1);
        paths.forEach((p) => {
          const a = li;
          const len = (p.getTotalLength() * em) / 1000 + 2; // non-scaling-stroke: dashes are in screen px, not font units
          p.setAttribute('stroke-dasharray', `${len} ${len}`);
          p.setAttribute('stroke-dashoffset', len * (1 - a));
          p.setAttribute('opacity', S.outline);
        });
      });
      hf.fill.forEach((paths) => paths.forEach((p) => p.setAttribute('opacity', S.fill)));
    });
    // the gold line: from the centre (its length = progress); later it rides under the top half
    const lw = W * S.line;
    lineEl.setAttribute('x', W / 2 - lw / 2); lineEl.setAttribute('width', lw);
    lineEl.setAttribute('y', lineY - 0.5 - up);
    lineEl.setAttribute('opacity', (0.9 * (1 - clamp(S.open / 0.7))).toFixed(3));
    // the opening and its dawn glow
    const gt = lineY - up, gb = lineY + down;
    const r = gapClip.firstChild; r.setAttribute('y', gt); r.setAttribute('height', Math.max(0, gb - gt)); r.setAttribute('width', W);
    glowRect.setAttribute('cx', W / 2); glowRect.setAttribute('cy', lineY); glowRect.setAttribute('rx', W * 0.42); glowRect.setAttribute('ry', H * 0.36);
    glowRect.setAttribute('opacity', S.glow.toFixed(3)); // gold-500 at S.glow (≈ 0.08) in the centre
    // the jar: rises from 30% below to centre with ease-settle, a 3° tilt straightening as it arrives
    const jh = (W < 700 ? 0.3 : 0.44) * H, jw = (jh * 1206) / 1570;
    const k = settle(S.jar);
    const target = lineY + S.jarY * H;
    const fromBelow = lineY + (1 - k) * 0.3 * H; // the sunrise: 30% below to centre, ease-settle
    const cy = S.halves > 0.02 && S.open < 1 ? Math.max(target, fromBelow, gt + jh / 2 + 14) : Math.max(target, fromBelow);
    jar.style.width = jw + 'px'; jar.style.height = jh + 'px';
    const jx = W >= 700 ? W / 2 + (0.62 - 0.5) * W * settle(S.slide) : W / 2; // desktop: glides to 62%
    jar.style.transform = `translate(${jx - jw / 2}px, ${cy - jh / 2}px) rotate(${3 * (1 - k)}deg)`;
    jar.style.opacity = S.jar > 0 ? 1 : 0;
    // behind the horizon: the jar's lower part is hidden below the opening's bottom edge, with a
    // 16px feathered edge (it emerges softly, like a sunrise through haze, not out of a slot)
    const m = S.halves > 0.02 && S.open < 1 ? `linear-gradient(#000 0, #000 ${gb - 16}px, transparent ${gb}px)` : 'none';
    jarWrap.style.webkitMaskImage = jarWrap.style.maskImage = m;
    jarWrap.style.clipPath = 'none';
    // texts
    hi.style.top = baseline - cap - 24 - 30 - up + 'px'; hi.style.opacity = S.hi * S.halves * (1 - clamp(S.open / 0.5)); // rides with the top half, gone by half open
    body.style.top = baseline + 40 + 'px'; body.style.opacity = S.body;
    cue.style.opacity = S.cue;
    for (const c of document.querySelector('[data-site-header]').children) c.style.opacity = S.header;
    // headline + CTA beside the jar (left on desktop, below on mobile)
    copy.style.opacity = S.copy;
    const hEl = copy.firstChild; hEl.style.fontSize = W >= 700 ? '64px' : '44px'; hEl.style.lineHeight = '1'; hEl.style.letterSpacing = '-0.01em'; hEl.style.margin = '0';
    if (W >= 700) { const left = W * 0.08; copy.style.left = left + 'px'; copy.style.width = jx - jw / 2 - 72 - left + 'px'; copy.style.top = lineY - copy.offsetHeight / 2 + 'px'; copy.style.alignItems = 'flex-start'; extra.forEach((e) => (e.style.display = '')); }
    else { extra.forEach((e) => (e.style.display = 'none')); /* mobile 5 unchanged */ copy.style.left = '20px'; copy.style.right = '20px'; copy.style.top = cy + jh / 2 + 28 + 'px'; copy.style.alignItems = 'flex-start'; copy.style.gap = '20px'; }
  }

  layout(); build();
  window.SO = { render, info: () => ({ W, H, em, capPx: cap, lineY, baseline, x0, inkWidthPx: inkPx, letters: letters.map((l) => [l.ch, +(x0 + (l.x * em) / 1000).toFixed(1)]) }) };
})();
