"""Pyoor Journey sound kit: procedural synthesis (no samples).
Outputs 48 kHz stereo WAV masters; mp3 encoding is done afterwards with ffmpeg."""
import numpy as np
from scipy import signal
from scipy.io import wavfile
import os

SR = 48000
OUT = os.path.join(os.path.dirname(__file__), "out")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="high", fs=SR, output="sos"), x)


def smooth_rand(n, rate_hz, lo, hi):
    """Slow random curve between lo and hi (cubic-interpolated control points)."""
    pts = int(n / SR * rate_hz) + 4
    ctrl = rng.uniform(lo, hi, pts)
    xs = np.linspace(0, pts - 1, n)
    from scipy.interpolate import CubicSpline
    return np.clip(CubicSpline(np.arange(pts), ctrl)(xs), lo, hi)


def reverb(x, seconds=2.2, wet=0.25, damp=5000):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t * 6.9 / seconds)[:, None]
    ir = np.stack([lp(ir[:, c], damp) for c in range(2)], 1)
    ir /= np.sqrt((ir ** 2).sum(0))
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    y = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)
    return x * (1 - wet) + y * wet


def loopify(x, xfade_s):
    """Crossfade the tail into the head so the file loops seamlessly."""
    k = int(xfade_s * SR)
    body, tail = x[:-k].copy(), x[-k:]
    w = np.linspace(0, np.pi / 2, k)[:, None]
    body[:k] = body[:k] * np.sin(w) + tail * np.cos(w)
    return body


def fade(x, fin=0.005, fout=0.05):
    a, b = int(fin * SR), int(fout * SR)
    env = np.ones(len(x))
    if a: env[:a] = np.linspace(0, 1, a)
    if b: env[-b:] = np.linspace(1, 0, b)
    return x * (env[:, None] if x.ndim == 2 else env)


def norm(x, peak_db):
    return x / np.max(np.abs(x)) * 10 ** (peak_db / 20)


def save(name, x):
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    wavfile.write(os.path.join(OUT, name + ".wav"), SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))


# 1. Wind over the flats: 24 s seamless loop
def wind(dur=24, xf=4):
    n = int((dur + xf) * SR)
    ch = []
    for c in range(2):
        brown = np.cumsum(rng.standard_normal(n)); brown = hp(brown, 40)
        low = bp(brown, 90, 420) * smooth_rand(n, 0.12, 0.25, 1.0)
        mid = bp(rng.standard_normal(n), 380, 1300) * smooth_rand(n, 0.18, 0.0, 0.5) ** 2
        air = bp(rng.standard_normal(n), 2500, 6000) * smooth_rand(n, 0.25, 0.0, 0.03)
        ch.append(low / np.std(low) + 0.55 * mid / np.std(mid) * 0.6 + air)
    x = np.stack(ch, 1)
    x = 0.75 * x + 0.25 * x[:, ::-1]  # partly correlated stereo
    return norm(loopify(x, xf), -10)


# 2. Water trickling through the sluice: 16 s loop (Minnaert-style bubbles)
def water(dur=16, xf=2):
    n = int((dur + xf) * SR)
    x = np.zeros((n, 2))
    t_events = np.cumsum(rng.exponential(1 / 38, int((dur + xf) * 60)))
    t_events = t_events[t_events < dur + xf - 0.15]
    for te in t_events:
        f0 = rng.uniform(520, 1900)
        tau = rng.uniform(0.004, 0.018)
        L = int(tau * 6 * SR)
        t = np.arange(L) / SR
        f = f0 * (1 + rng.uniform(0.6, 2.2) * t / (tau * 6))  # rising chirp
        ph = 2 * np.pi * np.cumsum(f) / SR
        b = np.sin(ph) * np.exp(-t / tau) * rng.uniform(0.2, 1.0) ** 2
        i = int(te * SR); pan = rng.uniform(0.2, 0.8)
        x[i:i + L, 0] += b * (1 - pan); x[i:i + L, 1] += b * pan
    bed = np.stack([bp(rng.standard_normal(n), 900, 4200) for _ in range(2)], 1)
    bed *= smooth_rand(n, 0.5, 0.5, 1.0)[:, None]
    x = x / np.max(np.abs(x)) + 0.06 * bed / np.max(np.abs(bed))
    x = np.stack([lp(x[:, c], 7000) for c in range(2)], 1)
    x = reverb(x, 1.2, 0.18, 6000)
    return norm(loopify(x, xf), -10)


