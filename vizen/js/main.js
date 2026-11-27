// Entry. Each part of the page is its own module; one that fails leaves the rest (and the page) working.

const load = async (name, arg) => {
  try {
    const m = await import(`./${name}.js`);
    return await m.init?.(arg);
  } catch (e) {
    console.error(`[vizen] ${name}:`, e);
    if (name === 'intro') (await import('./core.js')).markReady(); // the page must still open
    return undefined;
  }
};

await load('ui');
load('shop');
load('nav');
const stage = load('stage');
load('intro', stage);
for (const name of ['reveals', 'anatomy', 'tunnel', 'vault']) load(name, stage);
