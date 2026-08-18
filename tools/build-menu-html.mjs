/**
 * Re Forel — генератор разметки секции «Меню» из data/menu.json.
 *
 * Меню большое и целиком статично, а сборщика в проекте нет: разметка
 * генерируется один раз и вклеивается в index.html между маркерами
 * <!-- menu:start --> и <!-- menu:end -->. Правим данные — перегенерируем.
 *
 * Запуск: node tools/build-menu-html.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const menu = JSON.parse(await readFile(path.join(root, 'data/menu.json'), 'utf8'));

const SIZES = '(max-width: 767px) 76vw, (max-width: 1023px) 44vw, 306px';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nbsp = (s) => s.replace(/ (₽|г)\b/g, ' $1');

/* ТЗ §5: разброс ±20px между соседними карточками, чтобы тарелки не всплывали
   строго синхронно. Значения чередуются по позиции в ряду. */
const OFFSETS = [-20, 20, -10, 15];

function picture(item, eager) {
  if (!item.photo) {
    return `<img class="dish__img" src="images/placeholders/dish-pending.svg" width="800" height="800"
                 loading="lazy" decoding="async"
                 data-parallax data-speed="1.15" data-offset="OFFSET" data-anchor="parent" data-amp="0.4"
                 alt="Временная заливка вместо фотографии: пустая керамическая тарелка">`;
  }
  const s = `dish-${item.photo}`;
  const set = (ext) => [300, 460, 592].map((w) => `images/derived/${s}-${w}.${ext} ${w}w`).join(', ');
  return `<picture>
              <source type="image/avif" sizes="${SIZES}" srcset="${set('avif')}">
              <source type="image/webp" sizes="${SIZES}" srcset="${set('webp')}">
              <img class="dish__img" src="images/derived/${s}-460.jpg" sizes="${SIZES}" srcset="${set('jpg')}"
                   width="592" height="592" ${eager ? 'decoding="async"' : 'loading="lazy" decoding="async"'}
                   data-parallax data-speed="1.15" data-offset="OFFSET" data-anchor="parent" data-amp="0.4"
                   alt="${esc(item.name)}">
            </picture>`;
}

const tabs = menu.map((c, i) => `        <button class="menu__tab" role="tab" id="mtab-${c.id}" aria-controls="mpanel-${c.id}"
                aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(c.title)}<span class="menu__tab-count">${c.items.length}</span></button>`).join('\n');

const panels = menu.map((c, ci) => {
  const cards = c.items.map((item, i) => {
    const eager = ci === 0 && i < 2;         // первые карточки первой категории
    const img = picture(item, eager).replace(/OFFSET/g, String(OFFSETS[i % OFFSETS.length]));
    const badge = item.photo ? '' : '\n            <span class="placeholder-badge">Фото готовится</span>';
    return `          <article class="dish"${item.photo ? '' : ' data-pending="true"'}>
            <figure class="dish__figure">
              ${img}${badge}
            </figure>
            <h3 class="dish__name">${esc(item.name)}</h3>
            <p class="dish__meta">${nbsp(item.weight + ' г')}</p>
            <span class="dish__price">${nbsp(item.price.toLocaleString('ru-RU') + ' ₽')}</span>
          </article>`;
  }).join('\n');

  return `      <div class="menu__panel" role="tabpanel" id="mpanel-${c.id}" aria-labelledby="mtab-${c.id}"${ci === 0 ? '' : ' hidden'} tabindex="0">
        <div class="menu__grid">
${cards}
        </div>
      </div>`;
}).join('\n\n');

const html = `      <div class="menu__tabs" role="tablist" aria-label="Категории меню">
${tabs}
      </div>

${panels}`;

const indexPath = path.join(root, 'index.html');
const src = await readFile(indexPath, 'utf8');
const START = '<!-- menu:start -->', END = '<!-- menu:end -->';
const a = src.indexOf(START), b = src.indexOf(END);
if (a < 0 || b < 0) { console.error(`Маркеры ${START} / ${END} не найдены в index.html`); process.exit(1); }

const out = src.slice(0, a + START.length) + '\n' + html + '\n      ' + src.slice(b);
await writeFile(indexPath, out);

const total = menu.reduce((n, c) => n + c.items.length, 0);
const withPhoto = menu.reduce((n, c) => n + c.items.filter((i) => i.photo).length, 0);
console.log(`секция меню собрана: ${menu.length} категории, ${total} блюд (${withPhoto} с фото, ${total - withPhoto} с заглушкой)`);
