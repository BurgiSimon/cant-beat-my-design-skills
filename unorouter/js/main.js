// Entry. Each part of the page is its own module; one that fails leaves the rest (and the page) working.

const load = async (name) => {
  try {
    const m = await import(`./${name}.js`);
    return await m.init?.();
  } catch (e) {
    console.error(`[unorouter] ${name}:`, e);
    if (name === 'intro') (await import('./core.js')).markReady(); // the page must still open
    return undefined;
  }
};

load('dots');
load('mark');
load('type');
load('nav');
load('hero');
load('intro');
for (const name of ['ui', 'reveals', 'marquee', 'docs', 'models', 'router', 'rankings', 'faq', 'cta']) load(name);
