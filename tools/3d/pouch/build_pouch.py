"""Build Pyoor 1 kg stand-up zip pouch models as GLB (glTF 2.0).

Units: metres, Y up, front panel faces +Z, base centred on the origin.
Nodes: Pouch_front (artwork + clear window), Pouch_back (artwork), Pouch_base, Salt (fill seen through the window).
"""
import io, math, sys
import numpy as np
from PIL import Image
import pygltflib as g
sys.path.insert(0, "/home/claude/jar/src")
from build_jar import Writer, compute_normals

Image.MAX_IMAGE_PIXELS = None
W = 0.230            # pouch width
H = W / 0.754        # height from the artwork aspect (~0.305 m)
T_BASE = 0.046       # half gusset depth at the base
FILL = 0.57          # salt level (fraction of height)
SEAL_TOP = 0.935     # flat top seal starts here
NU, NV = 96, 160


def smooth(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def half_thickness(v):
    """Half-depth of the pouch along its height (v = 0 base .. 1 top)."""
    v = np.asarray(v, float)
    filled = T_BASE * (1 - 0.18 * (v / FILL) ** 2)
    top = T_BASE * 0.82 * (1 - smooth((v - FILL) / (SEAL_TOP - FILL - 0.02)))
    return np.where(v <= FILL, filled, top)


def across(u):
    """Cross profile: 0 at the side seals, 1 in the middle."""
    a = np.abs(2 * np.asarray(u, float) - 1)
    a = np.clip((a - 0.0) / 0.965, 0, 1)
    return np.clip(1 - a ** 2.4, 0, 1) ** 0.55


def surface(sign, inset=0.0, vmax=1.0):
    us = np.linspace(0, 1, NU + 1)
    vs = np.linspace(0, vmax, NV + 1)
    pos, uv = [], []
    for v in vs:
        t = half_thickness(v)
        for u in us:
            pull = 1 - 0.10 * (t / T_BASE)
            x = (u - 0.5) * W * pull * (1 - inset * 2.2)
            z = sign * t * across(u) * (1 - inset * 6) if t > 0 else 0.0
            y = v * H + (0.004 if inset else 0)
            pos.append((x if sign > 0 else x, y, z))
            uv.append((u if sign > 0 else 1 - u, 1 - v))
    pos = np.array(pos, np.float32); uv = np.array(uv, np.float32)
    cols = NU + 1
    idx = []
    for j in range(NV):
        for i in range(NU):
            a = j * cols + i; b = a + cols
            if sign > 0:
                idx += [(a, a + 1, b), (a + 1, b + 1, b)]
            else:
                idx += [(a, b, a + 1), (a + 1, b, b + 1)]
    idx = np.array(idx, np.uint32)
    return pos, compute_normals(pos, idx, 0), uv, idx


def base(inset=0.0, y=0.0, up=False):
    us = np.linspace(0, 1, NU + 1)
    t = half_thickness(0.0)
    pull = 1 - 0.10
    pts = [((u - 0.5) * W * pull * (1 - inset * 2.2), y, t * across(u) * (1 - inset * 6)) for u in us]
    pts += [((u - 0.5) * W * pull * (1 - inset * 2.2), y, -t * across(u) * (1 - inset * 6)) for u in us[::-1]]
    pos = np.array([(0, y, 0)] + pts, np.float32)
    uv = np.array([(0.5, 0.5)] + [(p[0] / W + 0.5, p[2] / (2 * T_BASE) + 0.5) for p in pts], np.float32)
    n = len(pts)
    idx = np.array([(0, 1 + (k + 1) % n, 1 + k) if not up else (0, 1 + k, 1 + (k + 1) % n) for k in range(n)], np.uint32)
    nrm = np.tile(np.array([0, 1 if up else -1, 0], np.float32), (len(pos), 1))
    return pos, nrm, uv, idx


def salt_body():
    """The salt inside: the pouch shape inset by a few mm, up to the fill line, with a soft mounded top."""
    s = 0.012
    fr = surface(+1, inset=s, vmax=FILL)
    bk = surface(-1, inset=s, vmax=FILL)
    top_ring_f = fr[0][-(NU + 1):]
    top_ring_b = bk[0][-(NU + 1):]
    ring = np.concatenate([top_ring_f, top_ring_b[::-1]])
    centre = ring.mean(0) + np.array([0, 0.012, 0], np.float32)
    tp = np.concatenate([[centre], ring]).astype(np.float32)
    n = len(ring)
    tidx = np.array([(0, 1 + (k + 1) % n, 1 + k) for k in range(n)], np.uint32)
    parts = [fr, bk, (tp, None, None, tidx), base(inset=s, y=0.004)]
    P, U, I = [], [], []
    off = 0
    for p, _, _, i in parts:
        P.append(p); U.append(np.stack([p[:, 0] / 0.03 + 0.5, p[:, 1] / 0.03 + p[:, 2] / 0.03], 1)); I.append(i + off); off += len(p)
    P = np.concatenate(P).astype(np.float32); U = np.concatenate(U).astype(np.float32); I = np.concatenate(I).astype(np.uint32)
    return P, compute_normals(P, I, 0), U, I


def crease_normal_map(w=1024, h=1360, seed=3):
    """Soft film creases, mostly in the empty upper part, plus the zip ridge."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    v = 1 - yy / h  # 0 base .. 1 top
    hf = np.zeros((h, w), np.float32)
    for _ in range(46):
        cy = rng.uniform(0.45, 0.93) if rng.random() < 0.75 else rng.uniform(0.05, 0.45)
        cx = rng.uniform(0.05, 0.95)
        ang = rng.normal(0, 0.35) + (math.pi / 2 if rng.random() < 0.3 else 0)
        L = rng.uniform(0.08, 0.35); wid = rng.uniform(0.004, 0.012); amp = rng.uniform(0.3, 1.0)
        dx = xx / w - cx; dy = v - cy
        along = dx * math.cos(ang) + dy * math.sin(ang)
        perp = -dx * math.sin(ang) + dy * math.cos(ang)
        hf += amp * np.exp(-(perp / wid) ** 2) * np.exp(-(along / L) ** 2) * (0.35 if cy < 0.45 else 1.0)
    for zy in (0.887, 0.874):  # the zip: two fine ridges
        hf += 1.4 * np.exp(-((v - zy) / 0.0018) ** 2)
    hf += 0.05 * np.random.default_rng(seed + 1).standard_normal((h, w)).astype(np.float32)
    gy, gx = np.gradient(hf)
    k = 6.0
    n = np.stack([-gx * k, gy * k, np.ones_like(hf)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8))


def mr_map(art, window=None):
    """glTF metallicRoughness: G = roughness, B = metalness. Gold foil shinier and more metallic."""
    a = np.asarray(art.convert("RGB")).astype(np.float32) / 255
    r, gch, b = a[..., 0], a[..., 1], a[..., 2]
    gold = ((r > 0.45) & (r - b > 0.18) & (gch - b > 0.08))
    white = a.min(2) > 0.85
    rough = np.full(r.shape, 0.26, np.float32); metal = np.full(r.shape, 0.30, np.float32)
    rough[gold] = 0.18; metal[gold] = 0.85
    rough[white] = 0.30; metal[white] = 0.05
    if window is not None:
        wm = np.asarray(window.resize(art.size)).astype(np.float32) / 255 > 0.5
        rough[wm] = 0.06; metal[wm] = 0.0
    out = np.stack([np.zeros_like(rough), rough, metal], -1)
    return Image.fromarray((out * 255).astype(np.uint8))


def save_tex(w, img, quality=88, png=False, max_w=2048):
    if img.width > max_w:
        img = img.resize((max_w, round(img.height * max_w / img.width)), Image.LANCZOS)
    buf = io.BytesIO()
    if png: img.save(buf, "PNG", optimize=True)
    else: img.convert("RGB").save(buf, "JPEG", quality=quality)
    v = w._view(buf.getvalue())
    w.gltf.images.append(g.Image(bufferView=v, mimeType="image/png" if png else "image/jpeg"))
    if not w.gltf.samplers:
        w.gltf.samplers.append(g.Sampler(magFilter=9729, minFilter=9987, wrapS=10497, wrapT=10497))
    w.gltf.textures.append(g.Texture(sampler=0, source=len(w.gltf.images) - 1))
    return len(w.gltf.textures) - 1


def film_material(w, name, tex, mr, nrm, transmission_tex=None):
    ext = {"KHR_materials_clearcoat": {"clearcoatFactor": 1.0, "clearcoatRoughnessFactor": 0.12}}
    if transmission_tex is not None:
        ext["KHR_materials_transmission"] = {"transmissionFactor": 1.0, "transmissionTexture": {"index": transmission_tex}}
        ext["KHR_materials_ior"] = {"ior": 1.5}
    for e in ext:
        if e not in w.gltf.extensionsUsed: w.gltf.extensionsUsed.append(e)
    pbr = g.PbrMetallicRoughness(baseColorTexture=g.TextureInfo(index=tex), metallicFactor=1.0, roughnessFactor=1.0,
                                 metallicRoughnessTexture=g.TextureInfo(index=mr))
    w.gltf.materials.append(g.Material(name=name, pbrMetallicRoughness=pbr,
                                       normalTexture=g.NormalMaterialTexture(index=nrm, scale=0.22),
                                       doubleSided=True, extensions=ext))
    return len(w.gltf.materials) - 1


def build(key, salt_name, out_path, aspect=0.754):
    global H
    H = W / aspect
    P = "/home/claude/pouch/"; T = "/home/claude/jar/tex/"
    front = Image.open(P + f"{key}_front_raw.png").convert("RGB")
    back = Image.open(P + f"{key}_back.png").convert("RGB")
    window = Image.open(P + f"{key}_window.png").convert("L")
    # inside the window the film is clear: make the artwork white there so the salt shows untinted
    fa = np.asarray(front).copy(); wm = np.asarray(window.resize(front.size)) > 127
    fa[wm] = (248, 248, 246); front = Image.fromarray(fa)
    w = Writer()
    t_front = save_tex(w, front, 90)
    t_back = save_tex(w, back, 90)
    t_fmr = save_tex(w, mr_map(front, window), 90, max_w=1024)
    t_bmr = save_tex(w, mr_map(back), 90, max_w=1024)
    t_win = save_tex(w, window.convert("RGB"), 90, max_w=1024)
    t_nrm = save_tex(w, crease_normal_map(), png=True, max_w=1024)
    m_front = film_material(w, "Pouch_front_film", t_front, t_fmr, t_nrm, transmission_tex=t_win)
    m_back = film_material(w, "Pouch_back_film", t_back, t_bmr, t_nrm)
    base_col = np.asarray(back.resize((64, 64))).reshape(-1, 3)[:200].mean(0) / 255
    m_base = w.material("Pouch_base", color=[*base_col.tolist(), 1.0], metallic=0.3, roughness=0.3, double=True)
    t_alb = w.texture(T + salt_name + "_albedo.jpg", quality=88)
    t_snrm = w.texture(T + salt_name + "_normal.png", png=True)
    t_smr = w.texture(T + salt_name + "_mr.jpg", quality=85)
    m_salt = w.material("Salt_crystals", tex=t_alb, normal=t_snrm, mr=t_smr, roughness=1.0)
    w.mesh("Salt", salt_body(), m_salt)
    w.mesh("Pouch_base", base(), m_base)
    w.mesh("Pouch_back", surface(-1), m_back)
    w.mesh("Pouch_front", surface(+1), m_front)
    w.save(out_path)
    print(out_path, f"{W*100:.1f} x {H*100:.1f} cm")


if __name__ == "__main__":
    O = sys.argv[1]
    build("black", "black", O + "/pyoor-pouch-herbal-black-salt.glb")
    build("lake", "white", O + "/pyoor-pouch-natural-lake-salt.glb")
    build("pink", "pink", O + "/pyoor-pouch-pink-rock-salt.glb", aspect=2497 / 3622)
