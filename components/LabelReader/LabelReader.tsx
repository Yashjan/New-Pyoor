'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { asset } from '@/lib/basePath';
import { coveredStore } from '@/lib/motion/covered';
import { loadGsap } from '@/lib/motion/gsap';
import { lenisStore } from '@/lib/motion/lenis';
import { heroShare } from '@/lib/three/heroShare';
import type { Reader } from './readerScene';
import { LABEL } from './labelData';
import styles from './LabelReader.module.css';

const LABEL_IMG = (w: number) => asset(`/textures/label-herbal-black-salt-${w}.webp`);
const MAX_ZOOM = 4;
const noop = () => () => {};
const yes = () => true;
const no = () => false;

/**
 * "Read the label": beside the hero jar. Opens a reader in which the jar turns its label to
 * you, the label unrolls off the cylinder into a flat sheet (zoom up to 4×, pan, double-tap),
 * and the label's content stands beside it as text (labelData.ts). A GSAP timeline, not
 * scroll-driven, and reversible: Close or Esc rolls it back onto the jar.
 *
 * While open: Lenis stopped and <html> overflow hidden only, the scroll position restored on
 * close; the hero's 3D and its sequence pause (lib/motion/covered.ts). No ScrollTrigger is
 * refreshed or touched. Reduced motion, or no 3D: a 0.2 s crossfade to the flat label.
 */
