// Entry. Each part of the page is its own module; one that fails leaves the rest (and the page) working.

const load = async (name, arg) => {
  try {
    const m = await import(`./${name}.js`);
    return await m.init?.(arg);
  } catch (e) {
    console.error(`[offform] ${name}:`, e);
    if (name === 'intro') (await import('./core.js')).markReady(); // the page must still open
    return undefined;
  }
};

await load('ui');
const hero = await load('hero');
load('nav');
load('intro', hero);
for (const name of ['bag', 'shop', 'reveals', 'after', 'pace', 'lab', 'club', 'foot']) load(name);
