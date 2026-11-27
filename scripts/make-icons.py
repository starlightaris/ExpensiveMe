"""Generate the app icons in public/ from design/logo.jpg (square, solid background).

Usage: python scripts/make-icons.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "design" / "logo.jpg"
OUT = ROOT / "public"

SIZES = {
    "pwa-192.png": 192,
    "pwa-512.png": 512,
    # the symbol already sits inside the central safe zone, so the same art works when masked
    "pwa-maskable-512.png": 512,
    "apple-touch-icon.png": 180,
    "favicon-64.png": 64,
    "logo-96.png": 96,  # small header mark
}

img = Image.open(SRC).convert("RGB")
w, h = img.size
if w != h:
    side = min(w, h)
    img = img.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))

for name, size in SIZES.items():
    icon = img.resize((size, size), Image.LANCZOS)
    # the art uses few flat colours; a 256-colour palette keeps it identical and much smaller
    icon = icon.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
    icon.save(OUT / name, optimize=True)
    print(f"{name:24} {size}x{size}  {(OUT / name).stat().st_size / 1024:.1f} KB")

print("background:", "#%02x%02x%02x" % img.getpixel((8, 8)))
