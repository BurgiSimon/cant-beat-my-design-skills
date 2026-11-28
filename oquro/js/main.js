// Entry. Each part of the page is its own module; one that fails leaves the rest (and the page) working.
// The intro starts first so its dial turns while the 3D is built (in slices, yielding between them).

const load = async (name, arg, mod) => {
  try {
    const m = await (mod || import(`./${name}.js`));
    return await m.init?.(arg);
  } catch (e) {
    console.error(`[oquro] ${name}:`, e);
    const c = await import('./core.js');
    if (name === 'intro') { c.unlock(); c.markReady(); c.emit('hero:rise'); } // the page must still open
    if (name === 'hero3d' && c.last('hero:gl') === undefined) c.emit('hero:gl', null);   // (what waits for the hero goes on)
    return undefined;
  }
};

await Promise.all(['ui', 'nav', 'intro', 'water', 'hero3d'].map((n) => import(`./${n}.js`).catch(() => null)));
await load('ui');
load('nav');
load('intro');
load('water');
load('hero3d');
for (const name of ['reveals', 'live', 'layers', 'protect', 'monitor', 'field']) load(name);
// the small scenes' module is fetched now, with the rest, so that starting their build later takes no turn of its own
// (on slow frames, each turn a fetch or an import takes waits a whole frame)
const scenes = import('./scenes.js');
scenes.catch(() => {});   // (a failure is reported by load)
// the smaller 3D pictures are all below the fold: build them once the way in is done, the hero is built (its own build
// is in slices too, and a build of these beside it would put both off) and its entrance (about 2 s of it) has played,
// when the browser is idle
const core = await import('./core.js');
const idle = (fn) => { if ('requestIdleCallback' in window) requestIdleCallback(() => fn(), { timeout: 1500 }); else fn(); };
// the frame pace from now: the median interval between frames over the last second, the one still to come counted too
// (no frame at all, as in a hidden tab, is slow)
const meter = () => {
  const at = [performance.now()];
  let id = requestAnimationFrame(function f(t) { at.push(t); id = requestAnimationFrame(f); });
  return () => {
    cancelAnimationFrame(id);
    const now = performance.now(), iv = [now - at[at.length - 1]];
    for (let i = at.length - 1; i > 0 && at[i] > now - 1000; i--) iv.push(at[i] - at[i - 1]);
    return iv.sort((a, b) => a - b)[iv.length >> 1];
  };
};
core.once('intro:done', () => core.once('hero:gl', () => {
  const go = (arg) => load('scenes', arg, scenes);
  if (core.calm || !core.gl) { idle(go); return; }   // (nothing moves, or nothing to build)
  // a software GPU draws anything moving at a frame a second or worse: a build in slices would get a turn a frame, and
  // the entrance is a frame or two there anyway, so the pictures are built in one go as soon as the hero's first frame
  // is out (unless paused, when nothing moves: then the frame pace decides, as elsewhere; in a hidden tab, at once)
  if (core.gl.soft && !core.motion.paused) {
    const now = () => setTimeout(() => go({ hurry: true }));
    if (document.hidden) now(); else requestAnimationFrame(now);
    return;
  }
  // elsewhere they are built in one go only where frames still come 200 ms apart or slower once the hero is built and
  // has risen. A slow CPU alone is no reason: its frames keep their pace then (unlike a timer, which the hero's build
  // slices can hold up), and one long build there would freeze the page for seconds
  const pace = meter();
  setTimeout(() => { if (pace() > 200) go({ hurry: true }); else idle(go); }, 2200);
}));
