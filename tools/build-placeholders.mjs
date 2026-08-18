/**
 * Re Forel — генератор временных заливок для блоков, под которые нет фотографии.
 *
 * Закрывает две реальные дыры в наборе ассетов:
 *   • §5 «Меню» — фотографий блюд нет вообще        -> dish-01..04.svg
 *   • §4 таб «Терраса» — нет ни одного уличного кадра -> terrace.svg
 * Плюс два чисто декоративных слоя, которые фотографией и не должны быть:
 *   • particles.svg — слой «частиц света» в hero (ТЗ §1, speed factor 1.25)
 *   • grain.svg     — текстура фона секции «О ресторане» (ТЗ §2, speed factor 0.5)
 *
 * Ни одна заглушка не повторяет другую и не выдаёт себя за фотографию:
 * в вёрстке поверх них стоит бейдж «фото готовится».
 *
 * Запуск:  node tools/build-placeholders.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'images', 'placeholders');
await mkdir(out, { recursive: true });

const C = {
  ink: '#0C1F1E', pine: '#123030', moss: '#1E4340', deep: '#0A1817',
  sand: '#F7F3EA', paper: '#FBF9F4', clay: '#E3DCCB',
  river: '#8FB3AE', rose: '#C08579', brass: '#C9A96A',
};

/** Детерминированный PRNG — пересборка даёт байт в байт тот же файл. */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const n = (v) => +v.toFixed(2);

const grainFilter = (id, freq, octaves) => `
  <filter id="${id}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="7" result="n"/>
    <feColorMatrix in="n" type="saturate" values="0"/>
  </filter>`;

/* ------------------------------------------------------------------ блюда */

/**
 * Каждое блюдо — своя композиция на керамике: разная посуда, разная палитра,
 * разная геометрия. Формы абстрактные: это заливка, а не рисунок еды.
 */
