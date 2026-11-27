#!/usr/bin/env python3
"""Grades and crops the stand-in photographs into offform/assets/img/.

    python3 offform/tools/photos.py <folder with the source photos>

The sources are the full-size downloads listed in offform/CREDITS.md, saved as <slot>.jpg (hero-sprint.jpg, p-shell.jpg,
...). They are not kept in the repo; this script is how the published images were made from them.

- The hero pair is graded to the shot's orange with a ramp on lightness taken relative to each photo's own wall, so
  black clothes stay near black and any plain wall becomes the same orange; the backgrounds are padded out with their
  own colour so a portrait frame can fill a landscape half.
- After Hours is keyed off its white backdrop (with the edges un-mixed from the white) so the subject stands on the
  section's own gradient, as in the shot.
- Product shots are multiplied onto the shot's warm-grey tile, so every backdrop lands on the same colour.
Needs Pillow, numpy and scipy.
"""
import sys, pathlib
import numpy as np
from PIL import Image, ImageOps, ImageFilter
from scipy import ndimage

SRC = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "img"
TILE = np.array([220, 216, 207], dtype=np.float32)  # --tile: #dcd8cf
Q = 80


def load(name):
    return Image.open(SRC / f"{name}.jpg").convert("RGB")


def save(im, name, q=Q, size=None):
    if size:
        im = im.resize(size, Image.LANCZOS)
    im.save(OUT / f"{name}.webp", "WEBP", quality=q, method=6)
    print(f"  {name}.webp {im.size[0]}x{im.size[1]}")


def arr(im):
    return np.asarray(im).astype(np.float32)


def img(a):
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA" if a.shape[2] == 4 else "RGB")


def bg_of(im):
    a = arr(im)
    h, w, _ = a.shape
    p = [a[4:24, 4:24], a[4:24, w - 24:w - 4], a[h - 24:h - 4, 4:24], a[h - 24:h - 4, w - 24:w - 4]]
    return np.median(np.stack([x.reshape(-1, 3).mean(0) for x in p]), axis=0)


