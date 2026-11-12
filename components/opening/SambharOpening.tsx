import { type CSSProperties } from 'react';
import { SAMBHAR } from './sambharGlyphs';
import { COUNTER_START, WINDOW, clockTime, letterStart } from './timing';
import styles from './SambharOpening.module.css';

const [VX, VY, VW, VH] = SAMBHAR.viewBox;

/** Each contour's index in the word (the outer contour, then its counters), for --len. */
const FIRST = SAMBHAR.letters.reduce<number[]>(
  (acc, l, i) => [
    ...acc,
    (acc[i - 1] ?? 0) + (i ? 1 + SAMBHAR.letters[i - 1]!.counters.length : 0),
  ],
  [],
);
/**
 * Phones: SAMBHAR spans the width less 24px margins each side (clamped like the CSS); wider
 * screens: 78% of the width.
 */
const PHONE = 700;

/** The word's geometry as fractions of its width (the CSS lays it out from these). */
const GEO = {
  '--line-frac': ((SAMBHAR.line - VY) / VH).toFixed(5),
  '--aspect': `${VW} / ${VH}`,
  // the baseline and the cap line, measured from the seam, per unit of word width
  '--base-w': (-SAMBHAR.line / VW).toFixed(5),
  '--cap-w': ((SAMBHAR.cap + SAMBHAR.line) / VW).toFixed(5),
} as CSSProperties;

/**
 * Runs as the markup is parsed, before first paint (no React, no effect):
 *  - each hairline's length on screen (the strokes are non-scaling, so their dashes are in
 *    screen px; into a <style> in <head>, since React owns the paths' attributes) and the line
 *    the word sits on (a whole pixel at half the height);
 *  - the first scroll input (wheel, touch, key, pointer; passive, once) speeds every running
 *    intro animation (the opening's, and the header's fade) so each ends within 0.3 s. It never
 *    touches scroll or layout;
 *  - data-intro-done once the scroll cue has faded in (it drives nothing heavy).
 */
const PRE = `(function(r){var d=document.documentElement,w=innerWidth,s=(w<${PHONE}?Math.min(651,Math.max(200,w-48)):.78*w)/${VW},c='',g=r.querySelector('[data-strokes]');g&&g.querySelectorAll('[data-c]').forEach(function(p){c+='[data-opening] [data-c="'+p.getAttribute('data-c')+'"]{--len:'+(p.getTotalLength()*s).toFixed(2)+'}'});var e=document.getElementById('sambhar-len')||document.head.appendChild(document.createElement('style'));e.id='sambhar-len';e.textContent=c;r.style.setProperty('--seam',Math.round(r.clientHeight/2)+'px');var E=['wheel','touchmove','keydown','pointerdown'],h=document.querySelector('[data-site-header]'),f=function(){E.forEach(function(n){removeEventListener(n,f,true)});if(!document.getAnimations)return;document.getAnimations().forEach(function(a){var t=a.effect&&a.effect.target;if(!t||!(r.contains(t)||(h&&h.contains(t))))return;var m=a.effect.getComputedTiming(),l=m.endTime-(a.currentTime||0);if(isFinite(l)&&l>300)a.playbackRate=l/300})};E.forEach(function(n){addEventListener(n,f,{capture:true,passive:true})});r.addEventListener('animationend',function(v){if(v.target.hasAttribute&&v.target.hasAttribute('data-cue'))d.setAttribute('data-intro-done','')})})(document.currentScript.parentNode)`;

/** The CSS engraving's timing for a contour drawn over [a, a + w] of the progress, on the clock. */
const timed = (a: number, w: number) => ({
  animationDelay: `${clockTime(a).toFixed(3)}s`,
  animationDuration: `${(clockTime(a + w) - clockTime(a)).toFixed(3)}s`,
});

/**
 * One copy of the word: the navy ink in an HTML wrapper (its clip-path, opened from the line by
 * CSS, is in the wrapper's own box, not the SVG's), and the gold hairlines over it.
 */
function Word() {
  const box = `${VX} ${VY} ${VW} ${VH}`;
  return (
    <div className={styles.word} data-word>
      <div className={styles.ink} data-ink>
        <svg viewBox={box} aria-hidden="true" focusable="false">
          {SAMBHAR.letters.map((l, i) => (
            <path key={i} d={l.outer + l.counters.join('')} fillRule="evenodd" />
          ))}
        </svg>
      </div>
      <svg
        className={styles.strokes}
        data-strokes
        viewBox={box}
        aria-hidden="true"
        focusable="false"
      >
        {SAMBHAR.letters.map((l, i) => (
          <g key={i}>
            <path
              d={l.outer}
              data-contour={i}
              data-c={FIRST[i]}
              style={timed(letterStart(i), WINDOW)}
            />
            {l.counters.map((c, k) => (
              <path
                key={k}
                d={c}
                data-contour={i}
                data-c={FIRST[i]! + 1 + k}
                data-counter=""
                style={timed(letterStart(i) + COUNTER_START * WINDOW, (1 - COUNTER_START) * WINDOW)}
              />
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}

/**
 * "Sambhar is engraved": the homepage's opening. An overlay in the hero's pinned stage, above
 * the Journey panorama. No effects, no scroll code: the whole intro is CSS from first paint
 * (SambharOpening.module.css): the gold engraving (0–2.4 s), the navy fill opening from the
 * line (2.4–3.3 s), the outline fading (3.1–3.7 s), सांभर, the header, the subline, the cue
 * (by 4.8 s). The first scroll input speeds it up to finish within 0.3 s (PRE).
 *
 * The split (components/sections/Journey, the first phase of its one scrubbed timeline): two
 * identical full-screen panels, each clipped to its half, part from a gold seam at the centre
 * to show scene 01 behind them.
 *
 * Without JS, or with reduced motion, the CSS shows the filled word on one static screen.
 */
export function SambharOpening() {
  return (
    <div className={styles.opening} style={GEO} data-opening suppressHydrationWarning>
      <span className="sr-only">Sambhar</span>
      <Panel side="l" />
      <Panel side="r" />
      {/* the seam: a gold hairline drawn down the centre as the split begins */}
      <div className={styles.seamBox} aria-hidden="true">
        <i className={styles.seamLine} data-seam-line />
      </div>
      <script dangerouslySetInnerHTML={{ __html: PRE }} />
    </div>
  );
}

/** One half of the screen: the whole opening, clipped to the left or the right half. */
function Panel({ side }: { side: 'l' | 'r' }) {
  return (
    <div className={styles.panel} data-panel={side} aria-hidden={side === 'r' || undefined}>
      <p className={styles.hindi} lang="hi" aria-hidden="true" data-hindi>
        सांभर
      </p>
      <div className={styles.box}>
        <Word />
      </div>
      <p className={`py-lead ${styles.body}`} data-body>
        Black salt and lake salt from India’s largest inland salt lake.
      </p>
      <div className={styles.cue} aria-hidden="true" data-cue>
        <span>Scroll</span>
        <i />
      </div>
    </div>
  );
}
