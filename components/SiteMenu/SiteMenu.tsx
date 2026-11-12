'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react';
import { asset } from '@/lib/basePath';
import { coveredStore } from '@/lib/motion/covered';
import { loadGsap } from '@/lib/motion/gsap';
import { lenisStore, scrollToHash } from '@/lib/motion/lenis';
import { sound } from '@/lib/sound/sound';
import { MINI_JAR } from './miniJar';
import styles from './SiteMenu.module.css';

/** Each link's engraving and its time of day (the wash and the sun follow it). */
const LINKS = [
  { href: '/#shop', label: 'Shop', plate: 'jar', light: 'dusk' },
  { href: '/#roots', label: 'Our roots', plate: 'roots', light: 'dawn' },
  { href: '/#journey', label: 'The journey', plate: 'harvest', light: 'midday' },
  { href: '/#recipes', label: 'Recipes', plate: 'bowl', light: 'afternoon' },
] as const;
const PLATES = ['jar', 'roots', 'harvest', 'bowl'] as const;
type Plate = (typeof PLATES)[number];

const PRODUCTS = [
  { href: '/product/herbal-black-salt', name: 'Black Salt' },
  { href: '/product/natural-lake-salt', name: 'Lake Salt' },
] as const;

const MARQUEE = ['सांभर', 'Sambhar Lake', 'Rajasthan'];

/** The four plates (public/engravings/menu-*.svg), fetched on the first open, then kept. */
let plates: Promise<Record<Plate, string>> | null = null;
const loadPlates = () =>
  (plates ??= Promise.all(
    PLATES.map((p) =>
      fetch(asset(`/engravings/menu-${p}.svg`)).then((r) => (r.ok ? r.text() : '')),
    ),
  ).then(
    (list) => Object.fromEntries(PLATES.map((p, i) => [p, list[i]!])) as Record<Plate, string>,
  ));

export type SiteMenuHandle = {
  /** Close the menu, then run `fn` (once the page is unlocked and back where it was). */
  closeThen: (fn: () => void) => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  button: RefObject<HTMLButtonElement | null>;
};

/**
 * "The horizon opens": the site menu. A gold horizon draws across the screen, the ivory panel
 * unfolds from it, then the links rise out of their masks; each link shows its own engraving
 * (drawn in, hatching last), its time of day (a warm wash, a sun gliding low or high) and the
 * same hairline. Closing is the reverse.
 *
 * While open: Lenis stopped and <html> overflow hidden, nothing else (no ScrollTrigger refresh,
 * no trigger touched); the scroll position is restored before Lenis restarts. Once the panel
 * covers the page, the homepage's 3D and ambient loops pause (lib/motion/covered.ts).
 * Only transform, opacity, clip-path and stroke-dashoffset animate.
 */