# 3. Rake pulled through salt crystals: one-shot ~2 s
def rake(dur=2.2):
    n = int(dur * SR); t = np.arange(n) / SR
    pull = np.clip(t / 0.35, 0, 1) * np.clip((dur - 0.25 - t) / 0.9, 0, 1)
    density = 300 + 2200 * pull
    grains = np.zeros(n)
    p = density / SR
    hits = rng.random(n) < p
    grains[hits] = rng.uniform(-1, 1, hits.sum()) * rng.uniform(0.2, 1, hits.sum())
    k = np.exp(-np.arange(int(0.0015 * SR)) / (0.0004 * SR))
    crunch = signal.fftconvolve(grains, k)[:n]
    crunch = lp(bp(crunch, 1200, 6000), 6500, 4)
    drag = bp(rng.standard_normal(n), 180, 900) * pull ** 1.5
    x = 0.8 * crunch / np.max(np.abs(crunch)) + 0.45 * drag / np.max(np.abs(drag))
    x *= pull
    st = np.stack([x, np.roll(x, 90)], 1)
    st = reverb(st, 0.8, 0.12, 5000)
    return norm(fade(st, 0.01, 0.2), -6)


# 4. The jar comes alive: soft glass tone ~5 s
def glass(dur=5.0, f0=1046.5):
    n = int(dur * SR); t = np.arange(n) / SR
    ratios = [1.0, 2.32, 4.25, 6.63]
    decays = [2.4, 1.3, 0.6, 0.3]
    amps = [1.0, 0.42, 0.16, 0.07]
    ch = []
    for det in (0.0, 1.8):  # slow beating between channels = shimmer
        y = np.zeros(n)
        for r, d, a in zip(ratios, decays, amps):
            y += a * np.sin(2 * np.pi * (f0 * r + det * r) * t + rng.uniform(0, 6.28)) * np.exp(-t / d)
        ch.append(y)
    x = np.stack(ch, 1)
    att = np.clip(t / 0.012, 0, 1) ** 2  # soft mallet, not a ding
    x *= att[:, None]
    x = reverb(x, 3.0, 0.32, 7000)
    return norm(fade(x, 0.0, 0.6), -9)


# 5. Cap unscrewing: thread clicks ~2.4 s
def cap(dur=2.4):
    n = int(dur * SR); t = np.arange(n) / SR
    x = np.zeros(n)
    times, tt, gap = [], 0.12, 0.26
    while tt < dur - 0.5:
        times.append(tt); tt += gap; gap = max(0.13, gap * 0.9)
    for i, tc in enumerate(times):
        L = int(0.03 * SR); tl = np.arange(L) / SR
        burst = rng.standard_normal(L) * np.exp(-tl / 0.0035)
        burst = bp(burst, 1800, 6000) + 0.5 * np.sin(2 * np.pi * 3150 * tl) * np.exp(-tl / 0.006)
        j = int(tc * SR); x[j:j + L] += burst * rng.uniform(0.6, 1.0)
    swish = bp(rng.standard_normal(n), 700, 3200) * 0.05
    swish *= np.clip(t / 0.1, 0, 1) * np.clip((times[-1] + 0.1 - t) / 0.2, 0, 1)
    # release: the cap lifts off the thread
    tr = t - (times[-1] + 0.22)
    pop = np.where(tr > 0, np.sin(2 * np.pi * 190 * tr) * np.exp(-tr / 0.025), 0) * 0.5
    x = x / np.max(np.abs(x)) + swish + pop
    st = np.stack([x, np.roll(x, 40)], 1)
    st = reverb(st, 0.6, 0.1, 6000)
    return norm(fade(st, 0.002, 0.15), -8)


if __name__ == "__main__":
    parts = {
        "wind-loop": wind(), "water-loop": water(), "rake": rake(),
        "jar-tone": glass(), "cap-clicks": cap(),
    }
    for k, v in parts.items():
        save(k, v)

    # Preview: the Journey in ~32 s, mixed roughly as the site would play it
    L = int(32 * SR); mix = np.zeros((L, 2))
    w = np.tile(parts["wind-loop"], (2, 1))[:L]
    mix += w * 0.32 * smooth_rand(L, 0.0001, 1, 1)[:, None]
    wl = np.tile(parts["water-loop"], (2, 1))[: int(12 * SR)]
    env = np.ones(len(wl)); env[-int(3 * SR):] = np.linspace(1, 0, int(3 * SR)); env[:SR] = np.linspace(0, 1, SR)
    mix[int(1 * SR): int(1 * SR) + len(wl)] += wl * 0.38 * env[:, None]

    def put(sig, at, g):
        i = int(at * SR); mix[i:i + len(sig)] += sig[: L - i] * g
    put(parts["rake"], 12.5, 0.45)
    put(parts["rake"], 15.0, 0.35)
    put(parts["jar-tone"], 22.0, 0.55)
    put(parts["cap-clicks"], 27.5, 0.5)
    g = np.ones(L); g[:SR] = np.linspace(0, 1, SR); g[-2 * SR:] = np.linspace(1, 0, 2 * SR)
    save("preview-journey", norm(mix * g[:, None], -3))
    print("ok")
