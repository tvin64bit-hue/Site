/**
 * Re Forel — замер реального контраста текста поверх фотографий.
 *
 * Обычная проверка «цвет текста против цвета фона» на фото-hero бессмысленна:
 * фон под одной строкой меняется от тёмного дерева до засвеченного окна.
 *
 * Метод: снимаем один и тот же участок дважды — с текстом и без него.
 * Пиксель считается ядром штриха, если он окрашен в объявленный цвет текста
 * практически без примеси фона (сглаженные края отбрасываем — там пиксель
 * это смесь, и его контраст мерить некорректно). Для каждого такого пикселя
 * берём цвет фона из второго снимка и считаем отношение по WCAG.
 *
 * Запуск: node tools/check-contrast.mjs [ширина ...]
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html;charset=utf-8', '.css':'text/css;charset=utf-8', '.js':'text/javascript;charset=utf-8',
  '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.webp':'image/webp', '.avif':'image/avif', '.json':'application/json' };

const server = http.createServer((req, res) => {
  let f = decodeURIComponent(req.url.split('?')[0]);
  if (f === '/') f = '/index.html';
  const fp = path.join(ROOT, f);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});
await new Promise((r) => server.listen(8099, r));

const lum = (r, g, b) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const parseRGB = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);

const TARGETS = [
  ['.hero .eyebrow', 'надзаголовок hero'],
  ['.hero h1', 'H1'],
  ['.hero__lead', 'подзаголовок hero'],
  ['.logo', 'логотип'],
  ['.site-nav li:nth-child(2) a', 'пункт меню'],
  ['.site-header__phone', 'телефон'],
  ['.hero__cta .btn--ghost', 'кнопка-контур'],
];

const widths = process.argv.slice(2).map(Number).filter(Boolean);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let failures = 0;

for (const width of (widths.length ? widths : [1440, 1200, 900, 390])) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8099/', { waitUntil: 'load' });
  await page.waitForTimeout(1600);
  console.log(`\n=== ${width}px, первый экран ===`);

  for (const [sel, label] of TARGETS) {
    const info = await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) return null;
      return { color: getComputedStyle(el).color,
        clip: { x: Math.max(0, Math.round(r.x)), y: Math.max(0, Math.round(r.y)),
                width: Math.round(r.width), height: Math.round(r.height) } };
    }, sel);
    if (!info) continue;

    const withText = await page.screenshot({ clip: info.clip });
    await page.evaluate((s) => { document.querySelector(s).style.visibility = 'hidden'; }, sel);
    await page.waitForTimeout(120);
    const noText = await page.screenshot({ clip: info.clip });
    await page.evaluate((s) => { document.querySelector(s).style.visibility = ''; }, sel);

    const a = await sharp(withText).raw().toBuffer({ resolveWithObject: true });
    const b = await sharp(noText).raw().toBuffer({ resolveWithObject: true });
    const ch = a.info.channels;
    const fg = parseRGB(info.color);
    const fgLum = lum(...fg);

    let worst = Infinity, sum = 0, n = 0;
    for (let i = 0; i < a.data.length; i += ch) {
      // Ядро штриха: пиксель почти в точности цвета текста.
      const near = Math.abs(a.data[i] - fg[0]) + Math.abs(a.data[i+1] - fg[1]) + Math.abs(a.data[i+2] - fg[2]);
      if (near > 12) continue;
      // ...и при этом фон под ним отличается — иначе это не глиф, а совпадение.
      const moved = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i+1] - b.data[i+1]) + Math.abs(a.data[i+2] - b.data[i+2]);
      if (moved < 24) continue;
      const r = ratio(fgLum, lum(b.data[i], b.data[i+1], b.data[i+2]));
      sum += r; n++;
      if (r < worst) worst = r;
    }

    if (!n) { console.log(`  --   ${label.padEnd(20)} ядро штриха не найдено`); continue; }
    const pass = worst >= 4.5;
    if (!pass) failures++;
    console.log(`  ${pass ? 'OK  ' : 'НИЗК'} ${label.padEnd(20)} ${String(n).padStart(6)} px   средний ${(sum / n).toFixed(1)}:1   худший ${worst.toFixed(1)}:1`);
  }
  await ctx.close();
}

await browser.close();
server.close();
console.log(failures ? `\nниже 4.5:1: ${failures}` : '\nвсе замеры >= 4.5:1');
process.exit(failures ? 1 : 0);