export const SiteMenu = forwardRef<SiteMenuHandle, Props>(function SiteMenu(
  { open, onClose, button },
  ref,
) {
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [active, setActive] = useState<number | null>(null);
  const [tapped, setTapped] = useState<number | null>(null);
  const ctl = useRef<ReturnType<typeof createMenu> | null>(null);

  useEffect(() => {
    const c = createMenu(root.current!, {
      button: () => button.current,
      onEscape: onClose, // (the header's setOpen(false): the same on every render)
      onClosed: () => {
        setActive(null);
        setTapped(null);
      },
    });
    ctl.current = c;
    return () => c.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (open) ctl.current?.open();
    else ctl.current?.close();
  }, [open]);

  useEffect(() => {
    ctl.current?.show(active === null ? 'jar' : LINKS[active]!.plate);
  }, [active]);

  useImperativeHandle(ref, () => ({
    closeThen(fn) {
      ctl.current?.after(fn);
      onClose();
    },
  }));

  const pointer = useRef<string>('mouse');
  const go = (e: React.MouseEvent<HTMLAnchorElement>, href: string, i?: number) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    const url = new URL(e.currentTarget.href);
    const touch = pointer.current === 'touch';
    if (i !== undefined && touch) {
      setActive(i);
      setTapped(i);
    }
    const leave = () => {
      if (url.pathname === window.location.pathname && url.hash) {
        // same page: back where we were, then the anchor (through Lenis)
        ctl.current?.after(() => {
          if (scrollToHash(url.hash)) history.replaceState(null, '', url.hash);
        });
      } else {
        ctl.current?.leaving();
        router.push(href);
      }
      onClose();
    };
    if (touch) window.setTimeout(leave, 150);
    else leave();
  };

  const light = active === null ? 'default' : LINKS[active]!.light;

  // the root's own background (behind the reserved scrollbar gutter, which the panel can't
  // cover) takes the same light while the menu is open
  useEffect(() => {
    document.documentElement.setAttribute('data-menu-light', light);
  }, [light]);

  return (
    <div
      ref={root}
      id="site-menu"
      className={styles.menu}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      tabIndex={-1}
      data-site-menu
      data-state="closed"
      data-light={light}
      onPointerDownCapture={(e) => (pointer.current = e.pointerType)}
    >
      <div className={styles.sheet} data-sheet>
        <div className={styles.content} data-content>
          <div className={styles.preview} aria-hidden="true" data-fade>
            <div className={styles.sun} data-sun />
            <div className={styles.drift} data-drift>
              {PLATES.map((p) => (
                <div key={p} className={styles.plate} data-plate={p} />
              ))}
            </div>
          </div>

          <div className={styles.main}>
            <nav aria-label="Menu">
              <ul
                className={styles.links}
                data-has-active={active !== null || undefined}
                onPointerLeave={(e) => e.pointerType !== 'touch' && setActive(null)}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActive(null);
                }}
              >
                {LINKS.map((l, i) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className={styles.link}
                      data-link
                      data-active={active === i || undefined}
                      data-tap={tapped === i || undefined}
                      onPointerEnter={(e) => e.pointerType !== 'touch' && setActive(i)}
                      onFocus={() => setActive(i)}
                      onClick={(e) => go(e, l.href, i)}
                    >
                      <span className={styles.num} data-num aria-hidden="true">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className={styles.name}>
                        <span className={styles.mask}>
                          <span className={styles.roll}>
                            <span className={styles.word}>
                              {[...l.label].map((c, k) => (
                                <span key={k} className={styles.ch} data-ch>
                                  {c}
                                </span>
                              ))}
                            </span>
                            <span className={styles.dup} aria-hidden="true">
                              {l.label}
                            </span>
                          </span>
                        </span>
                        <i className={styles.hair} aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <ul className={styles.products} aria-label="Products">
              {PRODUCTS.map((p) => (
                <li key={p.href} data-fade>
                  <Link href={p.href} className={styles.product} onClick={(e) => go(e, p.href)}>
                    <MiniJar />
                    <span className={styles.pname}>{p.name}</span>
                    <span className={styles.price}>[PRICE]</span>
                    <span className={styles.arrow} aria-hidden="true">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.band} data-fade>
            <div className={styles.marquee} aria-hidden="true">
              <div className={styles.track}>
                {[0, 1].map((copy) => (
                  <span key={copy} className={styles.run}>
                    {Array.from({ length: 4 }, (_, r) =>
                      MARQUEE.map((t, k) => (
                        <span
                          key={`${r}-${k}`}
                          className={k ? undefined : styles.hi}
                          lang={k ? undefined : 'hi'}
                        >
                          {t}
                          <span className={styles.sep}>·</span>
                        </span>
                      )),
                    )}
                  </span>
                ))}
              </div>
            </div>
            <SoundSwitch />
          </div>
        </div>
        {/* over the content: the light falls on everything, the engravings' paper included */}
        <div className={styles.wash} aria-hidden="true" />
      </div>
      <i className={styles.line} data-line aria-hidden="true" />
    </div>
  );
});

function MiniJar() {
  return (
    <svg
      className={styles.mini}
      viewBox={MINI_JAR.box.join(' ')}
      fill="none"
      stroke="#a8823f"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <g dangerouslySetInnerHTML={{ __html: MINI_JAR.body }} />
      <g className={styles.cap} dangerouslySetInnerHTML={{ __html: MINI_JAR.cap }} />
    </svg>
  );
}

/** "Sound": the site sound's own state (lib/sound), an Off/On pill and a small waveform. */
function SoundSwitch() {
  const on = useSyncExternalStore(sound.subscribe, sound.isOn, () => false);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`${styles.sound} ${on ? styles.soundOn : ''}`}
      onClick={() => sound.set(!on)}
    >
      Sound
      <span className={styles.pill} aria-hidden="true">
        <span>Off</span>
        <span>On</span>
      </span>
      <span className={styles.wave} aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------------------------------ */

type Opts = {
  button: () => HTMLButtonElement | null;
  onEscape: () => void;
  onClosed: () => void;
};

/** The menu's choreography and its page lock, outside React (no re-render mid-animation). */
function createMenu(el: HTMLElement, opts: Opts) {
  const html = document.documentElement;
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const sheet = el.querySelector<HTMLElement>('[data-sheet]')!;
  const line = el.querySelector<HTMLElement>('[data-line]')!;
  const content = el.querySelector<HTMLElement>('[data-content]')!;
  const drift = el.querySelector<HTMLElement>('[data-drift]')!;
  const holders = new Map(
    [...el.querySelectorAll<HTMLElement>('[data-plate]')].map((h) => [h.dataset.plate!, h]),
  );

  type Tl = { kill: () => void };
  let tl: Tl | null = null;
  let state: 'closed' | 'opening' | 'open' | 'closing' = 'closed';
  let saved = 0;
  let locked = false;
  let restore = true;
  let queued: (() => void) | null = null;
  let timer = 0;
  let destroyed = false;

  /* ---------- the page lock: Lenis and <html> overflow, nothing else ---------- */
  const inert = (on: boolean) =>
    [document.getElementById('main'), document.querySelector('footer')].forEach((n) =>
      n?.toggleAttribute('inert', on),
    );
  const lock = () => {
    if (locked) return;
    locked = true;
    restore = true;
    saved = window.scrollY;
    lenisStore.get()?.stop();
    html.style.overflow = 'hidden';
    html.setAttribute('data-menu-open', '');
    inert(true);
  };
  const unlock = () => {
    if (!locked) return;
    locked = false;
    inert(false);
    html.removeAttribute('data-menu-open');
    html.style.overflow = '';
    if (restore && Math.abs(window.scrollY - saved) > 0.5) window.scrollTo(0, saved);
    lenisStore.get()?.start();
  };

  /* ---------- the previews ---------- */
  let shown: string | null = null;
  let loaded = false;
  const on = styles.on!;
  const draw = styles.draw!;
  const show = (name: string) => {
    if (name === shown) return;
    if (shown) holders.get(shown)?.classList.remove(on);
    shown = name;
    const h = holders.get(name);
    if (!h || !loaded || state === 'closed' || state === 'closing') return;
    h.classList.remove(draw);
    h.classList.add(on);
    // two frames: the undrawn state is painted once before the strokes draw in
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (shown === name) h.classList.add(draw);
      }),
    );
  };
  const resetPlates = () => {
    holders.forEach((h) => h.classList.remove(on, draw));
    const want = shown;
    shown = null;
    return want;
  };
  const load = () =>
    loadPlates().then((svgs) => {
      if (destroyed || loaded) return;
      for (const [name, h] of holders) {
        h.innerHTML = svgs[name as Plate] ?? '';
        const paths = [...h.querySelectorAll<SVGPathElement>('path:not(.p)')];
        // each plate draws in the order it was cut: outlines first, hatching last (0.8 s)
        const ts = [...new Set(paths.map((p) => Number(p.dataset.t ?? 0)))].sort((a, b) => a - b);
        const n = Math.max(1, ts.length - 1);
        for (const p of paths) {
          p.setAttribute('pathLength', '1');
          p.style.transitionDelay = `${((ts.indexOf(Number(p.dataset.t ?? 0)) / n) * 0.4).toFixed(3)}s`;
        }
      }
      loaded = true;
      if (state === 'open' || state === 'opening') {
        const want = shown ?? 'jar';
        shown = null;
        show(want);
      }
    });

  /* ---------- the drift: the preview follows the cursor (±8px, lerp 0.08) ---------- */
  let vw = window.innerWidth;
  let vh = window.innerHeight;
  const target: [number, number] = [0, 0];
  const cur: [number, number] = [0, 0];
  let raf = 0;
  const step = () => {
    cur[0] += (target[0] - cur[0]) * 0.08;
    cur[1] += (target[1] - cur[1]) * 0.08;
    drift.style.transform = `translate3d(${cur[0].toFixed(2)}px, ${cur[1].toFixed(2)}px, 0)`;
    raf =
      Math.abs(target[0] - cur[0]) + Math.abs(target[1] - cur[1]) > 0.02
        ? requestAnimationFrame(step)
        : 0;
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    target[0] = (e.clientX / vw - 0.5) * 16;
    target[1] = (e.clientY / vh - 0.5) * 16;
    if (!raf) raf = requestAnimationFrame(step);
  };
  const onResize = () => {
    vw = window.innerWidth;
    vh = window.innerHeight;
  };

  /* ---------- keys: Esc closes, Tab stays inside (the button and the panel) ---------- */
  const onKey = (e: KeyboardEvent) => {
    if (state === 'closed' || state === 'closing') return;
    if (e.key === 'Escape') {
      e.preventDefault();
      opts.onEscape();
      return;
    }
    if (e.key !== 'Tab') return;
    const btn = opts.button();
    const list = [
      ...(btn ? [btn] : []),
      ...el.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    ];
    if (!list.length) return;
    const i = list.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey
      ? i <= 0
        ? list[list.length - 1]
        : list[i - 1]
      : i === -1 || i === list.length - 1
        ? list[0]
        : list[i + 1];
    e.preventDefault();
    next!.focus();
  };

  const listen = (add: boolean) => {
    const m = add ? 'addEventListener' : 'removeEventListener';
    document[m]('keydown', onKey as EventListener);
    window[m]('resize', onResize);
    if (!add || (fine() && !reduce()))
      window[m]('pointermove', onMove as EventListener, { passive: true });
  };

  const finish = () => {
    state = 'closed';
    el.dataset.state = 'closed';
    coveredStore.set(false);
    cancelAnimationFrame(raf);
    raf = 0;
    resetPlates();
    listen(false);
    unlock();
    opts.onClosed();
    const fn = queued;
    queued = null;
    fn?.();
  };

  return {
    show,
    after(fn: () => void) {
      queued = fn;
    },
    /** navigating to another page: no scroll restore (the new page starts where it starts) */
    leaving() {
      restore = false;
    },
    async open() {
      if (state === 'open' || state === 'opening') return;
      const wasClosed = state === 'closed';
      state = 'opening';
      window.clearTimeout(timer);
      queued = null;
      lock();
      if (wasClosed) {
        listen(true);
        onResize();
      }
      el.dataset.state = 'open';
      el.focus({ preventScroll: true });
      void load();
      const want = shown ?? 'jar';
      shown = null;

      if (reduce()) {
        // a 0.2 s fade (CSS), everything else in its final state
        tl?.kill();
        show(want);
        timer = window.setTimeout(() => {
          if (state !== 'opening') return;
          state = 'open';
          coveredStore.set(true);
        }, 200);
        return;
      }

      const { gsap } = await loadGsap();
      if (state !== 'opening' || destroyed) return;
      tl?.kill();
      const links = [...el.querySelectorAll<HTMLElement>('[data-link]')];
      links.forEach((l) => (l.querySelector('[data-num]')!.textContent = '00'));
      const fades = el.querySelectorAll<HTMLElement>('[data-fade]');
      const t = gsap.timeline({
        onComplete: () => {
          if (state === 'opening') state = 'open';
        },
      });
      t.to(line, { scaleX: 1, opacity: 1, duration: 0.35, ease: 'expo.out' }, 0)
        .to(sheet, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.5, ease: 'expo.out' }, 0.22)
        .to(line, { opacity: 0, duration: 0.25, ease: 'power1.out' }, 0.5)
        .call(() => coveredStore.set(true), [], 0.72)
        .set(content, { autoAlpha: 1 }, 0.45)
        .call(() => show(want), [], 0.55);
      links.forEach((link, i) => {
        const at = 0.5 + i * 0.08;
        t.fromTo(
          link.querySelectorAll('[data-ch]'),
          { yPercent: 110 },
          { yPercent: 0, duration: 0.8, ease: 'power3.out', stagger: 0.03 },
          at,
        );
        const num = link.querySelector<HTMLElement>('[data-num]')!;
        const o = { v: 0 };
        t.to(
          o,
          {
            v: i + 1,
            duration: 0.5,
            ease: 'power1.out',
            onUpdate: () => {
              num.textContent = String(Math.round(o.v)).padStart(2, '0');
            },
          },
          at,
        );
      });
      t.fromTo(
        fades,
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.06 },
        0.72,
      );
      tl = t;
    },
    async close() {
      if (state === 'closed' || state === 'closing') return;
      state = 'closing';
      coveredStore.set(false);
      opts.button()?.focus({ preventScroll: true });
      if (reduce()) {
        tl?.kill();
        el.dataset.state = 'closing';
        window.clearTimeout(timer);
        timer = window.setTimeout(() => state === 'closing' && finish(), 200);
        return;
      }
      const { gsap } = await loadGsap();
      if (state !== 'closing' || destroyed) return;
      tl?.kill();
      tl = gsap
        .timeline({ onComplete: finish })
        .to(content, { autoAlpha: 0, duration: 0.18, ease: 'power1.in' }, 0)
        .to(line, { scaleX: 1, opacity: 1, duration: 0.12, ease: 'none' }, 0.1)
        .to(sheet, { clipPath: 'inset(50% 0% 50% 0%)', duration: 0.3, ease: 'expo.in' }, 0.16)
        .to(line, { scaleX: 0, duration: 0.2, ease: 'power2.in' }, 0.44)
        .set(line, { opacity: 0 });
    },
    destroy() {
      destroyed = true;
      tl?.kill();
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      listen(false);
      coveredStore.set(false);
      unlock();
    },
  };
}
