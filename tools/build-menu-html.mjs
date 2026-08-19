/**
 * Re Forel — генератор разметки секции «Меню» из data/menu.json.
 *
 * Меню статично, а сборщика в проекте нет: разметка генерируется один раз и
 * вклеивается в index.html между маркерами <!-- menu:start --> и <!-- menu:end -->.
 * Правим данные — перегенерируем.
 *
 * Раскладка: непрерывный список, сгруппированный по категориям. Свёрнутое
 * состояние показывает первые TEASER позиций, всё остальное помечено
 * data-extra и скрывается через CSS. Кнопка под секцией переключает состояние.
 *
 * Скрываем именно карточки внутри той же сетки, а не отдельным блоком снизу:
 * иначе при раскрытии рядом оказались бы две разные сетки и колонки поехали бы.
 *
 * Запуск: node tools/build-menu-html.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const menu = JSON.parse(await readFile(path.join(root, 'data/menu.json'), 'utf8'));

const TEASER = 4;                       // сколько позиций видно в свёрнутом виде
const SIZES = '(max-width: 767px) 76vw, (max-width: 1023px) 44vw, 306px';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ТЗ §5: разброс ±20px между соседними карточками, чтобы тарелки не всплывали
   строго синхронно. Значения чередуются по позиции в ряду. */
const OFFSETS = [-20, 20, -10, 15];

function picture(item, offset, eager) {
  const parallax = `data-parallax data-speed="1.15" data-offset="${offset}" data-anchor="parent" data-amp="0.4"`;
  if (!item.photo) {
    return `<img class="dish__img" src="images/placeholders/dish-pending.svg" width="800" height="800"
                   loading="lazy" decoding="async" ${parallax}
                   alt="Временная заливка вместо фотографии: пустая керамическая тарелка">`;
  }
  const s = `dish-${item.photo}`;
  const set = (ext) => [300, 460, 592].map((w) => `images/derived/${s}-${w}.${ext} ${w}w`).join(', ');
  return `<picture>
                <source type="image/avif" sizes="${SIZES}" srcset="${set('avif')}">
                <source type="image/webp" sizes="${SIZES}" srcset="${set('webp')}">
                <img class="dish__img" src="images/derived/${s}-460.jpg" sizes="${SIZES}" srcset="${set('jpg')}"
                     width="592" height="592" ${eager ? 'decoding="async"' : 'loading="lazy" decoding="async"'}
                     ${parallax} alt="${esc(item.name)}">
              </picture>`;
}

let shown = 0;                          // сквозной счётчик видимых в свёрнутом виде
const sections = menu.map((cat) => {
  let visibleHere = 0;

  const cards = cat.items.map((item, i) => {
    const extra = shown >= TEASER;
    if (!extra) { shown++; visibleHere++; }
    const img = picture(item, OFFSETS[i % OFFSETS.length], !extra && shown <= 2);
    const badge = item.photo ? '' : '\n              <span class="placeholder-badge">Фото готовится</span>';
    return `            <article class="dish"${item.photo ? '' : ' data-pending="true"'}${extra ? ' data-extra="true"' : ''}>
              <figure class="dish__figure">
                ${img}${badge}
              </figure>
              <h3 class="dish__name">${esc(item.name)}</h3>
              <p class="dish__meta">${item.weight}&nbsp;г</p>
              <span class="dish__price">${item.price.toLocaleString('ru-RU')}&nbsp;₽</span>
            </article>`;
  }).join('\n');

  // Если в тизер не попало ни одной позиции категории, прячем её вместе
  // с заголовком — иначе в свёрнутом виде висел бы заголовок без карточек.
  const catExtra = visibleHere === 0;

  return `        <section class="menu__cat"${catExtra ? ' data-extra="true"' : ''}>
          <h3 class="menu__cat-title">${esc(cat.title)}<span class="menu__cat-count">${cat.items.length}</span></h3>
          <div class="menu__grid">
${cards}
          </div>
        </section>`;
}).join('\n\n');

const total = menu.reduce((n, c) => n + c.items.length, 0);

const html = `      <div class="menu__cats" id="menu-list">
${sections}
      </div>

      <!-- ТЗ §5: отступ до CTA под секцией — 48px. Кнопка раскрывает список;
           без JavaScript меню показано целиком, а кнопка скрыта (см. CSS). -->
      <div class="menu__cta">
        <button class="btn btn--solid" type="button" id="menu-toggle"
                aria-expanded="false" aria-controls="menu-list">
          <span class="menu__toggle-label" data-label-show="Показать всё меню"
                data-label-hide="Скрыть меню">Показать всё меню</span>
          <span class="menu__toggle-count" aria-hidden="true">${total}</span>
        </button>
      </div>

      <p class="menu__note">
        На сайте — 4 категории из 14.
        <a href="https://eda.yandex.ru/chelyabinsk/r/manana_mama" target="_blank" rel="noopener noreferrer">
          Полное меню<span class="visually-hidden"> — откроется в новой вкладке</span></a>
      </p>`;

const indexPath = path.join(root, 'index.html');
const src = await readFile(indexPath, 'utf8');
const START = '<!-- menu:start -->', END = '<!-- menu:end -->';
const a = src.indexOf(START), b = src.indexOf(END);
if (a < 0 || b < 0) { console.error(`Маркеры ${START} / ${END} не найдены`); process.exit(1); }

await writeFile(indexPath, src.slice(0, a + START.length) + '\n' + html + '\n      ' + src.slice(b));

const withPhoto = menu.reduce((n, c) => n + c.items.filter((i) => i.photo).length, 0);
console.log(`меню собрано: ${menu.length} категории, ${total} блюд (${withPhoto} с фото)`);
console.log(`в свёрнутом виде показано: ${TEASER}, скрыто: ${total - TEASER}`);
