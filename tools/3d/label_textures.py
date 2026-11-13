"""The hero jar's label textures, from the label design PDF, without the temporary barcode.

  python3 tools/3d/label_textures.py
  BARCODE_SVG=path/to/gs1-barcode.svg python3 tools/3d/label_textures.py   (a real barcode)

Source: tools/3d/source/labels/label-herbal-black-salt.pdf (page 2 of the label design PDF).
Note: the PDF is not vector; the page is one embedded JPEG, 2338 x 600 px. It is rendered at
that native size (pdftocairo), cropped to the artwork, and the barcode is removed. The larger
outputs are upscales (Lanczos): they keep the label sharp on screen, but add no detail beyond
the source's.

The barcode on the artwork is a temporary, unregistered one (not from GS1). It is removed: its
white box is filled with the label's own background, rebuilt from the background pattern
itself (it repeats exactly every 75 px down, and very nearly every (67, -38) px diagonally)
over the colour gradient fitted from the surrounding background, so no box or seam remains.
BARCODE_SVG (unset = no barcode) puts a real one back in the same place: a white box with the
SVG fitted inside, drawn at each output's own resolution.

Writes:
  public/textures/label-herbal-black-salt-4096.webp   the hero jar (all tiers), the reader on
                                                      phones / weak GPUs, the flat reader
  public/textures/label-herbal-black-salt-8192.webp   the label reader on desktop (lazy)
  tools/3d/textures/label-herbal-black-salt.png       2400 px, the model's own label; then
                                                      tools/3d/swap_label.mjs puts it into the
                                                      source and web models

KTX2 (UASTC) would be smaller on the GPU, but needs toktx / basisu (KTX-Software), which is not
installed here; three.js builds the mipmaps from the WebP on upload.
"""
import os
import subprocess
import tempfile

import numpy as np
from PIL import Image
from scipy import ndimage as nd

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
PDF = os.path.join(ROOT, "tools/3d/source/labels/label-herbal-black-salt.pdf")
OUT = os.path.join(ROOT, "public/textures")
MODEL_PNG = os.path.join(ROOT, "tools/3d/textures/label-herbal-black-salt.png")
SIZES = (4096, 8192)
MODEL_SIZE = (2400, 616)

# The page renders at 2450 px wide; the artwork is the non-white part of it (2340 x 600: the
# embedded JPEG). Everything below is in artwork pixels at that size.
PAGE_W = 2450
# The barcode's white box (bars, digits and the box itself).
BOX = (1955, 404, 2256, 516)
# The background pattern's exact repeat (down) and its near-exact diagonal one.
PERIOD = 75
DIAGONAL = (67, -38)


def artwork():
    with tempfile.TemporaryDirectory() as tmp:
        base = os.path.join(tmp, "page")
        subprocess.run(
            ["pdftocairo", "-png", "-singlefile", "-scale-to-x", str(PAGE_W), "-scale-to-y", "-1", PDF, base],
            check=True,
        )
        page = Image.open(base + ".png").convert("RGB")
    a = np.asarray(page).astype(int)
    ink = a.sum(2) < 740
    ys = np.where(ink.any(1))[0]
    xs = np.where(ink.any(0))[0]
    return page.crop((xs[0], ys[0], xs[-1] + 1, ys[-1] + 1))


