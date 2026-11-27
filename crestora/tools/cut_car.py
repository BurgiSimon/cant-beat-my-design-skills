# Cut the car out of the reference shot: a traced outline, its edge refined by colour (the light behind the car is
# saturated, the car is not), the dust at its rear faded out so the page's own dust can take over.
#
#   python3 -I crestora/tools/cut_car.py <shot.png> <out-dir> [outline.json]
#
# Writes car-1x.png (the shot's own px), car-2x.png (doubled and sharpened: encode it to assets/img/car.webp) and
# car-preview.png (on magenta, to check the edge). The car sits at design px (566, 562)–(1140, 752); js/scene.js knows.
import sys, json
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import numpy as np

src, out_dir = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
W, H = im.size

POLY = [
 (574,712),(571,700),(571,688),(574,676),(576,664),(578,655),(584,648),(600,644),(630,640),(660,636),(690,632),(715,628),
 (730,618),(750,600),(768,584),(783,574),(800,570),(830,568),(860,568),(885,569),(910,572),(935,576),(958,581),(978,588),
 (995,597),(1010,606),(1030,614),(1050,620),(1068,625),(1085,627),(1091,632),(1093,637),(1098,642),(1109,649),(1119,658),
 (1125,667),(1128,677),(1129,685),(1125,690),(1120,694),(1100,705),(1070,716),(1040,722),(1000,728),(960,728),(940,726),
 (938,715),(930,732),(915,743),(895,748),(875,746),(860,738),(852,724),(848,710),(840,728),(760,729),(680,728),(655,726),
 (650,735),(642,742),(628,745),(611,744),(603,734),(600,722),(592,718),(580,716),
]
if len(sys.argv) > 3:
    POLY = [tuple(p) for p in json.load(open(sys.argv[3]))]

SS = 4  # supersampled polygon for a clean edge
m = Image.new('L', (W * SS, H * SS), 0)
ImageDraw.Draw(m).polygon([(x * SS, y * SS) for x, y in POLY], fill=255)
poly = np.asarray(m.resize((W, H), Image.LANCZOS)).astype(float) / 255

a = np.asarray(im).astype(float) / 255
mx, mn = a.max(2), a.min(2)
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
luma = a @ np.array([0.2126, 0.7152, 0.0722])
# background-likeness: bright and saturated (the light), or bright and pale (the dust)
bg = np.clip((sat * mx - 0.28) / 0.25, 0, 1)
dust = np.clip((luma - 0.55) / 0.2, 0, 1) * np.clip((0.35 - sat) / 0.2, 0, 1)
bg = np.maximum(bg, dust)
# only near the outline: the band within ~3px of the edge
inner = np.asarray(Image.fromarray((poly * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(7))).astype(float) / 255
edge = np.clip(poly - inner, 0, 1)
alpha = poly * (1 - edge * bg)
# the rear: the photo's dust and the dissolving bodywork fade out toward the back and the bottom
yy, xx = np.mgrid[0:H, 0:W]
rear = np.clip((xx - 1040) / 95, 0, 1) * np.clip((yy - 640) / 50, 0, 1)
alpha *= 1 - 0.85 * rear ** 1.3
low = np.clip((yy - 722) / 26, 0, 1) * np.clip((xx - 940) / 40, 0, 1)
alpha *= 1 - 0.9 * low
alpha = np.clip(alpha, 0, 1)

x0, y0, x1, y1 = 566, 562, 1140, 752
rgba = np.dstack([a, alpha])[y0:y1, x0:x1]
# un-premultiply the light from the edge: pull edge colours toward the car's own dark
rgb = rgba[..., :3]
k = (edge[y0:y1, x0:x1] * bg[y0:y1, x0:x1])[..., None]
rgb[:] = rgb * (1 - 0.7 * k) + 0.02 * 0.7 * k
img = Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), 'RGBA')
img.save(f'{out_dir}/car-1x.png')
up = img.resize((img.width * 2, img.height * 2), Image.LANCZOS)
r, g, b, al = up.split()
rgb_up = Image.merge('RGB', (r, g, b)).filter(ImageFilter.UnsharpMask(radius=1.6, percent=70, threshold=2))
up = Image.merge('RGBA', (*rgb_up.split(), al))
up.save(f'{out_dir}/car-2x.png')
print('crop', (x0, y0, x1, y1), img.size, up.size)
# preview over a checker of light + dark
prev = Image.new('RGB', img.size, (255, 0, 255))
prev.paste(img, (0, 0), img)
prev.resize((img.width * 2, img.height * 2), Image.NEAREST).save(f'{out_dir}/car-preview.png')
