"""Build the section photos in assets/photos/ from the generated originals.

usage: python3 tools/make-photos.py <folder with the original PNGs> [slot ...]

Each slot is written twice: an AVIF (what most browsers load) and a WebP (for the few that cannot read AVIF).
The generator leaves a sparkle mark in the bottom-right corner, so the bottom band is cropped off first.
Sizes are matched to how large each slot is shown on a sharp (2x) screen; anything bigger only costs download time.
"""
import os, sys
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "photos")
AVIF_Q, WEBP_Q = 58, 80
BAND = 184  # the sparkle sits inside the bottom 184px

# slot: (original file name, width, height)
SLOTS = {
    "month-01": ("witch hazel in frost by the east gate.png", 1080, 1350),
    "month-02": ("snowdrops under the oaks in Moss Hollow.png", 1080, 1350),
    "month-03": ("daffodils along the top of Long Meadow.png", 1080, 1350),
    "month-04": ("bluebells under the beeches.png", 1080, 1350),
    "month-05": ("wisteria on the Walled Garden's south wall.png", 1080, 1350),
    "month-06": ("foxgloves at the edge of the wood.png", 1080, 1350),
    "month-07": ("lavender walk at midday.png", 1080, 1350),
    "month-08": ("water lilies open on the middle pond.png", 1080, 1350),
    "month-09": ("asters with bees, Walled Garden borders.png", 1080, 1350),
    "month-10": ("red maples over Fern Gully.png", 1080, 1350),
    "month-11": ("moss on the north wall after rain.png", 1080, 1350),
    "month-12": ("frosted seedheads at sunrise.png", 1080, 1350),
    "visit-gate": ("the east gate.png", 1080, 1350),
    "member-meadow": ("Mist over Long Meadow.png", 1080, 1350),
    "member-card": ("Member card on a bench.png", 640, 640),
    "journal-hands-moss": ("gardener's hands on a mossy stone.png", 1800, 1200),
    "journal-snowdrops": ("Planting 4,000 snowdrops in one weekend.png", 480, 480),
    "journal-ice-lilies": ("The pond lilies are resting, and so are we.png", 480, 480),
    "north-wall": ("the north wall (full screen).png", 2400, None),
    "grounds-map": ("illustrated map.png", 1600, 1280),
}

def ratio_crop(im, box, r):
    x0, y0, x1, y1 = box; w, h = x1 - x0, y1 - y0
    if w / h > r: nw = round(h * r); x0 += (w - nw) // 2; x1 = x0 + nw
    else: nh = round(w / r); y0 += (h - nh) // 2; y1 = y0 + nh
    return im.crop((x0, y0, x1, y1))

def build(src, slot):
    name, w, h = SLOTS[slot]
    im = Image.open(os.path.join(src, name)).convert("RGB"); W, H = im.size
    if slot == "grounds-map":  # trim the paper margin around the drawing
        im = im.crop((140, 110, 140 + 1975, 110 + 1580))
    elif h is None:  # full-width: keep the whole picture above the band
        im = im.crop((0, 0, W, H - BAND)); h = round(w * (H - BAND) / W)
    else:
        im = ratio_crop(im, (0, 0, W, H - BAND), w / h)
    im = im.resize((w, h), Image.LANCZOS)
    for ext, opts in (("avif", dict(quality=AVIF_Q, speed=3)), ("webp", dict(quality=WEBP_Q, method=6))):
        path = os.path.join(OUT, f"{slot}.{ext}")
        im.save(path, **opts)
        print(f"{slot}.{ext}", im.size, os.path.getsize(path) // 1024, "KB")

if __name__ == "__main__":
    src, slots = sys.argv[1], sys.argv[2:] or list(SLOTS)
    for s in slots: build(src, s)
