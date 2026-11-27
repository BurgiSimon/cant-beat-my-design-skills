#!/usr/bin/env python3
"""Writes the product cards into index.html (between the <!-- cards --> markers) from the list below.
   python3 offform/tools/cards.py"""
import pathlib, re, html
ROOT = pathlib.Path(__file__).resolve().parent.parent
P = [
  # id, name, price, sub, cat, image, swatches [(name, hex)], more, search words, badge, recolour mode
  # (modes, see js/shop.js: dark = repaint the dark garment only; accent = only its coloured parts; hue = what shares
  #  the garment's own hue; solid = the whole object)
  ("velocity-shell", "Velocity Shell", 245, "Ultralight / Water repellent", "clothing", "p-shell",
   [("Black", "#161616"), ("Graphite", "#77787a"), ("Signal orange", "#e5491f")], "+3 colors", "jacket shell hood waterproof rain reflective black", "New", "dark"),
  ("transit-cargo", "Transit Cargo", 165, "4-way stretch / Relaxed fit", "clothing", "p-cargo",
   [("Olive", "#6f725a"), ("Black", "#161616")], "+2 colors", "trousers pants cargo stretch olive", "", "hue"),
  ("aero-form-01", "Aero Form 01", 195, "Everyday performance / Unisex", "footwear", "p-sneaker",
   [("Cloud", "#d3d3cf"), ("Black", "#161616"), ("Signal orange", "#e5491f")], "+3 colors", "sneaker shoe trainer running reflective", "", "accent"),
  ("motion-long-sleeve", "Motion Long Sleeve", 85, "Quick-dry / Second-skin feel", "clothing", "p-longsleeve",
   [("Signal orange", "#f0782f"), ("Black", "#161616"), ("Bone", "#dedbd3")], "+3 colors", "top shirt long sleeve running orange", "Bestseller", "hue"),
  ("shield-sunglasses", "Shield Sunglasses", 120, "Cat. 3 lens / 26 g", "accessories", "p-extra-2",
   [("Bronze", "#9c7a45"), ("Black", "#161616")], "+2 colors", "sunglasses glasses shades shield", "", "solid"),
  ("stride-tight", "Stride Tight 3/4", 70, "Compressive / Zip pocket", "clothing", "p-extra-6",
   [("Black", "#161616"), ("Graphite", "#77787a")], "+2 colors", "tights leggings running black", "", "dark"),
  ("aero-form-02", "Aero Form 02", 210, "Night runner / Reflective heel", "footwear", "p-extra-1",
   [("Midnight", "#1c2235"), ("Black", "#161616"), ("Signal orange", "#e5491f")], "+3 colors", "sneaker shoe trainer running black reflective", "New", "dark"),
  ("thermal-base-layer", "Thermal Base Layer", 95, "Merino blend / Thumb loops", "clothing", "p-extra-4",
   [("Graphite", "#6f6e73"), ("Black", "#161616"), ("Bone", "#dedbd3")], "+3 colors", "base layer long sleeve top merino grey", "", "dark"),
  ("transit-sling", "Transit Sling", 75, "2L / Water resistant", "accessories", "p-extra-5",
   [("Black", "#161616"), ("Olive", "#6f725a")], "+2 colors", "bag sling crossbody black", "", "dark"),
  ("transit-pack", "Transit Pack 18L", 140, "Padded back / Bottle pocket", "accessories", "p-extra-3",
   [("Black", "#161616"), ("Olive", "#6f725a")], "+2 colors", "bag backpack pack black", "Low stock", "dark"),
]
SIZES = {"clothing": ["XS", "S", "M", "L", "XL"], "footwear": ["7", "8", "9", "10", "11"], "accessories": ["One size"]}
out = []
for (pid, name, price, sub, cat, slot, sws, more, tags, badge, mode) in P:
    e = html.escape
    sw = "".join(
        f'<button class="card__sw" type="button" style="--c:{c}" aria-pressed="{"true" if i == 0 else "false"}" aria-label="{e(n)}" data-colour="{e(n)}" data-hex="{c}"></button>'
        for i, (n, c) in enumerate(sws))
    sizes = "".join(f'<button class="card__size" type="button" data-size="{s}" aria-label="Add {e(name)}, size {s}">{s if s != "One size" else "Add"}</button>' for s in SIZES[cat])
    bdg = f'<span class="card__badge label{" card__badge--orange" if badge == "New" else ""}">{badge}</span>' if badge else ""
    out.append(f'''          <li class="card" data-id="{pid}" data-name="{e(name)}" data-price="{price}" data-cat="{cat}" data-tags="{tags}" data-mode="{mode}">
            <div class="card__media" data-cursor="Quick add">
              <img src="assets/img/{slot}.webp" width="640" height="732" alt="{e(name)}, {sws[0][0].lower()}" loading="lazy" decoding="async" />{bdg}
            </div>
            <div class="card__quick" role="group" aria-label="Quick add {e(name)}"><span class="label">Quick add</span>{sizes}</div>
            <div class="card__info">
              <h3 class="card__name">{e(name)} / <span class="card__price">${price}</span></h3>
              <span class="card__sub label">{e(sub)}</span>
              <div class="card__swatches" role="group" aria-label="Colour">{sw}<span class="card__more label">{more}</span></div>
            </div>
          </li>''')
f = ROOT / "index.html"
s = f.read_text()
s = re.sub(r"(<ul class=\"shop__list\"[^>]*>\n).*?(\n        </ul>)", lambda m: m.group(1) + "          <!-- cards: written by tools/cards.py -->\n" + "\n".join(out) + m.group(2), s, flags=re.S)
f.write_text(s)
print(len(P), "cards;", {c: sum(1 for p in P if p[4] == c) for c in SIZES})