const DISHES = [
  {
    id: 'dish-01', plate: C.paper, rim: '#DED5C2', vessel: 'plate',
    forms: (r) => {
      const parts = [];
      // Филе: вытянутый скруглённый корпус + косые линии волокон.
      parts.push(`<rect x="255" y="330" width="290" height="150" rx="74" fill="${C.rose}" opacity=".92"/>`);
      parts.push(`<rect x="255" y="330" width="290" height="150" rx="74" fill="url(#fileSheen)"/>`);
      for (let i = 0; i < 7; i++) {
        const x = 292 + i * 33;
        parts.push(`<path d="M${x} 348 q10 56 -6 114" stroke="${C.paper}" stroke-opacity=".34" stroke-width="3" fill="none" stroke-linecap="round"/>`);
      }
      // Обугленная кромка — блюдо готовится на углях.
      parts.push(`<path d="M262 424 q138 34 276 -6" stroke="${C.ink}" stroke-opacity=".38" stroke-width="9" fill="none" stroke-linecap="round"/>`);
      for (let i = 0; i < 9; i++) {
        parts.push(`<circle cx="${n(230 + r() * 340)}" cy="${n(300 + r() * 210)}" r="${n(3 + r() * 5)}" fill="${C.moss}" opacity=".6"/>`);
      }
      return parts.join('');
    },
  },
  {
    id: 'dish-02', plate: C.paper, rim: '#D3C9B4', vessel: 'bowl',
    forms: (r) => {
      const parts = [];
      // Бульон: заливка чаши + концентрические блики.
      parts.push(`<circle cx="400" cy="400" r="152" fill="${C.brass}" opacity=".78"/>`);
      parts.push(`<circle cx="400" cy="400" r="152" fill="url(#brothSheen)"/>`);
      for (let i = 0; i < 3; i++) {
        parts.push(`<circle cx="400" cy="400" r="${58 + i * 40}" fill="none" stroke="${C.paper}" stroke-opacity=".2" stroke-width="2"/>`);
      }
      for (let i = 0; i < 11; i++) {
        const a = r() * Math.PI * 2, rad = 30 + r() * 108;
        parts.push(`<circle cx="${n(400 + Math.cos(a) * rad)}" cy="${n(400 + Math.sin(a) * rad)}" r="${n(5 + r() * 9)}" fill="${i % 3 ? C.rose : C.moss}" opacity=".72"/>`);
      }
      parts.push(`<path d="M330 352 q34 -40 72 -14 q40 26 76 -10" stroke="${C.paper}" stroke-opacity=".45" stroke-width="4" fill="none" stroke-linecap="round"/>`);
      return parts.join('');
    },
  },
  {
    id: 'dish-03', plate: C.paper, rim: '#DAD1BE', vessel: 'plate',
    forms: (r) => {
      const parts = [];
      // Тартар: цилиндр из кольцевой формы, вид сверху под лёгким углом.
      parts.push(`<ellipse cx="400" cy="430" rx="118" ry="88" fill="${C.rose}" opacity=".9"/>`);
      parts.push(`<ellipse cx="400" cy="404" rx="118" ry="88" fill="${C.rose}"/>`);
      parts.push(`<ellipse cx="400" cy="404" rx="118" ry="88" fill="url(#tartareSheen)"/>`);
      parts.push(`<ellipse cx="400" cy="404" rx="118" ry="88" fill="none" stroke="${C.ink}" stroke-opacity=".12" stroke-width="2"/>`);
      for (let i = 0; i < 16; i++) {
        const a = r() * Math.PI * 2, rad = r() * 96;
        parts.push(`<circle cx="${n(400 + Math.cos(a) * rad)}" cy="${n(404 + Math.sin(a) * rad * 0.74)}" r="${n(4 + r() * 6)}" fill="${i % 2 ? C.river : '#A9BE72'}" opacity=".8"/>`);
      }
      // Веер из тонких пластин яблока сбоку.
      for (let i = 0; i < 5; i++) {
        parts.push(`<ellipse cx="${556 + i * 4}" cy="${372 + i * 22}" rx="46" ry="11" fill="${C.paper}" stroke="${C.river}" stroke-opacity=".5" stroke-width="2" transform="rotate(${-16 + i * 8} ${556 + i * 4} ${372 + i * 22})"/>`);
      }
      return parts.join('');
    },
  },
  {
    id: 'dish-04', plate: '#2A2723', rim: '#3A362F', vessel: 'slate',
    forms: (r) => {
      const parts = [];
      // Икра на ржаном: три ломтя, на каждом россыпь икринок.
      const slices = [[300, 352], [452, 400], [346, 486]];
      for (const [cx, cy] of slices) {
        parts.push(`<rect x="${cx - 66}" y="${cy - 42}" width="132" height="84" rx="14" fill="#6B5233"/>`);
        parts.push(`<rect x="${cx - 66}" y="${cy - 42}" width="132" height="84" rx="14" fill="url(#ryeSheen)"/>`);
        parts.push(`<rect x="${cx - 58}" y="${cy - 34}" width="116" height="68" rx="10" fill="${C.paper}" opacity=".9"/>`);
        for (let i = 0; i < 26; i++) {
          parts.push(`<circle cx="${n(cx - 50 + r() * 100)}" cy="${n(cy - 26 + r() * 52)}" r="${n(4.5 + r() * 2.5)}" fill="#D9743E" opacity="${n(0.72 + r() * 0.26)}"/>`);
        }
        parts.push(`<path d="M${cx - 30} ${cy + 26} q30 12 60 -4" stroke="${C.moss}" stroke-opacity=".7" stroke-width="3" fill="none" stroke-linecap="round"/>`);
      }
      return parts.join('');
    },
  },
];

