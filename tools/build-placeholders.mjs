/**
 * Re Forel — генератор временных заливок для блоков, под которые нет фотографии.
 *
 * Закрывает две реальные дыры в наборе ассетов:
 *   • §5 «Меню» — у четырёх позиций нет снимка      -> dish-pending.svg
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

/* Меню собрано на реальных фотографиях из выгрузки (images/dishes/), но у
   четырёх позиций снимка нет. Для них — одна нейтральная заглушка: пустая
   керамика на тонированном фоне, в тон остальным карточкам. Не изображает
   конкретное блюдо и не притворяется фотографией — поверх стоит бейдж. */
{
  const r = rng(6421);
  const crumbs = Array.from({ length: 18 }, () => {
    const a = r() * Math.PI * 2, rad = 250 + r() * 120;
    return `<circle cx="${n(400 + Math.cos(a) * rad)}" cy="${n(400 + Math.sin(a) * rad)}" r="${n(2 + r() * 4)}" fill="${C.ink}" opacity="${n(0.05 + r() * 0.07)}"/>`;
  }).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800" role="img">
  <defs>
    <linearGradient id="cloth" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#DCD3C0"/>
      <stop offset="1" stop-color="#C8BCA4"/>
    </linearGradient>
    <radialGradient id="plateSheen" cx="36%" cy="28%" r="78%">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".9"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    ${grainFilter('dishGrain', '0.9', '3')}
  </defs>

  <rect width="800" height="800" fill="url(#cloth)"/>
  <g>${crumbs}</g>

  <ellipse cx="400" cy="430" rx="258" ry="248" fill="${C.ink}" opacity=".14"/>
  <circle cx="400" cy="400" r="264" fill="#D3C9B4"/>
  <circle cx="400" cy="400" r="252" fill="${C.paper}"/>
  <circle cx="400" cy="400" r="252" fill="url(#plateSheen)"/>
  <circle cx="400" cy="400" r="198" fill="none" stroke="#DED5C2" stroke-width="3"/>
  <circle cx="400" cy="400" r="150" fill="none" stroke="#DED5C2" stroke-width="1.5" opacity=".7"/>

  <rect width="800" height="800" filter="url(#dishGrain)" opacity=".08" style="mix-blend-mode:multiply"/>
</svg>
`;
  await writeFile(path.join(out, 'dish-pending.svg'), svg);
  console.log('dish-pending.svg');
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