export function LabelReader() {
  const button = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);
  // the dialog is portalled into <body>: client only (the server renders the button)
  const mounted = useSyncExternalStore(noop, yes, no);
  const [flat, setFlat] = useState(false);
  const ctl = useRef<ReturnType<typeof createController> | null>(null);

  useEffect(() => {
    if (!mounted || !root.current) return;
    const c = createController(root.current, {
      button: () => button.current,
      setFlat,
    });
    ctl.current = c;
    return () => c.destroy();
  }, [mounted]);

  const prefetch = () => void import('./readerScene');

  return (
    <>
      <button
        ref={button}
        type="button"
        className={styles.cta}
        data-label-cta
        aria-haspopup="dialog"
        aria-controls="label-reader"
        onPointerEnter={prefetch}
        onFocus={prefetch}
        onClick={() => void ctl.current?.open()}
      >
        Read the label
      </button>
      {mounted &&
        createPortal(
          <div
            ref={root}
            id="label-reader"
            className={styles.reader}
            role="dialog"
            aria-modal="true"
            aria-labelledby="label-reader-title"
            tabIndex={-1}
            data-state="closed"
            data-flat={flat || undefined}
          >
            <div className={styles.backdrop} data-backdrop />
            <canvas className={styles.canvas} data-canvas aria-hidden="true" />
            <div className={styles.layout}>
              <div className={styles.area} data-area role="img" aria-label={LABEL.summary}>
                {flat && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className={styles.flatImg}
                    data-flat-img
                    src={LABEL_IMG(4096)}
                    srcSet={`${LABEL_IMG(4096)} 4096w, ${LABEL_IMG(8192)} 8192w`}
                    sizes="(min-width: 861px) 62vw, 92vw"
                    alt=""
                    draggable={false}
                  />
                )}
              </div>
              <LabelText />
            </div>
            <p className={styles.hint} data-fade aria-hidden="true">
              Scroll or pinch to zoom · drag to move · double-tap
            </p>
            <button type="button" className={styles.close} data-close data-fade>
              Close
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}

function LabelText() {
  const L = LABEL;
  return (
    <section className={styles.panel} data-panel tabIndex={0} aria-label="Label text">
      <p className={styles.eyebrow}>{L.brand} · The label</p>
      <h2 id="label-reader-title" className={styles.title}>
        {L.name} <span lang="hi">({L.nameHindi})</span>
      </h2>
      <p className={styles.line}>{L.line}</p>

      <h3>Ingredients</h3>
      <p>{L.ingredients}</p>

      <h3>{L.nutrition.title}</h3>
      <table className={styles.table}>
        <caption>{L.nutrition.note}</caption>
        <tbody>
          {L.nutrition.rows.map(([k, v]) => (
            <tr key={k}>
              <th scope="row">{k}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className={styles.facts}>
        <div>
          <dt>Net weight</dt>
          <dd>{L.netWeight}</dd>
        </div>
        <div>
          <dt>Use</dt>
          <dd>{L.use}</dd>
        </div>
        <div>
          <dt>Storage</dt>
          <dd>{L.storage}</dd>
        </div>
        <div>
          <dt>FSSAI Lic. No.</dt>
          <dd>{L.fssai}</dd>
        </div>
        {L.perJar.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <h3>{L.packer.title}</h3>
      <address className={styles.address}>
        {L.packer.name}
        <br />
        {L.packer.address.map((a) => (
          <span key={a}>
            {a}
            <br />
          </span>
        ))}
        {L.packer.phone} · {L.packer.email}
      </address>
      <p className={styles.origin}>{L.origin}</p>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------ */

type Opts = { button: () => HTMLButtonElement | null; setFlat: (v: boolean) => void };

function createController(el: HTMLElement, opts: Opts) {
  const html = document.documentElement;
  const canvas = el.querySelector<HTMLCanvasElement>('[data-canvas]')!;
  const area = el.querySelector<HTMLElement>('[data-area]')!;
  const backdrop = el.querySelector<HTMLElement>('[data-backdrop]')!;
  const panel = el.querySelector<HTMLElement>('[data-panel]')!;
  const fades = el.querySelectorAll<HTMLElement>('[data-fade]');
  const closeBtn = el.querySelector<HTMLButtonElement>('[data-close]')!;

  let state: 'closed' | 'opening' | 'open' | 'closing' = 'closed';
  let reader: Reader | null = null;
  let flat = false;
  let tl: { reverse: () => void; kill: () => void; timeScale: (n: number) => void } | null = null;
  let saved = 0;
  let timer = 0;
  let tick: (() => void) | null = null;
  let gsapRef: Awaited<ReturnType<typeof loadGsap>>['gsap'] | null = null;

  /* ---------- the page lock: Lenis and <html> overflow, nothing else ---------- */
  const lock = () => {
    saved = window.scrollY;
    lenisStore.get()?.stop();
    html.style.overflow = 'hidden';
    coveredStore.set(true); // the hero's 3D and its sequence pause
    for (const n of [document.getElementById('main'), document.querySelector('footer')])
      n?.setAttribute('inert', '');
    document.querySelector('[data-site-header]')?.setAttribute('inert', '');
  };
  const unlock = () => {
    for (const n of [
      document.getElementById('main'),
      document.querySelector('footer'),
      document.querySelector('[data-site-header]'),
    ])
      n?.removeAttribute('inert');
    html.style.overflow = '';
    if (Math.abs(window.scrollY - saved) > 0.5) window.scrollTo(0, saved);
    coveredStore.set(false);
    lenisStore.get()?.start();
  };

  /* ---------- zoom and pan (one target for both the 3D sheet and the flat image) ---------- */
  const view = { zoom: 1, x: 0, y: 0 };
  const shown = { zoom: 1, x: 0, y: 0 };
  let areaRect = area.getBoundingClientRect();
  const sheetSize = () => {
    if (reader) return reader.sheetPx();
    const aspect = 4096 / 1052;
    const w = Math.min(areaRect.width, areaRect.height * aspect);
    return { w, h: w / aspect };
  };
  const clampPan = () => {
    const { w, h } = sheetSize();
    const mx = Math.max(0, (w * view.zoom - areaRect.width) / 2);
    const my = Math.max(0, (h * view.zoom - areaRect.height) / 2);
    view.x = Math.max(-mx, Math.min(mx, view.x));
    view.y = Math.max(-my, Math.min(my, view.y));
  };
  /** zoom to z around a client point (the point under it stays put) */
  const zoomAt = (z: number, cx: number, cy: number) => {
    const nz = Math.max(1, Math.min(MAX_ZOOM, z));
    const px = cx - (areaRect.left + areaRect.width / 2);
    const py = cy - (areaRect.top + areaRect.height / 2);
    const qx = (px - view.x) / view.zoom;
    const qy = (py - view.y) / view.zoom;
    view.zoom = nz;
    view.x = px - qx * nz;
    view.y = py - qy * nz;
    clampPan();
  };
  const pushView = () => {
    if (reader) Object.assign(reader.view, view);
  };

  const onWheel = (e: WheelEvent) => {
    if (state !== 'open') return;
    e.preventDefault();
    zoomAt(view.zoom * Math.exp(-e.deltaY * 0.002), e.clientX, e.clientY);
    pushView();
  };
  const pts = new Map<number, { x: number; y: number }>();
  let pinch: { d: number; z: number } | null = null;
  let lastTap = 0;
  const onDown = (e: PointerEvent) => {
    if (state !== 'open') return;
    if (e.pointerType !== 'mouse' && pts.size === 0) {
      const now = performance.now();
      if (now - lastTap < 300) toggleZoom(e.clientX, e.clientY);
      lastTap = now;
    }
    try {
      area.setPointerCapture(e.pointerId);
    } catch {
      // (a synthetic or already-released pointer)
    }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), z: view.zoom };
    }
  };
  const onMove = (e: PointerEvent) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pts.size >= 2 && pinch) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      zoomAt(pinch.z * (d / pinch.d), (a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
    } else {
      view.x += dx;
      view.y += dy;
      clampPan();
    }
    pushView();
  };
  const onUp = (e: PointerEvent) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
  };
  let toggled = 0;
  const toggleZoom = (x: number, y: number) => {
    toggled = performance.now();
    if (view.zoom > 1.05) {
      view.zoom = 1;
      view.x = view.y = 0;
    } else zoomAt(2.5, x, y);
    pushView();
  };
  // (a touch double-tap also fires dblclick: it was handled on pointerdown already)
  const onDbl = (e: MouseEvent) =>
    state === 'open' && performance.now() - toggled > 500 && toggleZoom(e.clientX, e.clientY);

  /* ---------- keys: Esc closes, Tab stays inside ---------- */
  const onKey = (e: KeyboardEvent) => {
    if (state === 'closed') return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const list = [...el.querySelectorAll<HTMLElement>('button, [tabindex="0"]')];
    const i = list.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey
      ? list[(i - 1 + list.length) % list.length]
      : list[(i + 1) % list.length];
    e.preventDefault();
    next?.focus();
  };
  const onResize = () => {
    areaRect = area.getBoundingClientRect();
    if (reader) {
      reader.setArea(areaRect);
      const hero = heroShare.get()?.canvas.getBoundingClientRect();
      if (hero) placeCanvas(hero);
    }
    clampPan();
    pushView();
  };
  const placeCanvas = (r: DOMRect) => {
    Object.assign(canvas.style, {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
    reader?.setViewport(r);
  };

  const flatFrame = () => {
    // the flat image follows the same eased view (transform only)
    const img = el.querySelector<HTMLElement>('[data-flat-img]');
    shown.zoom += (view.zoom - shown.zoom) * 0.2;
    shown.x += (view.x - shown.x) * 0.2;
    shown.y += (view.y - shown.y) * 0.2;
    if (img)
      img.style.transform = `translate3d(${shown.x.toFixed(2)}px, ${shown.y.toFixed(2)}px, 0) scale(${shown.zoom.toFixed(4)})`;
  };

  const listen = (on: boolean) => {
    const m = on ? 'addEventListener' : 'removeEventListener';
    document[m]('keydown', onKey as EventListener);
    window[m]('resize', onResize);
    area[m]('wheel', onWheel as EventListener, { passive: false } as AddEventListenerOptions);
    area[m]('pointerdown', onDown as EventListener);
    area[m]('pointermove', onMove as EventListener);
    area[m]('pointerup', onUp as EventListener);
    area[m]('pointercancel', onUp as EventListener);
    area[m]('dblclick', onDbl as EventListener);
  };
  closeBtn.addEventListener('click', () => close());

  const finish = () => {
    state = 'closed';
    el.dataset.state = 'closed';
    listen(false);
    if (tick && gsapRef) gsapRef.ticker.remove(tick);
    tick = null;
    reader?.dispose();
    reader = null;
    unlock();
    opts.setFlat(false);
    flat = false;
    view.zoom = shown.zoom = 1;
    view.x = view.y = shown.x = shown.y = 0;
    opts.button()?.focus({ preventScroll: true });
  };

  async function open() {
    if (state !== 'closed') return;
    state = 'opening';
    const share = heroShare.get();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    flat = reduce || !share;
    lock();
    listen(true);
    const { gsap } = await loadGsap();
    gsapRef = gsap;
    if (flat) {
      opts.setFlat(true);
      el.dataset.state = 'open';
      // (again after React has rendered the flat view)
      el.focus({ preventScroll: true });
      requestAnimationFrame(() => el.focus({ preventScroll: true }));
      areaRect = area.getBoundingClientRect();
      tick = flatFrame;
      gsap.ticker.add(tick);
      timer = window.setTimeout(() => state === 'opening' && (state = 'open'), 200);
      return;
    }
    const hd = window.matchMedia('(min-width: 861px)').matches && !share!.weak;
    try {
      const { createReader } = await import('./readerScene');
      const made = await createReader(canvas, share!, hd);
      if (state !== 'opening') {
        // closed while it was being built
        made.dispose();
        return;
      }
      reader = made;
    } catch (err) {
      console.error('Label reader failed to start', err);
      state = 'closed';
      listen(false);
      unlock();
      return;
    }
    el.dataset.state = 'open';
    el.focus({ preventScroll: true });
    areaRect = area.getBoundingClientRect();
    reader.setArea(areaRect);
    placeCanvas(share!.canvas.getBoundingClientRect());
    reader.render();
    const r = reader;
    tick = () => r.render();
    gsap.ticker.add(tick);

    const S = reader.state;
    const t = gsap
      .timeline({
        onComplete: () => {
          if (state === 'opening') state = 'open';
        },
        onReverseComplete: finish,
      })
      .fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out' }, 0)
      .to(S, { face: 1, duration: 0.5, ease: 'power2.inOut' }, 0)
      .to(S, { unroll: 1, duration: 0.7, ease: 'power2.inOut' }, 0.5)
      .to(S, { fit: 1, duration: 0.3, ease: 'power2.out' }, 1.2)
      .fromTo(
        panel,
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' },
        1.1,
      )
      .fromTo(fades, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 1.2);
    tl = t;
  }

  function close() {
    if (state === 'closed' || state === 'closing') return;
    state = 'closing';
    view.zoom = 1;
    view.x = view.y = 0;
    pushView();
    if (flat || !tl) {
      el.dataset.state = 'closing';
      window.clearTimeout(timer);
      timer = window.setTimeout(finish, 200);
      return;
    }
    tl.timeScale(1.25);
    tl.reverse();
  }

  return {
    open,
    destroy() {
      tl?.kill();
      window.clearTimeout(timer);
      if (state !== 'closed') finish();
    },
  };
}
