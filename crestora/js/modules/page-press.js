// press.html: logo downloads built in the browser, the Michroma type tester, and the chrome C's sheen kept still
// while it is off screen.
//
// Logos: [data-logo="lockup|mark|wordmark"][data-theme="dark|light"] buttons make an SVG and hand it over through a
// Blob. The files are outlined (the wordmark's letters are Michroma's own outlines, so nobody needs the font) and use
// the footer's geometry: the C is 53 units square, the name starts at 80.3 and sits on a baseline at 35.88, set at
// 31.4 units with the same hairline of stroke the site's wordmark carries. On dark, the C is chrome (the kit's
// gradients) and the name white; on light, both are solid black.
import { toast, whenVisible, $, $$ } from '../core.js';
import { keepFocusInStrips } from './page-strips.js';

const C = 'M48.62 11.9A26.5 26.5 0 1 0 48.62 41.1L40.9 36.5A16.05 16.05 0 1 1 40.9 16.5Z';
// "Crestora" in Michroma, font units (2048 per em), baseline at 0, letter-spaced -0.006em
const NAME = 'M128 -748V-788Q128 -992 148 -1130Q168 -1269 217 -1356Q266 -1443 350 -1489Q435 -1535 563 -1552Q691 -1568 871 -1568H1274Q1480 -1568 1622 -1548Q1763 -1529 1850 -1472Q1936 -1414 1975 -1302Q2014 -1191 2014 -1007H1822Q1822 -1152 1796 -1232Q1770 -1313 1708 -1349Q1647 -1385 1541 -1394Q1435 -1402 1274 -1402H871Q728 -1402 630 -1394Q532 -1385 470 -1354Q409 -1324 376 -1258Q344 -1192 332 -1078Q320 -964 320 -788V-748Q320 -578 332 -466Q344 -354 376 -287Q409 -220 470 -187Q532 -154 630 -144Q728 -134 871 -134H1274Q1435 -134 1541 -141Q1647 -148 1708 -182Q1770 -216 1796 -296Q1822 -375 1822 -519H2014Q2014 -335 1975 -225Q1936 -115 1850 -60Q1763 -4 1622 14Q1480 32 1274 32H871Q646 32 501 2Q356 -29 274 -111Q193 -193 160 -347Q128 -501 128 -748ZM2281 0V-1152H2473V-993Q2505 -1044 2538 -1078Q2570 -1112 2622 -1132Q2675 -1152 2765 -1160Q2855 -1169 3002 -1169V-1008Q2804 -1008 2696 -994Q2587 -980 2540 -946Q2493 -913 2483 -854Q2473 -795 2473 -704V0ZM4554 -342Q4554 -213 4516 -139Q4477 -65 4398 -31Q4319 3 4196 12Q4074 22 3905 22Q3712 22 3578 2Q3443 -17 3360 -78Q3278 -138 3240 -259Q3203 -380 3203 -582Q3203 -778 3240 -896Q3276 -1014 3358 -1074Q3440 -1134 3574 -1154Q3707 -1174 3900 -1174Q4121 -1174 4266 -1143Q4411 -1112 4482 -1025Q4554 -938 4554 -770V-523H3396Q3397 -395 3414 -318Q3431 -241 3482 -202Q3533 -163 3634 -150Q3736 -138 3905 -138Q4057 -138 4150 -144Q4244 -150 4292 -170Q4341 -191 4358 -232Q4375 -273 4375 -342ZM3900 -1014Q3737 -1014 3638 -1002Q3538 -990 3486 -956Q3434 -921 3416 -853Q3397 -785 3396 -674H4370V-770Q4370 -842 4354 -890Q4337 -937 4289 -964Q4241 -992 4148 -1003Q4054 -1014 3900 -1014ZM5441 22Q5231 22 5104 8Q4976 -6 4910 -44Q4845 -82 4822 -152Q4800 -222 4800 -334H4984Q4984 -271 4993 -232Q5002 -194 5044 -174Q5086 -153 5180 -146Q5275 -138 5446 -138Q5627 -138 5728 -146Q5828 -153 5872 -174Q5916 -194 5926 -233Q5935 -272 5935 -336Q5935 -414 5921 -453Q5907 -492 5855 -506Q5803 -519 5689 -520L5231 -525Q5054 -527 4961 -555Q4868 -583 4834 -654Q4800 -724 4800 -854Q4800 -975 4838 -1041Q4875 -1107 4955 -1135Q5035 -1163 5163 -1168Q5291 -1174 5472 -1174Q5685 -1174 5810 -1161Q5936 -1148 5998 -1112Q6061 -1076 6080 -1008Q6100 -939 6100 -829H5916Q5916 -894 5907 -932Q5898 -969 5858 -986Q5819 -1004 5730 -1009Q5642 -1014 5482 -1014Q5300 -1014 5199 -1010Q5098 -1006 5053 -991Q5008 -976 4998 -944Q4988 -911 4988 -854Q4988 -796 4994 -762Q5001 -729 5029 -712Q5057 -695 5120 -690Q5184 -684 5298 -683L5693 -679Q5871 -677 5964 -650Q6056 -622 6090 -548Q6123 -475 6123 -336Q6123 -211 6086 -139Q6050 -67 5970 -32Q5890 2 5760 12Q5629 22 5441 22ZM6900 0Q6724 0 6618 -36Q6512 -71 6464 -162Q6417 -252 6417 -416V-1467H6609V-1152H7318V-994H6609V-416Q6609 -304 6630 -249Q6650 -194 6712 -177Q6775 -160 6900 -160Q7011 -160 7074 -167Q7138 -174 7168 -204Q7198 -235 7206 -305Q7214 -375 7214 -502H7384Q7384 -336 7364 -236Q7343 -136 7290 -85Q7238 -34 7144 -17Q7049 0 6900 0ZM8325 22Q8132 22 7997 2Q7862 -17 7779 -78Q7696 -138 7658 -259Q7620 -380 7620 -582Q7620 -778 7658 -896Q7696 -1014 7779 -1074Q7862 -1134 7997 -1154Q8132 -1174 8325 -1174Q8519 -1174 8654 -1154Q8788 -1134 8871 -1074Q8954 -1014 8992 -896Q9030 -778 9030 -582Q9030 -380 8992 -259Q8954 -138 8871 -78Q8788 -17 8654 2Q8519 22 8325 22ZM8838 -582Q8838 -725 8824 -811Q8809 -897 8760 -940Q8711 -984 8608 -999Q8504 -1014 8325 -1014Q8147 -1014 8043 -999Q7939 -984 7890 -940Q7841 -897 7826 -811Q7812 -725 7812 -582Q7812 -434 7826 -345Q7841 -256 7890 -212Q7939 -167 8043 -152Q8147 -138 8325 -138Q8504 -138 8608 -152Q8711 -167 8760 -212Q8809 -256 8824 -345Q8838 -434 8838 -582ZM9262 0V-1152H9454V-993Q9486 -1044 9518 -1078Q9551 -1112 9604 -1132Q9656 -1152 9746 -1160Q9836 -1169 9983 -1169V-1008Q9785 -1008 9676 -994Q9568 -980 9521 -946Q9474 -913 9464 -854Q9454 -795 9454 -704V0ZM10824 22Q10617 22 10482 0Q10348 -21 10282 -94Q10217 -167 10217 -321Q10217 -478 10278 -552Q10340 -625 10474 -647Q10607 -669 10824 -669Q11000 -669 11119 -661Q11238 -653 11332 -633Q11330 -766 11314 -842Q11298 -919 11254 -956Q11210 -993 11126 -1004Q11041 -1014 10901 -1014Q10741 -1014 10650 -1007Q10560 -1000 10519 -982Q10478 -964 10468 -930Q10457 -896 10457 -842H10265Q10265 -950 10294 -1016Q10324 -1082 10395 -1116Q10466 -1150 10590 -1162Q10713 -1174 10901 -1174Q11103 -1174 11226 -1148Q11350 -1122 11414 -1054Q11479 -987 11502 -866Q11524 -745 11524 -554V0H11332V-79Q11298 -43 11238 -21Q11178 1 11078 12Q10979 22 10824 22ZM10824 -134Q10995 -134 11097 -138Q11199 -142 11250 -160Q11300 -178 11316 -218Q11332 -258 11332 -330V-507L10824 -513Q10689 -515 10606 -510Q10524 -504 10481 -486Q10438 -467 10424 -428Q10409 -388 10409 -321Q10409 -256 10424 -218Q10438 -180 10481 -162Q10524 -144 10606 -139Q10689 -134 10824 -134Z';
const EM = 2048;
const STROKE = Math.round(0.042 * EM);           // the wordmark's -webkit-text-stroke
const NAME_BOX = [85, -1611, 11482, 1686];        // its ink, stroke included
const SCALE = 31.4 / EM;

