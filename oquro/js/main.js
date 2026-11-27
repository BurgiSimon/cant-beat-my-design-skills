// Entry. Each part of the page is its own module; one that fails leaves the rest (and the page) working.
// The intro starts first so its dial turns while the 3D is built (in slices, yielding between them).

const load = async (name, arg, mod) => {
  try {
    const m = await (mod || import(`./${name}.js`));
    return await m.init?.(arg);
  } catch (e) {
    console.error(`[oquro] ${name}:`, e);
    if (name === 'intro') { const c = await import('./core.js'); c.unlock(); c.markReady(); c.emit('hero:rise'); } // the page must still open
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
// the smaller 3D pictures are all below the fold: build them once the way in is done and the hero's entrance (about
// 2 s of it) has played, when the browser is idle
const core = await import('./core.js');
core.once('intro:done', () => {
  const go = (arg) => load('scenes', arg, scenes);
  const due = performance.now() + (core.calm ? 0 : 2200);
  setTimeout(() => {
    // a timer this late means frames so slow that the thread hardly gets a turn (a weak or software GPU): waiting
    // longer, or building in slices, would only put the pictures off, so they are built now, in one go
    if (performance.now() - due > 250) { go({ hurry: true }); return; }
    if ('requestIdleCallback' in window) requestIdleCallback(() => go(), { timeout: 1500 }); else go();
  }, due - performance.now());
});
