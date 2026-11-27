// Entry. Each part of the page is its own module; one that fails leaves the rest (and the page) working.
// The intro starts first so its dial turns while the 3D is built (in slices, yielding between them).

const load = async (name, arg) => {
  try {
    const m = await import(`./${name}.js`);
    return await m.init?.(arg);
  } catch (e) {
    console.error(`[oquro] ${name}:`, e);
    if (name === 'intro') (await import('./core.js')).markReady(); // the page must still open
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
// the smaller 3D pictures are all below the fold: build them once the way in is done and the browser is idle
(await import('./core.js')).once('intro:done', () => {
  const go = () => load('scenes');
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 1500 }); else setTimeout(go, 300);
});
