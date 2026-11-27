// The road of light, traced off the shot. It is one ribbon of lanes, coloured across its width like a spectrum, that
// comes in from the left edge, pinches under the car and fans out again on the right: its upper half rises to the top
// right corner, its lower half sweeps down to the bottom right. Below it, faint road lines rise out of the bottom
// edge to the same pinch.
//
// Each ribbon is lofted between guides. A guide is one line of the ribbon (one colour boundary in the shot), given as
// points at the same stations from left to right; every lane in between is interpolated across the guides, so the
// lanes never cross. Coordinates are design px of the 1597 × 985 shot.

// [v, [x, y] × stations]. Stations: off the left edge, the left edge, 150, 300, 450, the car's nose, under its middle,
// the rear wheel, its tail, 1250, 1350, the right edge, off it. The lower guides turn downward after the pinch, so their later
// stations follow them down instead.
export const MAIN = {
  lanes: 210,
  neck: 6,                      // the station under the car, where u = 0
  // v is spread so the lanes stand evenly where they are widest apart, at the right edge
  guides: [
    [0.000, [[-300, 598], [5, 575], [150, 565], [300, 541], [450, 530], [560, 524], [740, 504], [850, 490], [1150, 442], [1250, 426], [1350, 410], [1590, 382], [1900, 348]]],
    [0.085, [[-300, 620], [5, 596], [150, 581], [300, 566], [450, 551], [560, 541], [740, 524], [850, 514], [1150, 490], [1250, 481], [1350, 476], [1590, 460], [1900, 440]]],
    [0.111, [[-300, 640], [5, 616], [150, 605], [300, 590], [450, 576], [560, 566], [740, 546], [850, 534], [1150, 510], [1250, 501], [1350, 496], [1590, 481], [1900, 462]]],
    [0.182, [[-300, 685], [5, 655], [150, 636], [300, 621], [450, 606], [560, 596], [740, 577], [850, 566], [1150, 550], [1250, 548], [1350, 541], [1590, 536], [1900, 530]]],
    [0.204, [[-300, 700], [5, 670], [150, 656], [300, 641], [450, 622], [560, 612], [740, 600], [850, 592], [1150, 578], [1250, 568], [1350, 561], [1590, 553], [1900, 545]]],
    [0.383, [[-300, 764], [5, 732], [150, 714], [300, 698], [450, 683], [560, 674], [740, 664], [850, 658], [1150, 652], [1250, 662], [1350, 672], [1590, 688], [1900, 700]]],
    [0.417, [[-300, 776], [5, 743], [150, 724], [300, 710], [450, 701], [560, 697], [740, 722], [850, 740], [1150, 736], [1250, 729], [1350, 723], [1590, 716], [1900, 712]]],
    // the lower half: under the car it hides behind the body and the wheels, and comes out past the rear wheel
    [0.534, [[-300, 779], [5, 747], [150, 728], [300, 714], [450, 705], [560, 701], [740, 726], [900, 752], [1150, 766], [1250, 771], [1350, 781], [1590, 806], [1900, 840]]],
    [0.573, [[-300, 791], [5, 758], [150, 738], [300, 723], [450, 711], [560, 705], [740, 728], [900, 758], [1150, 791], [1250, 796], [1350, 806], [1590, 836], [1900, 872]]],
    [0.612, [[-300, 804], [5, 770], [150, 747], [300, 729], [450, 717], [560, 709], [740, 731], [900, 764], [1150, 811], [1250, 821], [1350, 836], [1590, 866], [1900, 905]]],
    [0.638, [[-300, 816], [5, 780], [150, 753], [300, 734], [450, 723], [560, 713], [740, 734], [900, 770], [1150, 821], [1250, 836], [1350, 846], [1590, 886], [1900, 930]]],
    [0.793, [[-300, 834], [5, 797], [150, 769], [300, 746], [450, 731], [560, 722], [740, 742], [900, 834], [1150, 900], [1250, 925], [1350, 945], [1590, 1005], [1900, 1080]]],
    [0.922, [[-300, 869], [5, 827], [150, 797], [300, 775], [450, 751], [560, 740], [740, 746], [900, 842], [1150, 914], [1250, 940], [1350, 962], [1590, 1040], [1900, 1130]]],
    [1.000, [[-300, 889], [5, 845], [150, 803], [300, 778], [450, 754], [560, 742], [740, 749], [900, 848], [1150, 924], [1250, 952], [1350, 976], [1590, 1062], [1900, 1160]]],
  ],
  // the spectrum across the ribbon, sampled off the shot band by band. Stops sit at guide indices (5.5: half way from
  // the sixth guide to the seventh); a = how much light the lane carries
  palette: [
    [0.0, [0, 8, 36], 0.0],
    [0.35, [4, 30, 90], 0.8],
    [1.0, [12, 92, 210], 1],
    [2.0, [12, 122, 184], 1],
    [2.6, [16, 122, 134], 1],
    [3.0, [70, 124, 86], 1],
    [3.5, [228, 114, 62], 1],
    [4.0, [255, 62, 78], 1],
    [4.8, [250, 62, 70], 1],
    [4.97, [255, 100, 128], 1],
    [5.25, [255, 196, 236], 1],
    [5.7, [246, 226, 255], 1],
    [6.0, [64, 132, 250], 1],
    [6.8, [36, 120, 250], 1],
    [7.0, [56, 226, 244], 1],
    [8.0, [40, 208, 150], 1],
    [8.55, [130, 204, 100], 1],
    [9.0, [252, 162, 70], 1],
    [10.0, [255, 70, 56], 1],
    [10.85, [240, 44, 40], 1],
    [11.05, [26, 90, 236], 1],
    [11.8, [12, 72, 206], 0.95],
    [12.5, [6, 40, 130], 0.55],
    [13.0, [2, 16, 64], 0.0],
  ],
};