def remove_barcode(img):
    """Fills the barcode's box with the label's background (pattern over the fitted gradient)."""
    A = np.asarray(img).astype(float)
    L = A.mean(2)
    H, W = L.shape
    x0, y0, x1, y1 = BOX
    # clean background: away from anything bright (text, logos, boxes), and not the box
    clean = ~nd.binary_dilation(L > 60, iterations=5)
    clean[y0 - 5 : y1 + 5, x0 - 5 : x1 + 5] = False
    cf = clean.astype(float)
    yy, xx = np.mgrid[y0:y1, x0:x1]
    # the gradient: fitted on the background left, right and below the box (not above it: the
    # grade box's shadowed gap)
    ring = np.zeros((H, W), bool)
    ring[y0 : y1 + 14, x0 - 24 : x0 - 6] = True
    ring[y0 : y1 + 14, x1 + 6 : x1 + 24] = True
    ring[y1 + 6 : y1 + 14, x0:x1] = True
    ring &= clean
    ry, rx = np.nonzero(ring)

    def design(y, x):
        u = (x - x0) / (x1 - x0)
        v = (y - y0) / (y1 - y0)
        return np.stack([np.ones_like(u), u, v, u * v, u * u, v * v], -1)

    down = [(0, k * PERIOD) for k in range(-6, 7) if k]
    diag = [(s * DIAGONAL[0], s * DIAGONAL[1] + k * PERIOD) for s in (1, -1) for k in range(-6, 7)]
    out = A.copy()
    for c in range(3):
        ch = A[..., c]
        low = nd.gaussian_filter(ch * cf, 6) / np.maximum(nd.gaussian_filter(cf, 6), 1e-3)
        detail = ch - low

        def borrowed(shifts):
            layers = []
            for dx, dy in shifts:
                ys = np.arange(y0, y1) + dy
                xs = np.arange(x0, x1) + dx
                if xs.min() < 0 or xs.max() >= W:
                    continue
                v = np.full((y1 - y0, x1 - x0), np.nan)
                ok = (ys >= 0) & (ys < H)
                sub = detail[np.ix_(ys[ok], xs)]
                v[ok] = np.where(clean[np.ix_(ys[ok], xs)], sub, np.nan)
                layers.append(v)
            with np.errstate(all="ignore"), __import__("warnings").catch_warnings():
                __import__("warnings").simplefilter("ignore")
                return np.nanmedian(np.array(layers), axis=0)

        a, b = borrowed(down), borrowed(diag)
        pattern = np.where(np.isnan(a), b, a)
        pattern = np.where(np.isnan(pattern), 0, pattern)
        coef, *_ = np.linalg.lstsq(design(ry, rx), ch[ry, rx] - detail[ry, rx], rcond=None)
        out[y0:y1, x0:x1, c] = design(yy, xx) @ coef + pattern
    return Image.fromarray(np.clip(out, 0, 255).round().astype(np.uint8))


def svg_png(svg, w, h):
    """The barcode SVG rasterised to w x h (sharp, from node_modules: librsvg)."""
    js = (
        "const s=require('sharp');s(process.argv[1],{density:600})"
        ".resize(+process.argv[2],+process.argv[3],{fit:'contain',background:'#ffffff'})"
        ".flatten({background:'#ffffff'}).png().toBuffer().then(b=>process.stdout.write(b))"
    )
    png = subprocess.run(["node", "-e", js, svg, str(w), str(h)], check=True, capture_output=True, cwd=ROOT).stdout
    with tempfile.NamedTemporaryFile(suffix=".png") as f:
        f.write(png)
        f.flush()
        return Image.open(f.name).convert("RGB").copy()


def with_barcode(img, svg, art_w):
    """A real barcode back in the box's place: a white box, the SVG inside with a quiet margin."""
    k = img.width / art_w
    x0, y0, x1, y1 = (round(v * k) for v in BOX)
    out = img.copy()
    out.paste((255, 255, 255), (x0, y0, x1, y1))
    m = round(8 * k)
    out.paste(svg_png(svg, x1 - x0 - 2 * m, y1 - y0 - 2 * m), (x0 + m, y0 + m))
    return out


def main():
    svg = os.environ.get("BARCODE_SVG") or None
    art = remove_barcode(artwork())
    aspect = art.height / art.width
    os.makedirs(OUT, exist_ok=True)
    outputs = [(os.path.join(OUT, f"label-herbal-black-salt-{s}.webp"), (s, round(s * aspect))) for s in SIZES]
    outputs.append((MODEL_PNG, MODEL_SIZE))
    for path, size in outputs:
        img = art.resize(size, Image.LANCZOS)
        if svg:
            img = with_barcode(img, svg, art.width)
        if path.endswith(".webp"):
            img.save(path, "WEBP", quality=90, method=6)
        else:
            img.save(path, "PNG", optimize=True)
        print(os.path.relpath(path, ROOT), img.size, f"{os.path.getsize(path) / 1024:.0f} KB")
    subprocess.run(["node", "tools/3d/swap_label.mjs", MODEL_PNG], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
