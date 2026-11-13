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
  SEQUENCE_START_VH,
  SPLIT_VH,
  STEP,
  clamp01,
} from '@/lib/motion/opening';
import { pourRate } from '@/lib/motion/pour';
import { PANS, PANS_VH } from '@/lib/motion/pans';
import { asset } from '@/lib/basePath';

export type SoundName =
  'wind-loop' | 'water-loop' | 'pour-loop' | 'rake' | 'jar-tone' | 'cap-clicks';
type Loop = 'wind-loop' | 'water-loop' | 'pour-loop';
const LOOPS: readonly Loop[] = ['wind-loop', 'water-loop', 'pour-loop'];
const FILES: SoundName[] = [...LOOPS, 'rake', 'jar-tone', 'cap-clicks'];
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
const loops: Partial<Record<Loop, GainNode>> = {};
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
const targets: Record<Loop, number> = { 'wind-loop': -1, 'water-loop': -1, 'pour-loop': -1 };

function mix() {
  frame = 0;
  if (!ctx || !buffers || ctx.state !== 'running') return;
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  let wind = 0;
  let water = 0;
  let pouring = 0;
  if (hero) {
    const vh = window.innerHeight;
    const y = -hero.getBoundingClientRect().top;
    const s = clamp01((y - vh * SPLIT_VH) / (vh * JOURNEY_VH)); // the panorama, after the split
    const inP = clamp01(y / (vh * SPLIT_VH)); // the split
    const pan = phase(s, JOURNEY.in, JOURNEY.out);
    // step 2 (the end of the Journey): the 3D jar revealed under the engraving
    const rise = phase(phase(s, JOURNEY.out, 1), ...STEP.reveal);
    const seqAt = vh * SEQUENCE_START_VH;
    const pansAt = hero.offsetHeight - vh * (1 + PANS_VH);
    const range = pansAt - seqAt;
    const p = range > 0 ? clamp01((y - seqAt) / range) : 0;
    const q = clamp01((y - pansAt) / (vh * PANS_VH)); // step 3, the salt pans

    // wind: from the SAMBHAR handoff through the Journey, down to 0.12 as the 3D jar is
    // revealed (step 2), gone once the jar sequence starts
    if (y > 0 && y < seqAt) wind = inP * (0.35 + (0.12 - 0.35) * rise);
    // water: scene 01, gone halfway to scene 02
    if (y > 0 && s < 1) water = inP * 0.4 * (1 - clamp01((pan * 4) / 0.5));
    // the pour: follows the stream (0 -> 0.45 -> 0), silent once it stops or scrolls back
    if (y >= seqAt) pouring = 0.45 * pourRate(p);
    // the salt pans: wind (0.25) and water (0.15) while they colour, out as the camera settles
    if (q > 0 && q < 1) {
      const k =
        phase(q, PANS.colour[0] - 0.05, PANS.colour[0] + 0.05) * (1 - phase(q, ...PANS.settle));
      wind = Math.max(wind, 0.25 * k);
      water = Math.max(water, 0.15 * k);
    }

    // one-shots: forward only
    if (!Number.isNaN(prev.pan)) {
      const t = ctx.currentTime;
      if (prev.pan < 0.37 && pan >= 0.37 && t - lastRake >= 1.5) {
        lastRake = t;
        play('rake');
      }
      if (prev.rise < 0.5 && rise >= 0.5) play('jar-tone');
      if (prev.p < 0.005 && p >= 0.005) play('cap-clicks'); // the cap starts to turn
    }
    prev.pan = pan;
    prev.rise = rise;
    prev.p = p;
  }
  const want: Record<Loop, number> = {
    'wind-loop': wind,
    'water-loop': water,
    'pour-loop': pouring,
  };
  for (const name of LOOPS) {
    const g = loops[name];
    if (!g || Math.abs(want[name] - targets[name]) <= 0.004) continue;
    targets[name] = want[name];
    ramp(g.gain, want[name]);
  }
}

const schedule = () => {
  if (!frame) frame = requestAnimationFrame(mix);
};

/* ---------------- the engine ---------------- */
async function load() {
  const c = ctx!;
  // each file on its own: one that's missing or broken mustn't silence the rest
  const decoded = await Promise.all(
    FILES.map(async (name) => {
      try {
        const res = await fetch(asset(`/sounds/${name}.mp3`));
        if (!res.ok) throw new Error(`${res.status}`);
        return [name, await c.decodeAudioData(await res.arrayBuffer())] as const;
      } catch (err) {
        console.error(`Sound "${name}" failed to load`, err);
        return [name, null] as const;
      }
    }),
  );
  buffers = Object.fromEntries(decoded.filter(([, b]) => b)) as typeof buffers;
  for (const name of LOOPS) {
    if (!buffers![name]) continue;
    const g = c.createGain();
    g.gain.value = 0;
    g.connect(master!);
    const src = c.createBufferSource();
    src.buffer = buffers![name]!;
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