def fit(im, box, aspect, fill):
    """Crop box (x0, y0, x1, y1) widened or heightened to the aspect, padding with fill where it leaves the photo."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    if w / h < aspect:
        nw = h * aspect; x0 -= (nw - w) / 2; x1 = x0 + nw
    else:
        nh = w / aspect; y0 -= (nh - h) / 2; y1 = y0 + nh
    x0, y0, x1, y1 = map(round, (x0, y0, x1, y1))
    canvas = Image.new("RGB", (x1 - x0, y1 - y0), tuple(int(v) for v in fill))
    canvas.paste(im, (-x0, -y0))
    return canvas


# ---- the hero grade: lightness relative to the wall, through the shot's ramp ----
RAMP = [
    (0.00, (10, 12, 13)),
    (0.14, (24, 14, 12)),
    (0.32, (70, 20, 12)),
    (0.55, (140, 34, 17)),
    (0.80, (196, 52, 26)),
    (1.00, (224, 70, 31)),
    (1.16, (242, 104, 62)),
    (1.45, (255, 178, 140)),
]


def grade(im, wall):
    a = arr(im)
    lum = a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    wl = float(np.dot(wall, [0.2126, 0.7152, 0.0722]))
    t = lum / max(wl, 1.0)
    xs = np.array([p[0] for p in RAMP]); cs = np.array([p[1] for p in RAMP], dtype=np.float32)
    out = np.stack([np.interp(t, xs, cs[:, k]) for k in range(3)], axis=-1)
    # keep a trace of the photo's own colour in skin and shoes, so it reads as a photo under red light, not a print
    sat = (a.max(-1) - a.min(-1)) / np.maximum(a.max(-1), 1)
    keep = np.clip((sat - 0.12) / 0.4, 0, 1)[..., None] * 0.22
    warm = a * np.array([1.0, 0.55, 0.45], dtype=np.float32)
    return out * (1 - keep) + warm * keep


def flatten(im):
    """Even out a paper backdrop's fall-off: fit a smooth surface (a cubic in x and y) to the backdrop alone, then
    divide it out, so the frame can be padded with one flat colour."""
    a = arr(im)
    small = arr(im.resize((im.width // 8, im.height // 8), Image.BILINEAR))
    h, w, _ = small.shape
    lum = small.mean(-1)
    m = (lum >= np.percentile(lum, 35)) & ((small.max(-1) - small.min(-1)) < 30)
    m = ndimage.binary_erosion(m, iterations=6)
    if m.sum() < 200 or np.percentile(lum[m], 50) > 250:
        return im  # a seamless already white: nothing to even out
    yy, xx = np.mgrid[0:h, 0:w]
    def basis(x, y):
        x = x / w * 2 - 1; y = y / h * 2 - 1
        return np.stack([np.ones_like(x), x, y, x * x, x * y, y * y, x ** 3, x * x * y, x * y * y, y ** 3], -1)
    A = basis(xx[m].astype(np.float32), yy[m].astype(np.float32))
    coef = np.linalg.lstsq(A, small[m], rcond=None)[0]
    H, W = a.shape[:2]
    Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
    est = basis(X / 8, Y / 8) @ coef
    target = np.percentile(est.reshape(-1, 3), 90, axis=0)
    return img(a * (target / np.maximum(est, 1)))


def vignette(a, left=0.0, right=0.0, top=0.0, strength=0.5):
    h, w, _ = a.shape
    x = np.linspace(0, 1, w)[None, :]
    y = np.linspace(0, 1, h)[:, None]
    m = np.ones((h, w), dtype=np.float32)
    if left: m *= 1 - strength * np.clip(1 - x / left, 0, 1) ** 1.6
    if right: m *= 1 - strength * np.clip(1 - (1 - x) / right, 0, 1) ** 1.6
    if top: m *= 1 - strength * 0.6 * np.clip(1 - y / top, 0, 1) ** 1.6
    return a * m[..., None]


def hero():
    # the sprinter: mirrored so she runs into the page, cropped in close, the wall to orange, the left edge in shadow
    im = ImageOps.mirror(load("hero-sprint"))
    wall = arr(im)[200:420, 1500:2300].reshape(-1, 3).mean(0)
    c = fit(im, (118, 262, 1490, 1482), 1440 / 1280, wall)
    g = grade(c, wall)
    g = vignette(g, left=0.42, top=0.5, strength=0.55)
    out = img(g).resize((1440, 1280), Image.LANCZOS)
    save(out, "hero-sprint")
    save(img(g).crop((0, 0, c.width, c.height)).resize((1440, 1280)).crop((180, 40, 1140, 1240)), "hero-sprint-sm", size=(600, 750))

    # the man who stands still: a portrait frame padded out with its own wall to fill the right half
    im = flatten(load("hero-stand"))
    wall = arr(im)[200:500, 150:600].reshape(-1, 3).mean(0)
    c = fit(im, (-414, 429, 2658, 3160), 1440 / 1280, wall)
    # the paper backdrop falls off toward the floor: flatten it to one wall before grading
    g = grade(c, wall)
    g = vignette(g, right=0.3, top=0.45, strength=0.35)
    save(img(g), "hero-stand", size=(1440, 1280))


def after():
    # keyed off white: the backdrop is what is connected to the frame's edge and near white
    im = ImageOps.mirror(load("after-hours-alt"))
    a = arr(im)
    bg = np.array([255, 252, 250], dtype=np.float32)
    d = (bg[None, None, :] - a).max(-1) / 255.0          # how far below the white each pixel is
    near = d < 0.075
    lab, n = ndimage.label(near)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    backdrop = np.isin(lab, list(edge))
    # a soft edge: distance into the subject, plus how far from white the pixel is
    soft = np.clip((d - 0.02) / 0.16, 0, 1)
    alpha = np.where(backdrop, 0.0, 1.0)
    alpha = ndimage.gaussian_filter(alpha, 1.2)
    alpha = np.maximum(alpha * soft, np.where(backdrop, 0, 1) * 0)
    alpha = np.where(backdrop & (soft < 0.5), alpha * soft, alpha)
    alpha = np.clip(alpha, 0, 1)
    # un-mix the white out of the edges
    al = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.clip((a - (1 - al) * bg) / al, 0, 255)
    rgba = np.dstack([rgb, alpha * 255])
    # crop: head near the top of the frame, 700 x 870 design px
    h, w = alpha.shape
    rows = np.where(alpha.max(1) > 0.5)[0]
    top = max(0, rows[0] - 110)
    ch = int(w / (700 / 870))
    crop = img(rgba).crop((0, top, w, min(h, top + ch)))
    if crop.height < ch:
        pad = Image.new("RGBA", (w, ch), (0, 0, 0, 0)); pad.paste(crop, (0, 0)); crop = pad
    crop = crop.resize((1400, 1740), Image.LANCZOS)
    ca = arr(crop)
    ca = clone(ca, (105, 1190, 345, 1350), dx=40, dy=175)
    crop = img(ca)
    save(crop, "after-hours", q=82)
    # for the Explore panel: on the section's gradient
    grad = np.zeros((1740, 1400, 3), dtype=np.float32)
    stops = [(0, (6, 8, 9)), (0.2, (27, 11, 9)), (0.4, (71, 23, 13)), (0.6, (128, 40, 20)), (0.8, (185, 56, 26)), (1, (239, 74, 33))]
    ys = np.linspace(0, 1, 1740)
    for k in range(3):
        grad[..., k] = np.interp(ys, [s[0] for s in stops], [s[1][k] for s in stops])[:, None]
    sub = arr(crop.resize((1400, 1740), Image.LANCZOS).convert("RGBA"))
    comp = grad * (1 - sub[..., 3:] / 255) + sub[..., :3] * (sub[..., 3:] / 255)
    save(img(comp).crop((0, 120, 1400, 1870 - 120)), "after-hours-sm", size=(600, 750))


def patch(a, boxes):
    """Paint regions out (a maker's logo) with the cloth around them: a fill from the surroundings, plus grain."""
    a = a.copy()
    for (x0, y0, x1, y1) in boxes:
        m = np.zeros(a.shape[:2], dtype=np.float32); m[y0:y1, x0:x1] = 1
        keep = 1 - m
        sig = max(x1 - x0, y1 - y0) * 0.6
        num = ndimage.gaussian_filter(a[..., :3] * keep[..., None], (sig, sig, 0))
        den = ndimage.gaussian_filter(keep, sig)[..., None]
        fill = num / np.maximum(den, 1e-3)
        rng = np.random.default_rng(7)
        fill += rng.normal(0, 2.2, fill.shape)
        soft = ndimage.gaussian_filter(m, 4)[..., None]
        a[..., :3] = a[..., :3] * (1 - soft) + fill * soft
    return a


def clone(a, box, dx=0, dy=0, feather=14):
    """Cover a region with the same cloth from nearby (a clone stamp with a feathered edge), alpha left as it was."""
    a = a.copy()
    x0, y0, x1, y1 = box
    m = np.zeros(a.shape[:2], dtype=np.float32); m[y0:y1, x0:x1] = 1
    m = ndimage.gaussian_filter(m, feather)[..., None]
    shifted = np.roll(np.roll(a[..., :3], -dy, axis=0), -dx, axis=1)
    a[..., :3] = a[..., :3] * (1 - m) + shifted * m
    return a


def product(name, src, box, patches=()):
    im = flatten(load(src))
    bg = np.percentile(arr(im).reshape(-1, 3), 92, axis=0)
    c = fit(im, box, 640 / 732, bg)
    a = arr(c) * (TILE / bg)[None, None, :]
    out = img(a).resize((640, 732), Image.LANCZOS)
    if patches:
        out = img(patch(arr(out), patches))
    save(out, name)


def products():
    product("p-shell", "p-shell", (640, 760, 1880, 2185), patches=[(262, 52, 392, 98)])
    product("p-sneaker", "p-sneaker", (220, 420, 2060, 2560))
    product("p-longsleeve", "p-longsleeve", (430, 700, 1570, 1960))
    product("p-extra-1", "p-extra-1", (300, 120, 2200, 1400))      # dark runner (Aero Form 02)
    product("p-extra-2", "p-extra-2", (40, 0, 2240, 1598))         # shield sunglasses
    product("p-extra-3", "p-extra-3", (520, 760, 2100, 2760))      # backpack
    product("p-extra-4", "p-extra-4", (330, 860, 1550, 2250))      # base layer
    product("p-extra-5", "p-extra-5", (420, 760, 2080, 2660))      # sling
    product("p-extra-6", "p-extra-6", (0, 0, 2400, 2740))          # tights


def cargo():
    # an on-model tile: the olive cargo on its own warm backdrop (a cut-out never looked right), lifted a little so it
    # sits with the light tiles beside it; cropped above the shoes
    im = load("p-cargo")
    c = fit(im, (0, 120, 2400, 2860), 640 / 732, (91, 84, 75))
    a = arr(c)
    a = 255 * (1 - (1 - a / 255) ** 1.35)          # open the shadows
    a = a * np.array([1.02, 1.0, 0.97], dtype=np.float32)
    save(img(a), "p-cargo", size=(640, 732))


def scenes():
    # performance: under the bridge, dark and cool, the runner kept bright
    im = load("pace-performance-alt")
    c = fit(im, (0, 500, 2400, 3300), 1600 / 1400, (10, 10, 10))
    a = arr(c)
    a = np.clip((a - 8) * 1.08, 0, 255)
    gray = a.mean(-1, keepdims=True)
    a = a * 0.75 + gray * 0.25
    save(img(a), "pace-performance", size=(1600, 1400))
    save(img(a).crop((300, 0, 1300, 1250)), "pace-performance-sm", size=(600, 750))
    # everyday: warm stone, kept as it is, framed on the man
    im = load("pace-everyday")
    c = fit(im, (0, 600, 2400, 2900), 1600 / 1400, (180, 170, 160))
    save(c, "pace-everyday", size=(1600, 1400))
    save(c.crop((500, 0, 1900, 1750)), "pace-everyday-sm", size=(600, 750))
    # run club: four moods, toned toward the page (a little less colour, a little more contrast)
    for out, src, box in [("club-1", "club-1", (500, 0, 1780, 1600)), ("club-2", "club-2", (0, 900, 2400, 3600)),
                          ("club-3", "club-3", (300, 300, 2100, 2550)), ("club-4", "club-1-alt", (0, 300, 2400, 3000))]:
        im = load(src)
        c = fit(im, box, 600 / 750, (0, 0, 0))
        a = arr(c)
        gray = a.mean(-1, keepdims=True)
        a = np.clip((a * 0.82 + gray * 0.18 - 128) * 1.06 + 128, 0, 255)
        save(img(a), f"{out}-sm", size=(600, 750))


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    only = set(sys.argv[2:])
    jobs = {"hero": hero, "after": after, "products": products, "cargo": cargo, "scenes": scenes}
    for k, fn in jobs.items():
        if not only or k in only:
            print(k); fn()