for (const d of DISHES) {
  const r = rng(d.id.charCodeAt(5) * 9173 + 31);
  const vessel =
    d.vessel === 'slate'
      ? `<rect x="150" y="182" width="500" height="436" rx="26" fill="${d.plate}"/>
         <rect x="150" y="182" width="500" height="436" rx="26" fill="none" stroke="${d.rim}" stroke-width="6"/>`
      : `<circle cx="400" cy="400" r="264" fill="${d.rim}" opacity=".55"/>
         <circle cx="400" cy="400" r="252" fill="${d.plate}"/>
         <circle cx="400" cy="400" r="252" fill="url(#plateSheen)"/>
         <circle cx="400" cy="400" r="${d.vessel === 'bowl' ? 176 : 198}" fill="none" stroke="${d.rim}" stroke-width="${d.vessel === 'bowl' ? 10 : 3}" opacity=".85"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800" role="img">
  <defs>
    <radialGradient id="plateSheen" cx="36%" cy="28%" r="78%">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".85"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="fileSheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".38"/>
      <stop offset="1" stop-color="${C.ink}" stop-opacity=".22"/>
    </linearGradient>
    <radialGradient id="brothSheen" cx="38%" cy="30%" r="72%">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".5"/>
      <stop offset="1" stop-color="${C.ink}" stop-opacity=".18"/>
    </radialGradient>
    <linearGradient id="tartareSheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".34"/>
      <stop offset="1" stop-color="${C.ink}" stop-opacity=".2"/>
    </linearGradient>
    <linearGradient id="ryeSheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".2"/>
      <stop offset="1" stop-color="${C.ink}" stop-opacity=".3"/>
    </linearGradient>
    ${grainFilter('dishGrain', '0.9', '3')}
    <clipPath id="vesselClip">${d.vessel === 'slate'
      ? `<rect x="150" y="182" width="500" height="436" rx="26"/>`
      : `<circle cx="400" cy="400" r="264"/>`}</clipPath>
  </defs>
  <g>${vessel}</g>
  <g>${d.forms(r)}</g>
  <g style="mix-blend-mode:multiply" opacity=".07">
    <rect width="800" height="800" filter="url(#dishGrain)" clip-path="url(#vesselClip)"/>
  </g>
</svg>
`;
  await writeFile(path.join(out, `${d.id}.svg`), svg);
  console.log(`${d.id}.svg`);
}

/* --------------------------------------------------------------- терраса */

