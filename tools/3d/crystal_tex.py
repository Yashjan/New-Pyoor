"""Tileable salt-crystal textures: albedo, normal (per-facet), metallic-roughness.

Every grain is drawn as an irregular, rotated crystal (halite grows in cubes) split into
two facets, each with its own tilted normal, so the jar's lighting glints off grains.
"""
import math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1024, 512


def grain_poly(cx, cy, size, rng):
    ang = rng.random() * math.pi
    sides = rng.choice([4, 4, 4, 5, 6])
    asp = 0.65 + rng.random() * 0.7
    pts = []
    for k in range(sides):
        a = ang + k * 2 * math.pi / sides + (rng.random() - 0.5) * 0.5
        r = size * (0.42 + rng.random() * 0.18)
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r * asp))
    return pts


def tilted_normal(rng, max_tilt):
    t = math.radians(rng.random() * max_tilt)
    p = rng.random() * 2 * math.pi
    n = np.array([math.sin(t) * math.cos(p), math.sin(t) * math.sin(p), math.cos(t)])
    return tuple(int(round((c * 0.5 + 0.5) * 255)) for c in n)


def make(name, base, spread, sizes, counts, gap, rough=(0.28, 0.55), tint=None, seed=1, translucent=False):
    rng = np.random.default_rng(seed)
    alb = Image.new("RGB", (W, H), gap)
    nrm = Image.new("RGB", (W, H), (128, 128, 255))
    mr = Image.new("RGB", (W, H), (0, 235, 0))  # G = roughness, high in the gaps
    da, dn, dm = ImageDraw.Draw(alb), ImageDraw.Draw(nrm), ImageDraw.Draw(mr)
    jobs = []
    for (smin, smax), n in zip(sizes, counts):
        for _ in range(n):
            jobs.append((rng.random() * W, rng.random() * H, smin + (smax - smin) * rng.random() ** 1.6))
    rng.shuffle(jobs)
    for cx, cy, s in jobs:
        poly = grain_poly(cx, cy, s, rng)
        # colour per grain
        k = 0.72 + rng.random() * 0.5
        col = np.array(base, float) * k + (rng.random() - 0.5) * spread + (rng.random(3) - 0.5) * 8
        if tint is not None and rng.random() < tint[1]:
            col = col * 0.5 + np.array(tint[0]) * 0.5
        col = tuple(int(v) for v in np.clip(col, 0, 255))
        hi = tuple(int(min(255, v * (1.18 if not translucent else 1.28) + 10)) for v in col)
        n1, n2 = tilted_normal(rng, 38), tilted_normal(rng, 38)
        r1 = int(255 * (rough[0] + (rough[1] - rough[0]) * rng.random()))
        # second facet = triangle from centre to one edge
        i = int(rng.integers(0, len(poly)))
        tri = [(cx, cy), poly[i], poly[(i + 1) % len(poly)]]
        tri2 = [(cx, cy), poly[(i + 2) % len(poly)], poly[(i + 3) % len(poly)]] if len(poly) > 4 else None
        for ox in (-W, 0, W):
            for oy in (-H, 0, H):
                if not (-s < cx + ox < W + s and -s < cy + oy < H + s):
                    continue
                P = [(x + ox, y + oy) for x, y in poly]
                T = [(x + ox, y + oy) for x, y in tri]
                da.polygon(P, fill=col); da.polygon(T, fill=hi)
                dn.polygon(P, fill=n1); dn.polygon(T, fill=n2)
                dm.polygon(P, fill=(0, r1, 0)); dm.polygon(T, fill=(0, max(40, r1 - 50), 0))
                if tri2:
                    T2 = [(x + ox, y + oy) for x, y in tri2]
                    sh = tuple(int(v * 0.8) for v in col)
                    da.polygon(T2, fill=sh); dn.polygon(T2, fill=tilted_normal(rng, 45))
    # fine glints: a few tiny bright specks
    a = np.asarray(alb).astype(np.float32)
    ys, xs = rng.integers(0, H, 900), rng.integers(0, W, 900)
    a[ys, xs] = a[ys, xs] * 0.35 + 255 * 0.65
    alb = Image.fromarray(a.clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.35))
    nrm = nrm.filter(ImageFilter.GaussianBlur(0.5))
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "textures", name)
    alb.save(out + "_albedo.jpg", quality=90)
    nrm.save(out + "_normal.png", optimize=True)
    mr.filter(ImageFilter.GaussianBlur(0.4)).save(out + "_mr.jpg", quality=88)


# Herbal black salt: fine powder, mauve-grey with darker and reddish grains (scale ~0.03 mm/px)
make("black", base=(136, 108, 106), spread=30, sizes=[(7, 13), (12, 20)], counts=[7000, 1800],
     gap=(92, 70, 70), tint=((100, 70, 74), 0.22), seed=11)
# Natural lake salt: small clean crystals, bright white with grey shadows
make("white", base=(236, 233, 226), spread=14, sizes=[(10, 18), (16, 28)], counts=[4200, 1400],
     gap=(196, 193, 188), rough=(0.18, 0.4), seed=12, translucent=True)
# Himalayan pink salt: coarse translucent chunks, pale pink to deep peach
make("pink", base=(232, 160, 140), spread=36, sizes=[(30, 60), (14, 26)], counts=[620, 1400],
     gap=(150, 92, 82), rough=(0.15, 0.35), tint=((248, 222, 212), 0.3), seed=13, translucent=True)
print("ok")
