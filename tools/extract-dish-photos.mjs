/**
 * Re Forel — извлечение фотографий блюд из PDF-выгрузки меню.
 *
 * PDF — это печать страницы Яндекс.Еды. Карточка блюда в ней: квадратная
 * фотография, под ней цена, название, вес и рейтинг.
 *
 * Как работает:
 *   1. По списку операторов находим квадратные изображения — это карточки,
 *      и запоминаем их позицию на странице вместе с внутренним именем объекта.
 *   2. Читаем подпись прямо под фотографией, в границах той же колонки.
 *   3. Страницу рендерим (canvas нужен, чтобы pdfjs декодировал растр), после
 *      чего забираем ОРИГИНАЛЬНЫЙ битмап из page.objs.
 *
 * Берём именно оригинал, а не вырезку из отрендеренной страницы: Яндекс.Еда
 * рисует поверх фотографии кнопку «+», и в рендере она запекается в кадр.
 * В самом растре её нет.
 *
 * Запуск: node tools/extract-dish-photos.mjs <pdf...>
 */
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

// Рендер нужен только чтобы pdfjs декодировал растры; масштаб берём минимальный, кадры
// всё равно забираем из page.objs в исходном разрешении.
const SCALE = 1;
const OUT = process.env.DISH_OUT || '/tmp/dish-photos';
fs.mkdirSync(OUT, { recursive: true });

const TRANSLIT = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
const slug = s => s.toLowerCase().replace(/[а-яё]/g, c => TRANSLIT[c] ?? c)
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

const mul = (a, b) => [
  a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1],
  a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3],
  a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5],
];

const found = new Map();   // название -> запись (первое вхождение выигрывает)

for (const file of process.argv.slice(2)) {
  const doc = await getDocument({ url: file, verbosity: 0 }).promise;

  for (let pn = 1; pn <= doc.numPages; pn++) {
    const page = await doc.getPage(pn);
    const vp = page.getViewport({ scale: 1 });
    const ops = await page.getOperatorList();

    // Позиции квадратных картинок — это карточки блюд.
    const cards = [];
    const stack = [];
    let ctm = [1, 0, 0, 1, 0, 0];
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i], args = ops.argsArray[i];
      if (fn === OPS.save) stack.push(ctm.slice());
      else if (fn === OPS.restore) ctm = stack.pop() || ctm;
      else if (fn === OPS.transform) ctm = mul(ctm, args);
      else if (fn === OPS.paintImageXObject) {
        const w = Math.abs(ctm[0]), h = Math.abs(ctm[3]);
        if (w > 120 && h > 120 && Math.abs(w - h) < 10) {
          cards.push({ x: ctm[4], bottom: vp.height - ctm[5], w, h, obj: args[0] });
        }
      }
    }
    if (!cards.length) continue;

    const tc = await page.getTextContent();
    const texts = tc.items.filter(t => t.str && t.str.trim())
      .map(t => ({ x: t.transform[4], y: vp.height - t.transform[5], s: t.str.trim() }));

    // Подписи собираем ДО рендера — он дорогой, и без подписи карточка не нужна.
    const labelled = [];
    for (const c of cards) {
      const near = texts
        .filter(t => t.y >= c.bottom - 2 && t.y < c.bottom + 72 &&
                     t.x >= c.x - 8 && t.x < c.x + c.w + 10)
        .sort((a, b) => a.y - b.y || a.x - b.x);
      if (!near.length) continue;

      const line = near.map(t => t.s).join(' ').replace(/\s+/g, ' ');
      const price = line.match(/^(\d+)\s*₽/);
      // \b — ASCII-граница слова и после кириллической «г» не срабатывает.
      const weight = line.match(/(\d+)\s*г(?=\s|$)/);
      const rating = line.match(/(\d+)%\s*\((\d+)\)/);
      const name = line.replace(/^\d+\s*₽\s*/, '').replace(/\s*\d+\s*г(?=\s|$).*$/, '').trim();
      if (!price || !name || found.has(name)) continue;

      labelled.push({ card: c, obj: c.obj, name, price: +price[1],
        weight: weight ? +weight[1] : null,
        rating: rating ? { percent: +rating[1], votes: +rating[2] } : null });
    }
    if (!labelled.length) continue;

    // Рендер — только ради побочного эффекта: он наполняет page.objs растрами.
    const rvp = page.getViewport({ scale: SCALE });
    const canvas = createCanvas(Math.ceil(rvp.width), Math.ceil(rvp.height));
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport: rvp }).promise;

    for (const item of labelled) {
      if (!page.objs.has(item.obj)) continue;
      const bitmap = await new Promise(res => page.objs.get(item.obj, res));
      if (!bitmap || !bitmap.data) continue;

      const { width: w, height: h, data } = bitmap;
      const channels = data.length / (w * h);
      if (![1, 3, 4].includes(channels)) continue;

      const name = slug(item.name);
      await sharp(Buffer.from(data), { raw: { width: w, height: h, channels } })
        .removeAlpha()
        .jpeg({ quality: 92 })
        .toFile(path.join(OUT, `${name}.jpg`));

      found.set(item.name, { slug: name, name: item.name, price: item.price,
        weight: item.weight, rating: item.rating,
        width: w, height: h, source: path.basename(file), page: pn });
    }
  }
}

const list = [...found.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
fs.writeFileSync(path.join(OUT, 'dishes.json'), JSON.stringify(list, null, 2) + '\n');
console.log(`извлечено фотографий: ${list.length}`);
for (const d of list) console.log(`  ${String(d.price).padStart(4)} ₽  ${String(d.weight ?? '—').padStart(4)} г  ${d.slug}.jpg  ${d.name}`);