function chrome(id) {
  // the .mark's layered backgrounds, as SVG gradients in the C's own 53-unit box
  return `<defs>
<linearGradient id="${id}0" gradientUnits="userSpaceOnUse" x1="-4.85" y1="8.4" x2="57.85" y2="44.6"><stop offset=".4" stop-color="#fff"/><stop offset=".7" stop-color="#f1f2ff"/><stop offset=".9" stop-color="#fff"/></linearGradient>
<radialGradient id="${id}1" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(4.77 29.15) scale(11.66 21.2)"><stop offset="0" stop-color="#aab2ff" stop-opacity=".45"/><stop offset=".7" stop-color="#aab2ff" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}2" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(32.86 46.11) scale(14.84 9.54)"><stop offset="0" stop-color="#4652dc" stop-opacity=".8"/><stop offset=".75" stop-color="#4652dc" stop-opacity="0"/></radialGradient>
<linearGradient id="${id}3" gradientUnits="userSpaceOnUse" x1="16.18" y1="-5.27" x2="36.82" y2="58.27"><stop offset=".17" stop-color="#4048d6" stop-opacity="0"/><stop offset=".24" stop-color="#4048d6" stop-opacity=".9"/><stop offset=".29" stop-color="#8c96fa" stop-opacity=".55"/><stop offset=".36" stop-color="#8c96fa" stop-opacity="0"/></linearGradient>
</defs>
<path d="${C}" fill="url(#${id}0)"/><path d="${C}" fill="url(#${id}1)"/><path d="${C}" fill="url(#${id}2)"/><path d="${C}" fill="url(#${id}3)"/>`;
}
const markShapes = (theme) => (theme === 'dark' ? chrome('cr') : `<path d="${C}" fill="#000"/>`);
const nameShape = (fill) => `<path d="${NAME}" fill="${fill}" stroke="${fill}" stroke-width="${STROKE}" stroke-linejoin="round"/>`;

