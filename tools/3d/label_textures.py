"""The hero jar's label at print sharpness, from the vector artwork (text as curves).

  python3 tools/3d/label_textures.py

Source: tools/3d/source/labels/label-herbal-black-salt.pdf (page 2 of the label design PDF).
Rasterised with pdftocairo (poppler), cropped to the artwork (the page has a white margin; the
crop is the same one the GLB's label texture uses, so the UVs match), then written as WebP:

  public/textures/label-herbal-black-salt-4096.webp   the hero jar (all tiers), and the reader
                                                      on phones / weak GPUs
  public/textures/label-herbal-black-salt-8192.webp   the label reader on desktop (lazy)

KTX2 (UASTC) would be smaller on the GPU, but needs toktx / basisu (KTX-Software), which is not
installed here; three.js builds the mipmaps from the WebP on upload.
"""
import os
import subprocess
import tempfile

from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
PDF = os.path.join(ROOT, "tools/3d/source/labels/label-herbal-black-salt.pdf")
OUT = os.path.join(ROOT, "public/textures")
# The artwork inside the page, as fractions of the page (measured at 8800 px: 200..8599 x
# 251..2406 of 8800 x 2658).
CROP = (200 / 8800, 251 / 2658, 8600 / 8800, 2407 / 2658)
SIZES = (4096, 8192)


def main():
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        page_w = round(max(SIZES) / (CROP[2] - CROP[0]) * 1.05)  # a little oversampled
        base = os.path.join(tmp, "page")
        subprocess.run(
            ["pdftocairo", "-png", "-singlefile", "-scale-to-x", str(page_w), "-scale-to-y", "-1", PDF, base],
            check=True,
        )
        page = Image.open(base + ".png").convert("RGB")
        w, h = page.size
        art = page.crop((round(CROP[0] * w), round(CROP[1] * h), round(CROP[2] * w), round(CROP[3] * h)))
        aspect = art.height / art.width
        for size in SIZES:
            out = art.resize((size, round(size * aspect)), Image.LANCZOS)
            path = os.path.join(OUT, f"label-herbal-black-salt-{size}.webp")
            out.save(path, "WEBP", quality=90, method=6)
            print(os.path.relpath(path, ROOT), out.size, f"{os.path.getsize(path) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