// The road under the car: nested arches, centred below the bottom edge. Their left legs come up out of the dark in
// the bottom left corner, faint; their right legs run on under the red, bright.
export const ROAD = {
  lanes: 90,
  neck: 4.6,
  dim: [0.28, 440, 800],       // left of x 440 the lines are at 0.28 of their light, full from x 800
  guides: [
    [0.0, [[190, 1110], [288, 985], [398, 893], [540, 828], [700, 796], [860, 812], [1050, 866], [1250, 930], [1462, 986], [1620, 1042]]],
    [0.5, [[500, 1150], [560, 1010], [640, 930], [730, 882], [830, 862], [940, 872], [1050, 906], [1170, 958], [1300, 1010], [1400, 1080]]],
    [1.0, [[800, 1200], [822, 1100], [852, 1052], [890, 1028], [932, 1020], [972, 1022], [1012, 1032], [1050, 1052], [1080, 1100], [1110, 1200]]],
  ],
  palette: [
    [0.0, [26, 92, 236], 0.0],
    [0.3, [28, 96, 240], 0.9],
    [0.6, [22, 82, 224], 0.95],
    [1.4, [16, 64, 196], 0.85],
    [2.0, [12, 50, 170], 0.7],
  ],
};

// ---- lofting ----

// Centripetal Catmull–Rom through a guide's stations, at station parameter s (0 … n-1).
function station(pts, s) {
  const n = pts.length;
  const i = Math.min(n - 2, Math.max(0, Math.floor(s)));
  const t = s - i;
  const p1 = pts[i], p2 = pts[i + 1];
  const p0 = pts[i - 1] || [2 * p1[0] - p2[0], 2 * p1[1] - p2[1]];
  const p3 = pts[i + 2] || [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]];
  const k = (a, b) => Math.max(1e-4, Math.hypot(b[0] - a[0], b[1] - a[1]) ** 0.5);
  const t0 = 0, t1 = t0 + k(p0, p1), t2 = t1 + k(p1, p2), t3 = t2 + k(p2, p3);
  const u = t1 + (t2 - t1) * t;
  const L = (a, b, ta, tb) => [((tb - u) * a[0] + (u - ta) * b[0]) / (tb - ta), ((tb - u) * a[1] + (u - ta) * b[1]) / (tb - ta)];
  const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
  const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
  return L(B1, B2, t1, t2);
}

// Monotone cubic (Fritsch–Carlson) through (vs, ys) at v: lanes between two guides stay between them.
function monotone(vs, ys, v) {
  const n = vs.length;
  let k = 0;
  while (k < n - 2 && v > vs[k + 1]) k++;
  const d = (i) => (ys[i + 1] - ys[i]) / (vs[i + 1] - vs[i]);
  const m = (i) => {
    if (i <= 0) return d(0);
    if (i >= n - 1) return d(n - 2);
    const a = d(i - 1), b = d(i);
    if (a * b <= 0) return 0;
    const h0 = vs[i] - vs[i - 1], h1 = vs[i + 1] - vs[i];
    const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
    return (w1 + w2) / (w1 / a + w2 / b);
  };
  const h = vs[k + 1] - vs[k];
  const t = Math.min(1.2, Math.max(-0.2, (v - vs[k]) / h));
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * ys[k] + (t3 - 2 * t2 + t) * h * m(k) + (-2 * t3 + 3 * t2) * ys[k + 1] + (t3 - t2) * h * m(k + 1);
}