function svgFor(kind, theme) {
  const ink = theme === 'dark' ? '#fff' : '#000';
  const head = (vb, w, h) => `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}">\n<title>Crestora</title>\n`;
  if (kind === 'mark') return `${head('0 0 53 53', 212, 212)}${markShapes(theme)}\n</svg>\n`;
  if (kind === 'wordmark') {
    const [x, y, w, h] = NAME_BOX;
    return `${head(`${x} ${y} ${w} ${h}`, 600, Math.round((600 * h) / w))}${nameShape(ink)}\n</svg>\n`;
  }
  return `${head('0 0 258 53', 516, 106)}${markShapes(theme)}\n<g transform="translate(80.3 35.88) scale(${SCALE.toFixed(7)})">${nameShape(ink)}</g>\n</svg>\n`;
}

function download(kind, theme) {
  const name = `crestora-${kind}-on-${theme}.svg`;
  const url = URL.createObjectURL(new Blob([svgFor(kind, theme)], { type: 'image/svg+xml' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast(`${name} saved`, 'SVG');
}

export default function init({ calm }) {
  const page = $('[data-page="press"]');
  if (!page) return;
  // the swatches are disabled in the page (without scripts they copy nothing): turn them on
  for (const b of $$('.pr-swatch', page)) b.disabled = false;
  keepFocusInStrips($('.pr-jump', page));

  page.addEventListener('click', (e) => {
    const b = e.target.closest('[data-logo]');
    if (b) download(b.dataset.logo, b.dataset.theme || 'dark');
  });

  // the type tester
  const text = $('#pr-tt-text', page);
  const size = $('#pr-tt-size', page);
  const out = $('#pr-tt-out', page);
  const preview = $('#pr-tt-preview', page);
  if (text && size && preview) {
    const fallback = 'Every idea gets a lane.';
    const setText = () => { preview.textContent = text.value.trim() || fallback; };
    const setSize = () => { preview.style.setProperty('--tt', `${size.value}px`); if (out) out.textContent = `${size.value} px`; };
    // narrow screens start smaller, so the line fits
    if (innerWidth < 640 && size.value === '64') size.value = '40';
    text.addEventListener('input', setText);
    size.addEventListener('input', setSize);
    for (const p of $$('[data-tt]', page)) p.addEventListener('click', () => { text.value = p.dataset.tt; setText(); text.focus(); });
    setText();
    setSize();
  }

  // the chrome C turns its sheen only while it can be seen
  if (!calm) {
    for (const sheen of $$('.pr-hero__mark .mark__sheen, .pr-tile .mark__sheen', page)) {
      sheen.style.animationPlayState = 'paused';
      whenVisible(sheen.closest('.pr-hero__mark, .pr-tile'), (on) => { sheen.style.animationPlayState = on ? 'running' : 'paused'; }, '0px');
    }
  }
}