/* Заливка живёт внутри параллакс-слоя с overscan, поэтому в состоянии покоя
   видна только центральная часть кадра. Композиция собрана так, чтобы читаться
   и целиком (mobile, где overscan = 0), и в центральном кропе: всё значимое —
   маркиза, гирлянды, зелень, перила и столы — лежит в полосе y ∈ [200, 700],
   а небо и пол просто растекаются за её пределы. */
{
  const r = rng(4801);
  const KEY_TOP = 200, KEY_BOTTOM = 700;

  // Маркиза: дуга в верхней границе значимой полосы, полосы «хвоя / песок».
  const awningStripes = Array.from({ length: 20 }, (_, i) =>
    `<rect x="${i * 80}" y="${KEY_TOP - 8}" width="80" height="76" fill="${i % 2 ? C.sand : C.pine}"/>`
  ).join('');

  // Гирлянды: провисающие нити с лампами сразу под маркизой.
  const garland = [];
  for (let row = 0; row < 3; row++) {
    const y0 = KEY_TOP + 74 + row * 46;
    const sag = 30 + row * 10;
    garland.push(`<path d="M0 ${y0} q400 ${sag} 800 0 q400 ${sag} 800 0" stroke="${C.brass}" stroke-opacity=".28" stroke-width="1.5" fill="none"/>`);
    for (let i = 0; i < 15; i++) {
      const t = (i + 0.5) / 15;
      const x = t * 1600;
      const local = (t * 2) % 1;
      const y = y0 + Math.sin(local * Math.PI) * sag;
      garland.push(`<circle cx="${n(x)}" cy="${n(y + 7)}" r="${n(3.5 + r() * 3)}" fill="${C.brass}" opacity="${n(0.55 + r() * 0.4)}"/>`);
    }
  }

  // Зелень: два плана, оба внутри значимой полосы.
  const foliage = Array.from({ length: 40 }, () => {
    const x = n(r() * 1600);
    const y = n(430 + r() * 190);
    const sc = n(0.5 + r() * 1.3);
    return `<ellipse cx="${x}" cy="${y}" rx="${n(34 * sc)}" ry="${n(50 * sc)}" fill="${C.deep}" opacity="${n(0.3 + r() * 0.4)}"/>`;
  }).join('');

  // Перила во всю ширину — главный признак «улицы».
  const balusters = Array.from({ length: 33 }, (_, i) =>
    `<line x1="${i * 50 + 16}" y1="608" x2="${i * 50 + 16}" y2="${KEY_BOTTOM}"/>`
  ).join('');

  // Столы: три силуэта с разной посадкой по глубине.
  const tables = [[210, 640], [760, 664], [1290, 632]].map(([x, y]) =>
    `<rect x="${x - 120}" y="${y}" width="240" height="9" rx="4"/><rect x="${x - 6}" y="${y + 9}" width="12" height="${KEY_BOTTOM - y - 9}"/>`
  ).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900" role="img">
  <defs>
    <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#16333C"/>
      <stop offset=".28" stop-color="#22414A"/>
      <stop offset=".55" stop-color="#2E4A47"/>
      <stop offset=".82" stop-color="${C.pine}"/>
      <stop offset="1" stop-color="${C.deep}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="72%" r="52%">
      <stop offset="0" stop-color="${C.brass}" stop-opacity=".3"/>
      <stop offset="1" stop-color="${C.brass}" stop-opacity="0"/>
    </radialGradient>
    ${grainFilter('terraceGrain', '0.75', '4')}
  </defs>

  <rect width="1600" height="900" fill="url(#dusk)"/>
  <rect width="1600" height="900" fill="url(#glow)"/>

  <!-- маркиза -->
  <g>${awningStripes}</g>
  <path d="M0 ${KEY_TOP + 68} q800 92 1600 0 L1600 ${KEY_TOP - 8} L0 ${KEY_TOP - 8} Z" fill="${C.pine}" opacity=".55"/>
  <path d="M0 ${KEY_TOP + 68} q800 92 1600 0" stroke="${C.sand}" stroke-opacity=".4" stroke-width="3" fill="none"/>

  <!-- гирлянды -->
  <g>${garland.join('')}</g>

  <!-- зелень -->
  <g>${foliage}</g>

  <!-- перила и столы -->
  <g stroke="${C.river}" stroke-opacity=".26" stroke-width="3" fill="none">
    <line x1="0" y1="608" x2="1600" y2="608"/>
    <line x1="0" y1="${KEY_BOTTOM}" x2="1600" y2="${KEY_BOTTOM}"/>
    ${balusters}
  </g>
  <g fill="${C.deep}" opacity=".7">${tables}</g>

  <rect width="1600" height="900" filter="url(#terraceGrain)" opacity=".09" style="mix-blend-mode:overlay"/>
</svg>
`;
  await writeFile(path.join(out, 'terrace.svg'), svg);
  console.log('terrace.svg');
}

/* ------------------------------------------------- частицы света для hero */

{
  const r = rng(1279);
  // ТЗ: opacity слоя 0.4–0.6. Разброс по каждой частице держим в этом коридоре.
  const dots = Array.from({ length: 46 }, () => {
    const x = n(r() * 1600), y = n(r() * 900);
    const rad = n(1.5 + r() * 7);
    const op = n(0.4 + r() * 0.2);
    return `<circle cx="${x}" cy="${y}" r="${rad}" fill="${r() > 0.72 ? C.brass : '#FFF6E2'}" opacity="${op}"/>`;
  }).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900" aria-hidden="true">
  <defs><filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4"/></filter></defs>
  <g filter="url(#soft)">${dots}</g>
</svg>
`;
  await writeFile(path.join(out, 'particles.svg'), svg);
  console.log('particles.svg');
}

/* --------------------------------- текстура фона секции «О ресторане» */

{
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240" aria-hidden="true">
  <defs>
    <filter id="linen" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.62 0.9" numOctaves="4" seed="19" result="n"/>
      <feColorMatrix in="n" type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope=".55"/></feComponentTransfer>
    </filter>
  </defs>
  <rect width="240" height="240" fill="${C.sand}"/>
  <rect width="240" height="240" filter="url(#linen)" opacity=".5"/>
</svg>
`;
  await writeFile(path.join(out, 'grain.svg'), svg);
  console.log('grain.svg');
}