/**
 * The ribbon as a grid mesh. Each vertex: x, y (design px), v (across), u (along, in lane spacings, 0 under the car:
 * a dash of fixed u-length looks the same size against its lanes wherever it is, so the dashes shrink and slow toward
 * the pinch as if it were far away), s (station parameter).
 */
export function loft(def, { cols = 360, rows = 120 } = {}) {
  const vs = def.guides.map((g) => g[0]);
  const n = def.guides[0][1].length;
  const v0 = vs[0], v1 = vs[vs.length - 1];
  const S = Float32Array.from({ length: cols }, (_, j) => (j / (cols - 1)) * (n - 1));
  // the guides at every column
  const gx = [], gy = [];
  for (let j = 0; j < cols; j++) {
    const ps = def.guides.map((g) => station(g[1], S[j]));
    gx.push(ps.map((p) => p[0]));
    gy.push(ps.map((p) => p[1]));
  }
  const at = (j, v) => [monotone(vs, gx[j], v), monotone(vs, gy[j], v)];
  const data = new Float32Array(rows * cols * 5);
  const eps = (v1 - v0) / rows / 2;
  const jn = Math.round((def.neck / (n - 1)) * (cols - 1));
  for (let r = 0; r < rows; r++) {
    const v = v0 + ((v1 - v0) * r) / (rows - 1);
    const P = [], spacing = [];
    for (let j = 0; j < cols; j++) {
      P.push(at(j, v));
      const a = at(j, v - eps), b = at(j, v + eps);
      spacing.push(Math.max(0.05, Math.hypot(b[0] - a[0], b[1] - a[1]) / (2 * eps) / def.lanes));
    }
    const U = new Float32Array(cols);
    for (let j = jn + 1; j < cols; j++) U[j] = U[j - 1] + Math.hypot(P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1]) / ((spacing[j] + spacing[j - 1]) / 2);
    for (let j = jn - 1; j >= 0; j--) U[j] = U[j + 1] - Math.hypot(P[j][0] - P[j + 1][0], P[j][1] - P[j + 1][1]) / ((spacing[j] + spacing[j + 1]) / 2);
    for (let j = 0; j < cols; j++) {
      const o = (r * cols + j) * 5;
      data[o] = P[j][0]; data[o + 1] = P[j][1]; data[o + 2] = v; data[o + 3] = U[j]; data[o + 4] = S[j];
    }
  }
  const index = new Uint32Array((rows - 1) * (cols - 1) * 6);
  let k = 0;
  for (let r = 0; r < rows - 1; r++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = r * cols + j, b = a + 1, c = a + cols, d = c + 1;
      index[k++] = a; index[k++] = c; index[k++] = b;
      index[k++] = b; index[k++] = c; index[k++] = d;
    }
  }
  return { data, index, range: [v0, v1], lanes: def.lanes, neck: def.neck, stations: n };
}

// A ribbon's palette as a 256 × 1 RGBA strip over its v range (alpha premultiplied into the colour).
export function paletteStrip(def, size = 256) {
  const vs = def.guides.map((g) => g[0]);
  const at = (g) => { const i = Math.min(vs.length - 2, Math.floor(g)); return vs[i] + (vs[i + 1] - vs[i]) * (g - i); };
  const stops = def.palette.map(([g, c, a]) => [at(g), c, a]);
  const out = new Uint8Array(size * 4);
  const v0 = stops[0][0], v1 = stops[stops.length - 1][0];
  for (let i = 0; i < size; i++) {
    const v = v0 + ((v1 - v0) * i) / (size - 1);
    let k = 0;
    while (k < stops.length - 2 && v > stops[k + 1][0]) k++;
    const [va, ca, aa] = stops[k], [vb, cb, ab] = stops[k + 1];
    const t = Math.min(1, Math.max(0, (v - va) / (vb - va)));
    const e = t * t * (3 - 2 * t);
    const a = aa + (ab - aa) * e;
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round((ca[c] + (cb[c] - ca[c]) * e) * a);
    out[i * 4 + 3] = Math.round(a * 255);
  }
  return out;
}
