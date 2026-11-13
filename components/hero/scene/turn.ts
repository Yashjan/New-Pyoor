/**
 * The visitor turns the jar (the hero's rest state only; never during the scroll sequence).
 *
 * - Mouse: drag anywhere on the canvas turns the jar freely around y (360°), with a slight tilt
 *   (±10°). Touch: a horizontal drag turns it, a vertical one scrolls the page (the canvas is
 *   `touch-action: pan-y`; turning starts once the gesture is clearly horizontal: |dx| > |dy|
 *   after 8 px). The wheel is never taken: it always scrolls the page.
 * - Release: inertia, damped (~0.6 s to rest).
 * - Keyboard (the canvas focused): ←/→ turn it by 15°.
 * - The idle sway pauses while it is handled; 4 s after the last touch the jar eases back to its
 *   front pose (1.2 s) and the sway resumes. (The scroll sequence eases it to its start pose by
 *   itself: jar.ts multiplies the rest pose by the sequence's own `rest`.)
 */
const TILT = (10 * Math.PI) / 180;
const STEP = (15 * Math.PI) / 180;
const IDLE = 4; // seconds before it returns
const RETURN = 1.2; // seconds
const DAMP = 0.15; // inertia time constant (s): ~0.6 s to come to rest
const PER_PX = 0.0105; // radians per px dragged

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export interface Turn {
  /** Advance by dt; `atRest` says whether turning is allowed now. */
  update(dt: number, atRest: boolean): void;
  yaw: number;
  tilt: number;
  /** the idle sway's share, 0–1 (0 while handled, eased back with the return) */
  sway: number;
  dispose(): void;
}

export function createTurn(canvas: HTMLCanvasElement, onFirstTurn: () => void): Turn {
  let allowed = false;
  let dragging = false;
  let pending: { id: number; x: number; y: number } | null = null; // a touch, undecided
  let last = { x: 0, y: 0, t: 0 };
  let vYaw = 0;
  let vTilt = 0;
  let goal: number | null = null; // a keyboard step's target yaw
  let idleFor = Infinity; // seconds since the last interaction
  let ret: { from: [number, number]; t: number } | null = null;
  let turned = false;

  const s: Turn = {
    yaw: 0,
    tilt: 0,
    sway: 1,
    update,
    dispose,
  };

  const touched = () => {
    idleFor = 0;
    ret = null;
    if (!turned) {
      turned = true;
      onFirstTurn();
    }
  };

  const start = (e: PointerEvent) => {
    dragging = true;
    pending = null;
    last = { x: e.clientX, y: e.clientY, t: performance.now() };
    vYaw = vTilt = 0;
    goal = null;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // (already released)
    }
    canvas.style.cursor = 'grabbing';
    touched();
  };

  const onDown = (e: PointerEvent) => {
    if (!allowed || e.button > 0) return;
    if (e.pointerType === 'mouse') {
      e.preventDefault(); // no text selection while dragging
      start(e);
    } else pending = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onMove = (e: PointerEvent) => {
    if (pending && e.pointerId === pending.id) {
      const dx = e.clientX - pending.x;
      const dy = e.clientY - pending.y;
      if (Math.hypot(dx, dy) < 8) return;
      if (Math.abs(dx) > Math.abs(dy)) start(e);
      else pending = null; // vertical: the page scrolls (pan-y)
      return;
    }
    if (!dragging) return;
    const now = performance.now();
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    const dt = Math.max(1, now - last.t) / 1000;
    last = { x: e.clientX, y: e.clientY, t: now };
    s.yaw += dx * PER_PX;
    s.tilt = Math.max(-TILT, Math.min(TILT, s.tilt + dy * PER_PX * 0.5));
    // velocity for the inertia, smoothed over the last few moves
    vYaw = vYaw * 0.6 + ((dx * PER_PX) / dt) * 0.4;
    vTilt = vTilt * 0.6 + ((dy * PER_PX * 0.5) / dt) * 0.4;
    idleFor = 0;
  };
  const onUp = () => {
    pending = null;
    if (!dragging) return;
    dragging = false;
    if (performance.now() - last.t > 80) vYaw = vTilt = 0; // held still before letting go
    canvas.style.cursor = allowed ? 'grab' : '';
  };
  const onKey = (e: KeyboardEvent) => {
    if (!allowed || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    goal = (goal ?? s.yaw) + (e.key === 'ArrowRight' ? STEP : -STEP);
    vYaw = 0;
    touched();
  };

  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  canvas.addEventListener('keydown', onKey);

  function update(dt: number, atRest: boolean) {
    if (atRest !== allowed) {
      allowed = atRest;
      if (!allowed) {
        dragging = false;
        pending = null;
        goal = null;
        vYaw = vTilt = 0;
        s.yaw = wrap(s.yaw); // the sequence eases it home the shortest way round
      }
      canvas.style.cursor = allowed ? (dragging ? 'grabbing' : 'grab') : '';
    }
    if (!dragging) {
      if (goal !== null) {
        s.yaw += (goal - s.yaw) * Math.min(1, dt * 9);
        if (Math.abs(goal - s.yaw) < 1e-4) goal = null;
        idleFor = 0;
      } else if (vYaw || vTilt) {
        s.yaw += vYaw * dt;
        s.tilt = Math.max(-TILT, Math.min(TILT, s.tilt + vTilt * dt));
        const k = Math.exp(-dt / DAMP);
        vYaw *= k;
        vTilt *= k;
        if (Math.abs(vYaw) < 0.01 && Math.abs(vTilt) < 0.01) vYaw = vTilt = 0;
        idleFor = 0;
      } else idleFor += dt;
    }
    // 4 s after the last touch: back to the front (the shortest way round), sway resumes
    if (!dragging && idleFor >= IDLE && (s.yaw !== 0 || s.tilt !== 0)) {
      if (!ret) {
        s.yaw = wrap(s.yaw);
        ret = { from: [s.yaw, s.tilt], t: 0 };
      }
      ret.t = Math.min(1, ret.t + dt / RETURN);
      const k = 1 - ease(ret.t);
      s.yaw = ret.from[0] * k;
      s.tilt = ret.from[1] * k;
      if (ret.t >= 1) {
        s.yaw = s.tilt = 0;
        ret = null;
      }
    }
    // the sway: off while handled, back in step with the return
    const handled = dragging || idleFor < IDLE;
    const want = handled ? 0 : ret ? ease(ret.t) : 1;
    s.sway += (want - s.sway) * Math.min(1, dt * 6);
  }

  function dispose() {
    canvas.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('keydown', onKey);
  }

  return s;
}
