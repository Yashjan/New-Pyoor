'use client';

import { useEffect, useRef } from 'react';
import { loadGsap } from '@/lib/motion/gsap';
import { beforeEnd, openVh } from '@/lib/motion/pans';

/**
 * "The lake opens": the last openVh() screens of the hero's pin, after the salt pans, scrubbed
 * and reversible (fractions of that range):
 *
 *   0–.15    the pans' line lifts out of its mask; the field stays
 *   .10–.30  the seam: a gold line draws across the middle of the screen
 *   .25–.65  the field splits along it, its halves up and down, ∓105% (power3.inOut), each cut edge gold
 *   .40–.80  the two salts rise 18% into place (0.94 → 1), their gold standing lines drawing in
 *   .55–.85  the seam shrinks to a point, the top rule draws out from it; the headline rises
 *            letter by letter from its masks
 *   .80–1    the plates' details fade up 12px, a short stagger; the pin releases at 1
 *
 * The products behind are laid out (fixed sizes) and their models warmed up unseen while the
 * pans play (ProductPlate `arm`): nothing here changes layout. Transform, opacity and
 * clip-path only. Reduced motion: no split; the layer crossfades in (0.4 s) when it arrives.
 */
export function LakeMotion() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const lake = ref.current?.closest<HTMLElement>('[data-lake]');
    const hero = lake?.closest<HTMLElement>('[data-hero]');
    if (!lake || !hero) return;
    const stage = lake.parentElement!;

    // reduced motion (or no pin): a short crossfade as it comes into view
    if (!document.documentElement.classList.contains('motion')) {
      lake.dataset.wait = '';
      const io = new IntersectionObserver(
        ([e]) => {
          if (!e?.isIntersecting) return;
          delete lake.dataset.wait;
          io.disconnect();
        },
        { threshold: 0.15 },
      );
      io.observe(lake);
      return () => io.disconnect();
    }

    // what of the layer hangs below the pinned screen: the next section starts after it
    const over = () =>
      document.documentElement.style.setProperty(
        '--lake-over',
        `${Math.max(0, lake.offsetHeight - stage.clientHeight)}px`,
      );
    const ro = new ResizeObserver(over);
    ro.observe(lake);
    ro.observe(stage);

    let kill: (() => void) | undefined;
    let cancelled = false;
    void loadGsap().then(({ gsap }) => {
      if (cancelled) return;
      const pans = stage.querySelector<HTMLElement>('[data-pans]');
      const seam = stage.querySelector<HTMLElement>('[data-lake-seam]');
      const rule = lake.querySelector<HTMLElement>('[data-lake-rule]');
      if (!pans || !seam || !rule) return;
      const line = pans.querySelector<HTMLElement>('[data-pans-line]');
      const chars = lake.querySelectorAll<HTMLElement>('[data-lake-ch]');
      const media = lake.querySelectorAll<HTMLElement>('[data-plate-media]');
      const grounds = lake.querySelectorAll<HTMLElement>('[data-plate-ground]');
      const details = lake.querySelectorAll<HTMLElement>(
        '[data-plate-detail], [data-plate-body] > *',
      );

      // the lower half: a box after the field (the original is the upper half), filled with a
      // copy of the finished field as the split begins and emptied when it closes again
      const right = document.createElement('div');
      right.dataset.pansHalf = 'r';
      right.setAttribute('aria-hidden', 'true');
      pans.after(right);
      const edge = (side: 'l' | 'r') => {
        const e = document.createElement('span');
        e.dataset.lakeEdge = side;
        return e;
      };
      let open = false;
      const split = (on: boolean) => {
        if (on === open) return;
        open = on;
        if (on) {
          const copy = pans.cloneNode(true) as HTMLElement;
          copy.removeAttribute('data-pans');
          copy.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
          copy.querySelector('[data-pans-line]')?.remove();
          copy.querySelector('[data-lake-edge]')?.remove();
          right.replaceChildren(copy, edge('r'));
          pans.dataset.pansHalf = 'l';
          pans.append(edge('l'));
        } else {
          right.replaceChildren();
          delete pans.dataset.pansHalf;
          pans.querySelector('[data-lake-edge]')?.remove();
        }
      };
      let shown: boolean | null = null;
      const show = (on: boolean) => {
        if (on === shown) return;
        shown = on;
        lake.style.visibility = on ? 'visible' : 'hidden';
      };
      show(false);

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: hero,
          start: () => beforeEnd(openVh()),
          end: 'bottom bottom',
          scrub: 0.4,
          invalidateOnRefresh: true,
        },
        onUpdate: () => {
          const p = tl.progress();
          lake.dataset.progress = p.toFixed(4);
          show(p > 0);
          split(p > 0.2);
        },
      });
      // 1: the line lifts out of its mask
      if (line)
        tl.fromTo(line, { '--lift': 0 }, { '--lift': 1, duration: 0.15, ease: 'power2.in' }, 0);
      // 2: the seam draws across the middle
      tl.set(seam, { transformOrigin: '0% 50%' }, 0);
      tl.fromTo(seam, { scaleX: 0 }, { scaleX: 1, duration: 0.2, ease: 'power2.inOut' }, 0.1);
      // 3: the split
      tl.fromTo(
        pans,
        { yPercent: 0 },
        { yPercent: -105, duration: 0.4, ease: 'power3.inOut' },
        0.25,
      );
      tl.fromTo(
        right,
        { yPercent: 0 },
        { yPercent: 105, duration: 0.4, ease: 'power3.inOut' },
        0.25,
      );
      // the halves, gone off the screen, stay gone (the lower one would hang below the pin)
      tl.set([pans, right], { opacity: 1 }, 0);
      tl.set([pans, right], { opacity: 0 }, 0.66);
      // 4: the salts rise out of the lake, their standing lines drawing in under them
      media.forEach((m, i) =>
        tl.fromTo(
          m,
          { yPercent: 18, scale: 0.94 },
          { yPercent: 0, scale: 1, duration: 0.36, ease: 'power2.out' },
          0.4 + i * 0.04,
        ),
      );
      tl.fromTo(grounds, { scaleX: 0 }, { scaleX: 1, duration: 0.2, ease: 'power2.out' }, 0.6);
      // 5: the seam lays down into the rule; the headline rises letter by letter
      tl.set(seam, { transformOrigin: '50% 50%' }, 0.55);
      tl.to(seam, { scaleX: 0, duration: 0.12, ease: 'power2.in' }, 0.55);
      tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.18, ease: 'power2.out' }, 0.67);
      const per = 0.18 / Math.max(1, chars.length);
      chars.forEach((c, i) =>
        tl.fromTo(
          c,
          { yPercent: 115 },
          { yPercent: 0, duration: 0.12, ease: 'power2.out' },
          0.55 + i * per,
        ),
      );
      // 6: the details
      const gap = 0.08 / Math.max(1, details.length);
      details.forEach((d, i) =>
        tl.fromTo(
          d,
          { y: 12, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.12, ease: 'power2.out' },
          0.8 + i * gap,
        ),
      );
      tl.set({}, {}, 1); // the range ends exactly at the pin's end

      kill = () => {
        tl.scrollTrigger?.kill();
        tl.kill();
        split(false);
        right.remove();
        gsap.set(pans, { clearProps: 'transform,opacity' });
        if (line) gsap.set(line, { clearProps: '--lift' });
        gsap.set([seam, rule, media, grounds, chars, details], { clearProps: 'all' });
        lake.style.visibility = '';
      };
    });

    return () => {
      cancelled = true;
      ro.disconnect();
      kill?.();
    };
  }, []);
  return <span ref={ref} hidden />;
}
