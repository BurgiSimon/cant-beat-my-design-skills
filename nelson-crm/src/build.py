#!/usr/bin/env python3
"""Build index.html (assets referenced) and nelson-standalone.html (everything inlined).

CSS values written as `Nu` are design pixels at 1440px; they become calc(N * var(--u)).
"""
import base64, mimetypes, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"

def u(n):
    return f"calc({n} * var(--u))"

def expand_units(css):
    return re.sub(r"(?<![\w#.\-])(-?\d*\.?\d+)u\b", lambda m: u(m.group(1)), css)

# ---------------- generated fragments ----------------
LOGOS = [  # file, width, height, x-offset from cell centre, y-offset
    ("calendly", 100.0, 26.5, -21.0, 1.7),
    ("github", 95.6, 26.5, -13.5, 2.1),
    ("basecamp", 116.7, 27.5, 2.8, 2.1),
    ("attentive", 103.4, 20.1, 3.9, 1.9),
    ("gumroad", 106.4, 16.7, 4.6, 3.1),
    ("intercom", 111.8, 29.9, 4.8, 2.4),
]
CLAY_SVG = (
    '<svg viewBox="0 0 92 26" style="width:{w};height:{h};transform:translate({x},{y})" role="img" aria-label="clay">'
    '<g fill="none" stroke="#7c7c7c" stroke-width="3.2" stroke-linecap="round">'
    '<path d="M12.5 7.2H9.2a5.8 5.8 0 0 0 0 11.6h3.6"/><path d="M9.6 13h8.4a5.8 5.8 0 0 0 0-11.6h0"/>'
    '<path d="M18 13a5.8 5.8 0 0 1 0 11.6h-3.4"/></g>'
    '<text x="32" y="19.5" fill="#7c7c7c" font-family="Poppins, Inter, sans-serif" font-weight="500" font-size="19" letter-spacing=".6">clay</text></svg>'
)

def logos_html():
    cells = []
    for name, w, h, dx, dy in LOGOS:
        cells.append(
            f'<div class="logo-cell"><img src="assets/logo-{name}.png" alt="{name.capitalize()}" '
            f'style="width:{u(w)};height:{u(h)};transform:translate({u(dx)},{u(dy)})"></div>'
        )
    cells.append('<div class="logo-cell">' + CLAY_SVG.format(w=u(92), h=u(26), x=u(-38), y=u(2)) + "</div>")
    first = "\n    ".join(cells)
    # the second set only exists for the seamless loop: hide each whole cell from AT
    # (the clay logo is an inline <svg role="img"> with aria-label, not an <img alt>)
    dup = "\n    ".join(c.replace('<div class="logo-cell">', '<div class="logo-cell" aria-hidden="true">', 1) for c in cells)
    return first + "\n    " + dup

BAR_X = [15, 58.6, 101.7, 144.8, 188.5, 232, 275]
BAR_H = [21, 71, 92, 122, 92, 71, 71]
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

def bars_html():
    out = []
    for i, (x, h) in enumerate(zip(BAR_X, BAR_H)):
        cls = "bar on" if i == 2 else "bar"
        out.append(f'<span class="{cls}" style="left:{u(x)};height:{u(h)}"></span>')
    for x, d in zip(BAR_X, DAYS):
        out.append(f'<span class="day" style="left:{u(x)}">{d}</span>')
    return "\n        ".join(out)

COLS = [(240.0, 35.3, 40.7, "32.5"), (280.7, 34.3, 61.8, "45.5"), (320.4, 34.8, 78.5, "75.5"), (360.6, 39.7, 100.5, "92.5")]
MONTHS = ["Apr", "May", "Jun", "Jul"]

def cols_html():
    out = []
    for i, (x, w, h, v) in enumerate(COLS):
        cls = "col hot" if i == 3 else "col"
        out.append(f'<span class="{cls}" style="left:{u(x)};width:{u(w)};height:{u(h)}"><span>{v}<br>%</span></span>')
    for (x, w, _, _), m in zip(COLS, MONTHS):
        out.append(f'<span class="month" style="left:{u(x + w / 2 - 20)}">{m}</span>')
    return '<div aria-hidden="true">\n        ' + "\n        ".join(out) + "\n      </div>"

# ---------------- assemble ----------------
import argparse, json
ap = argparse.ArgumentParser()
ap.add_argument("--only", default=None, help="comma-separated fx modules to include (default: all present)")
ap.add_argument("--out", default="index.html", help="output file name, written next to assets/ (project root)")
ap.add_argument("--no-standalone", action="store_true")
args = ap.parse_args()

VENDOR = ["gsap.min.js", "ScrollTrigger.min.js", "SplitText.min.js", "lenis.min.js"]
FX_ORDER = ["nav", "cursor", "marquee", "reveals", "live", "hero-gl", "ascii", "intro"]
FX = SRC / "fx"
present = [m for m in FX_ORDER if (FX / f"{m}.js").exists() or (FX / f"{m}.css").exists()]
mods = present if args.only is None else [m for m in FX_ORDER if m in args.only.split(",") and m in present]

css = (SRC / "style.css").read_text()
css += "\n/* ===== vendor: lenis ===== */\n" + (ROOT / "vendor" / "lenis.css").read_text()
for m in mods:
    p = FX / f"{m}.css"
    if p.exists():
        css += f"\n/* ===== fx: {m} ===== */\n" + p.read_text()
css = expand_units(css)

def inline(js, name):
    return f'<script data-src="{name}">\n{js}\n</script>'

scripts = [f'<script src="vendor/{v}"></script>' for v in VENDOR]
scripts.append(inline((FX / "core.js").read_text(), "fx/core.js"))
scripts.append(inline((SRC / "app.js").read_text(), "app.js"))
for m in mods:
    p = FX / f"{m}.js"
    if p.exists():
        scripts.append(inline(p.read_text(), f"fx/{m}.js"))

html = (SRC / "index.html").read_text()
html = (html.replace("/*__CSS__*/", css)
            .replace("<!--__SCRIPTS__-->", "\n".join(scripts))
            .replace("<!--__LOGOS__-->", logos_html())
            .replace("<!--__BARS__-->", bars_html())
            .replace("<!--__COLS__-->", cols_html()))
out = ROOT / args.out
out.write_text(html)
msg = f"built {out.name} ({len(html)/1024:.0f} KB) modules={mods}"

if not args.no_standalone and args.out == "index.html":
    def data_uri(rel):
        p = ROOT / rel
        mt = mimetypes.guess_type(p.name)[0] or ("font/woff2" if p.suffix == ".woff2" else "application/octet-stream")
        return f"data:{mt};base64," + base64.b64encode(p.read_bytes()).decode()
    solo = re.sub(r'<script src="(vendor/[^"]+)"></script>', lambda m: "<script>\n" + (ROOT / m.group(1)).read_text() + "\n</script>", html)
    solo = re.sub(r"url\(((?:assets|fonts)/[^)]+)\)", lambda m: f"url({data_uri(m.group(1))})", solo)
    solo = re.sub(r'src="((?:assets|fonts)/[^"]+)"', lambda m: f'src="{data_uri(m.group(1))}"', solo)
    # string literals in JS that point at assets (e.g. 'assets/hero-mask.png') -> data URIs
    solo = re.sub(r"(['\"])((?:assets|fonts)/[\w.\-]+\.(?:png|jpe?g|webp|woff2))\1", lambda m: m.group(1) + data_uri(m.group(2)) + m.group(1), solo)
    (ROOT / "nelson-standalone.html").write_text(solo)
    msg += f"; standalone {len(solo)/1024/1024:.2f} MB"
print(msg)
