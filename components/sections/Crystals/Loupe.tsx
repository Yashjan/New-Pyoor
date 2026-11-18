'use client';

import { useEffect, useRef } from 'react';

const MAG = 2.5;
const ASPECT = 8 / 3; // the rendered field (tools/crystals/render.mjs)

/**
 * The loupe over the salt field (Crystals.tsx). Desktop: it follows the cursor with a soft lag
 * (lerp 0.12) and glides back to the centre when the cursor leaves; the arrow keys move it.
 * Phones: it stays centred and a horizontal drag pans the field under it (vertical drags
 * scroll the page), after one slow glide from left to right on first view. Its side picks the
 * caption. Transform and clip-path only, on rAF, only while the section is on screen.
 * Reduced motion: two still loupes, one on each salt, and both captions.
 */
export function Loupe() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = ref.current?.closest<HTMLElement>('[data-crystals]');
    const field = root?.querySelector<HTMLElement>('[data-loupe-field]');
    if (!root || !field) return;
    const worlds = [...field.querySelectorAll<HTMLElement>('[data-world]')];
    const lenses = [...field.querySelectorAll<HTMLElement>('[data-lens]')];
    const mags = [...field.querySelectorAll<HTMLElement>('[data-mag]')];
    const rings = [...field.querySelectorAll<HTMLElement>('[data-ring]')];
    const still = !document.documentElement.classList.contains('motion');
    const touch = window.matchMedia('(pointer: coarse)').matches;

    // ---- the field's world: covers the field at 8:3 (wider on phones: it pans) ----
    let fw = 1,
      fh = 1,
      ww = 1,
      wh = 1,
      wy = 0,
      r = 120;
    const measure = () => {
      fw = field.clientWidth || 1;
      fh = field.clientHeight || 1;
      ww = Math.max(fw, fh * ASPECT);
      wh = ww / ASPECT;
      wy = (fh - wh) / 2;
      r = (rings[0]?.offsetWidth || 240) / 2;
      for (const w of worlds) {
        w.style.width = `${ww}px`;
        w.style.height = `${wh}px`;
        w.style.top = `${wy}px`;
      }
      pan = clampPan(pan);
      dirty = true;
    };
    const clampPan = (p: number) => Math.min(0, Math.max(fw - ww, p));

    // the loupe (x, y in the field), its target, the pan (phones)
    let pan = 0;
    let x = 0,
      y = 0,
      tx = 0,
      ty = 0;
    let dirty = true;
    let side = -1;
    const setSide = (s: number) => {
      if (s === side) return;
      side = s;
      root.dataset.side = String(s);
    };

    const place = (i: number, lx: number, ly: number) => {
      lenses[i]!.style.clipPath = `circle(${r}px at ${lx.toFixed(1)}px ${ly.toFixed(1)}px)`;
      mags[i]!.style.transform =
        `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px) scale(${MAG}) translate(${(-lx).toFixed(1)}px, ${(-ly).toFixed(1)}px)`;
      rings[i]!.style.transform = `translate(${(lx - r).toFixed(1)}px, ${(ly - r).toFixed(1)}px)`;
    };
    const draw = () => {
      const t = `translateX(${pan.toFixed(1)}px)`;
      for (const w of worlds) w.style.transform = t;
      if (still) {
        place(0, fw * 0.25, fh * 0.5);
        place(1, fw * 0.75, fh * 0.5);
        return;
      }
      place(0, x, y);
      // which salt is under it: left or right of the middle of the world (the blend)
      setSide(x - pan < ww / 2 ? 0 : 1);
    };

    const ro = new ResizeObserver(() => {
      measure();
      if (!touch) {
        tx = x = fw / 2;
        ty = y = fh / 2;
      } else {
        x = tx = fw / 2;
        y = ty = fh / 2;
      }
      draw();
    });
    ro.observe(field);
    measure();
    x = tx = fw / 2;
    y = ty = fh / 2;
    draw();
    if (still) {
      root.dataset.still = '';
      return () => ro.disconnect();
    }
    root.toggleAttribute('data-one', true); // one loupe

    // ---- the loop: on rAF, only while on screen ----
    let raf = 0;
    let onScreen = false;
    let glide: { t0: number; from: number; to: number } | null = null;
    let glided = false;
    const tick = (now: number) => {
      raf = 0;
      if (!onScreen) return;
      if (glide) {
        const k = Math.min(1, (now - glide.t0) / 4200);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        pan = glide.from + (glide.to - glide.from) * e;
        if (k >= 1) glide = null;
        dirty = true;
      }
      const nx = x + (tx - x) * 0.12;
      const ny = y + (ty - y) * 0.12;
      const moving = Math.abs(nx - x) > 0.05 || Math.abs(ny - y) > 0.05;
      x = nx;
      y = ny;
      if (moving || dirty) {
        draw();
        dirty = false;
      }
      if (moving || glide) raf = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!raf && onScreen) raf = requestAnimationFrame(tick);
    };
    const seen = new IntersectionObserver(([e]) => {
      onScreen = !!e?.isIntersecting;
      root.toggleAttribute('data-live', onScreen);
      if (onScreen && touch && !glided) {
        glided = true;
        glide = { t0: performance.now(), from: 0, to: fw - ww };
        pan = 0;
      }
      wake();
    });
    seen.observe(field);

    // ---- desktop: the cursor; the keys ----
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const b = field.getBoundingClientRect();
      tx = e.clientX - b.left;
      ty = e.clientY - b.top;
      wake();
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      tx = fw / 2;
      ty = fh / 2;
      wake();
    };
    const onKey = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 60 : 24;
      const d = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }[e.key];
      if (!d) return;
      e.preventDefault();
      if (touch) pan = clampPan(pan - d[0]!);
      else {
        tx = Math.min(fw, Math.max(0, tx + d[0]!));
        ty = Math.min(fh, Math.max(0, ty + d[1]!));
      }
      dirty = true;
      wake();
    };
    // ---- phones: a horizontal drag pans the field under the centred loupe ----
    let drag: { x0: number; y0: number; p0: number; on: boolean | null } | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      drag = { x0: e.clientX, y0: e.clientY, p0: pan, on: null };
    };
    const onDrag = (e: PointerEvent) => {
      if (!drag || e.pointerType === 'mouse') return;
      const dx = e.clientX - drag.x0;
      const dy = e.clientY - drag.y0;
      if (drag.on === null && Math.hypot(dx, dy) > 8) drag.on = Math.abs(dx) > Math.abs(dy);
      if (!drag.on) return;
      glide = null;
      pan = clampPan(drag.p0 + dx);
      dirty = true;
      wake();
    };
    const onUp = () => {
      drag = null;
    };
    field.addEventListener('pointermove', onMove);
    field.addEventListener('pointerleave', onLeave);
    field.addEventListener('keydown', onKey);
    field.addEventListener('pointerdown', onDown);
    field.addEventListener('pointermove', onDrag);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      ro.disconnect();
      seen.disconnect();
      cancelAnimationFrame(raf);
      field.removeEventListener('pointermove', onMove);
      field.removeEventListener('pointerleave', onLeave);
      field.removeEventListener('keydown', onKey);
      field.removeEventListener('pointerdown', onDown);
      field.removeEventListener('pointermove', onDrag);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);
  return <span ref={ref} hidden />;
}
