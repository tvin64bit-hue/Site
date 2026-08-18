/**
 * Re Forel — генератор адаптивных производных изображений.
 *
 * Оригиналы в /images не изменяются. Для каждого исходника создаются варианты
 * по ширине в трёх форматах (AVIF / WebP / JPEG) — под <picture> + srcset из ТЗ.
 *
 * Запуск:  npm install --no-save sharp && node tools/build-images.mjs
 */
import sharp from 'sharp';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'images');
const out = path.join(src, 'derived');

/** Ширины подобраны под реальную роль кадра на странице и не превышают оригинал. */
const SOURCES = [
  { file: '6399f785bf3ea32a196ccad5_market-house_Website-Header-1.jpg', slug: 'hero-hall',          widths: [480, 768, 1024, 1440, 1920, 2560] },
  { file: 'Studio_Munge_Leuca_Michael_Stavaridis-(3).webp',             slug: 'space-hall',         widths: [480, 768, 1024, 1440, 1920] },
  { file: 'unnamed (3).jpg',                                            slug: 'space-bar',          widths: [480, 768, 1024, 1200] },
  { file: '2f25e99f276f1f6902b4a1c572a0b346.jpg',                       slug: 'space-banquet',      widths: [480, 768, 1010] },
  { file: '1b7dd2832265592920812755c676f8d8.jpg',                       slug: 'about-lounge',       widths: [368, 560, 736] },
  { file: 'unnamed.jpg',                                                slug: 'gallery-loft',       widths: [480, 768, 1024, 1200] },
  { file: 'stunning-restaurant-interior-design-View03.jpg',             slug: 'gallery-vintage',    widths: [480, 768, 1024, 1440] },
  { file: 'f157ede6b88a575833d07822bece4b3d.jpg',                       slug: 'gallery-blooms',     widths: [368, 560, 736] },
  { file: 'unnamed (1).jpg',                                            slug: 'gallery-daylight',   widths: [480, 768, 1024, 1200] },
  { file: 'unnamed (4).jpg',                                            slug: 'gallery-service',    widths: [480, 768, 1024, 1200] },
  { file: 'unnamed (2).jpg',                                            slug: 'gallery-banquette',  widths: [480, 768, 1024, 1200] },
  { file: 'stunning-restaurant-interior-design-View06.jpg',             slug: 'gallery-sunburst',   widths: [480, 768, 1024, 1440] },
];

/* Фотографии блюд лежат отдельно: они не из исходного набора интерьеров,
   а извлечены из PDF-выгрузки меню (tools/extract-dish-photos.mjs).
   Оригиналы 592x592, в сетке меню карточка занимает ~300px. */
const DISH_WIDTHS = [300, 460, 592];

const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('');

await mkdir(out, { recursive: true });
const manifest = {};

const dishDir = path.join(src, 'dishes');
const dishFiles = (await readdir(dishDir).catch(() => []))
  .filter((f) => f.endsWith('.jpg'))
  .map((f) => ({ file: path.join('dishes', f), slug: 'dish-' + path.basename(f, '.jpg'), widths: DISH_WIDTHS }));

for (const { file, slug, widths } of [...SOURCES, ...dishFiles]) {
  const input = path.join(src, file);
  const image = sharp(input, { limitInputPixels: false });
  const meta = await image.metadata();
  const stats = await image.stats();

  const usable = widths.filter((w) => w <= meta.width);
  if (!usable.length) usable.push(meta.width);

  for (const w of usable) {
    const base = sharp(input, { limitInputPixels: false }).resize({ width: w, withoutEnlargement: true });
    await Promise.all([
      base.clone().avif({ quality: 50, effort: 4 }).toFile(path.join(out, `${slug}-${w}.avif`)),
      base.clone().webp({ quality: 74, effort: 5 }).toFile(path.join(out, `${slug}-${w}.webp`)),
      base.clone().jpeg({ quality: 78, mozjpeg: true, progressive: true }).toFile(path.join(out, `${slug}-${w}.jpg`)),
    ]);
  }

  manifest[slug] = {
    source: file,
    width: meta.width,
    height: meta.height,
    ratio: +(meta.width / meta.height).toFixed(4),
    widths: usable,
    // Доминирующий цвет — подложка под картинкой, чтобы не было вспышки при загрузке.
    placeholder: hex(stats.dominant),
  };
  console.log(`${slug.padEnd(20)} ${meta.width}x${meta.height}  ->  ${usable.join(', ')}`);
}

await writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('\nmanifest.json готов');
