/**
 * Optional site sound (tools/sound/SOUND.md). Off by default; nothing loads or plays until the
 * visitor turns it on. One AudioContext, created and resumed inside that click (so phones allow
 * it); the five files are fetched and decoded only then.
 *
 * The mix follows the scroll position of the homepage hero (the same geometry the Journey,
 * the opening and the jar sequence use): loops simply track it, one-shots fire only while
 * scrolling forward. Every gain change ramps over at least 0.4 s.
 */
import {
  JOURNEY,
  JOURNEY_VH,
  OPEN_START_VH,
  OPEN_VH,
  SEQUENCE_START_VH,
  clamp01,
  openingPose,
} from '@/lib/motion/opening';

export type SoundName = 'wind-loop' | 'water-loop' | 'rake' | 'jar-tone' | 'cap-clicks';
const FILES: SoundName[] = ['wind-loop', 'water-loop', 'rake', 'jar-tone', 'cap-clicks'];
const ONE_SHOT_GAIN: Partial<Record<SoundName, number>> = {
  rake: 0.45,
  'jar-tone': 0.55,
  'cap-clicks': 0.5,
};
const MASTER = 0.7;
const RAMP = 0.4; // seconds, the shortest any gain change takes
const OFF_FADE = 0.6;
const KEY = 'pyoor-sound';

let on = false;
let started = false; // the stored choice has been read
const listeners = new Set<() => void>();

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let buffers: Partial<Record<SoundName, AudioBuffer>> | null = null;
let loading: Promise<void> | null = null;
const loops: Partial<Record<'wind-loop' | 'water-loop', GainNode>> = {};
let suspendTimer = 0;
let frame = 0;

const phase = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

/** Ramp a gain from where it is now to v, over `secs` (never a jump). */
function ramp(g: AudioParam, v: number, secs = RAMP) {
  if (!ctx) return;
  const now = ctx.currentTime;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(v, now + secs);
}

function emit() {
  listeners.forEach((fn) => fn());
}

/* ---------------- the mix, from the scroll position ---------------- */
const prev = { pan: NaN, rise: NaN, p: NaN };
let lastRake = -Infinity;
const targets = { wind: -1, water: -1 };

function mix() {
  frame = 0;
  if (!ctx || !buffers || ctx.state !== 'running') return;
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  let wind = 0;
  let water = 0;
  if (hero) {
    const vh = window.innerHeight;
    const y = -hero.getBoundingClientRect().top;
    const s = clamp01(y / (vh * JOURNEY_VH));
    const inP = phase(s, 0, JOURNEY.in);
    const pan = phase(s, JOURNEY.in, JOURNEY.out);
    const rise = openingPose(clamp01((y - vh * OPEN_START_VH) / (vh * OPEN_VH))).rise;
    const seqAt = vh * SEQUENCE_START_VH;
    const range = hero.offsetHeight - vh - seqAt;
    const p = range > 0 ? clamp01((y - seqAt) / range) : 0;

    // wind: from the SAMBHAR handoff through the Journey, down to 0.12 as the jar rises,
    // gone once the jar sequence starts
    if (s > 0 && y < seqAt) wind = inP * (0.35 + (0.12 - 0.35) * rise);
    // water: scene 01, gone halfway to scene 02
    if (s > 0 && s < 1) water = inP * 0.4 * (1 - clamp01((pan * 4) / 0.5));

    // one-shots: forward only
    if (!Number.isNaN(prev.pan)) {
      const t = ctx.currentTime;
      if (prev.pan < 0.37 && pan >= 0.37 && t - lastRake >= 1.5) {
        lastRake = t;
        play('rake');
      }
      if (prev.rise < 0.5 && rise >= 0.5) play('jar-tone');
      if (prev.p < 0.05 && p >= 0.05) play('cap-clicks');
    }
    prev.pan = pan;
    prev.rise = rise;
    prev.p = p;
  }
  if (Math.abs(wind - targets.wind) > 0.004 && loops['wind-loop']) {
    targets.wind = wind;
    ramp(loops['wind-loop'].gain, wind);
  }
  if (Math.abs(water - targets.water) > 0.004 && loops['water-loop']) {
    targets.water = water;
    ramp(loops['water-loop'].gain, water);
  }
}

const schedule = () => {
  if (!frame) frame = requestAnimationFrame(mix);
};

/* ---------------- the engine ---------------- */
async function load() {
  const c = ctx!;
  const decoded = await Promise.all(
    FILES.map(async (name) => {
      const res = await fetch(`/sounds/${name}.mp3`);
      return [name, await c.decodeAudioData(await res.arrayBuffer())] as const;
    }),
  );
  buffers = Object.fromEntries(decoded);
  for (const name of ['wind-loop', 'water-loop'] as const) {
    const g = c.createGain();
    g.gain.value = 0;
    g.connect(master!);
    const src = c.createBufferSource();
    src.buffer = buffers[name]!;
    src.loop = true;
    src.connect(g);
    src.start();
    loops[name] = g;
  }
  prev.pan = prev.rise = prev.p = NaN; // the first reading only sets where we are
  schedule();
}

/** Starts (or resumes) the audio. Must run inside a user gesture the first time. */
function start() {
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', onVisibility);
  }
  window.clearTimeout(suspendTimer);
  void ctx.resume().then(schedule);
  ramp(master!.gain, MASTER);
  loading ??= load().catch((err) => {
    loading = null;
    console.error('Sound failed to load', err);
  });
}

function stop() {
  if (!ctx || !master) return;
  ramp(master.gain, 0, OFF_FADE);
  window.clearTimeout(suspendTimer);
  suspendTimer = window.setTimeout(
    () => {
      if (!on) void ctx?.suspend();
    },
    OFF_FADE * 1000 + 50,
  );
}

function onVisibility() {
  if (!ctx) return;
  if (document.hidden) void ctx.suspend();
  else if (on) void ctx.resume().then(schedule);
}

/** A remembered "on" from an earlier visit: the audio starts at the visitor's first gesture. */
function armGesture() {
  const go = () => {
    remove();
    if (on) start();
  };
  const events = ['pointerdown', 'keydown', 'touchend'] as const;
  const remove = () => events.forEach((e) => window.removeEventListener(e, go, true));
  events.forEach((e) => window.addEventListener(e, go, true));
}

function readStored() {
  if (started) return;
  started = true;
  try {
    on = window.localStorage.getItem(KEY) === 'on';
  } catch {
    on = false;
  }
  if (on) armGesture();
}

/** Plays a one-shot (when sound is on and loaded). */
export function play(name: SoundName) {
  const gain = ONE_SHOT_GAIN[name];
  if (!on || !ctx || !master || !buffers?.[name] || gain === undefined) return;
  if (ctx.state !== 'running') return;
  const g = ctx.createGain();
  g.gain.value = gain;
  g.connect(master);
  const src = ctx.createBufferSource();
  src.buffer = buffers[name]!;
  src.connect(g);
  src.onended = () => g.disconnect();
  src.start();
}

export const sound = {
  play,
  isOn: () => {
    readStored();
    return on;
  },
  subscribe(fn: () => void) {
    readStored();
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  /** Call from the toggle's click handler (the gesture that lets the audio start). */
  set(next: boolean) {
    readStored();
    on = next;
    try {
      window.localStorage.setItem(KEY, next ? 'on' : 'off');
    } catch {
      // private mode: the choice lasts for this visit
    }
    if (next) start();
    else stop();
    emit();
  },
};
