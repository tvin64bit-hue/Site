/* ============================================================================
   Re Forel — движок параллакса.

   Без библиотек: один passive-слушатель scroll, один requestAnimationFrame
   и один IntersectionObserver на все слои.

   ─── Модель ───────────────────────────────────────────────────────────────
   Слой со speed factor s движется со скоростью s × скорость скролла.
   Относительно нормального потока (скорость 1×) его смещение равно
   (s − 1) × пройденный путь. Путь отсчитывается от момента, когда секция
   оказалась по центру экрана, — тогда сдвиг там равен нулю и растёт
   симметрично в обе стороны:

       centerDelta = rect.top + rect.height / 2 − viewportH / 2
       shift       = (s − 1) × clamp(centerDelta, −A, +A)

   Проверка: s = 0.35, проскроллили 500px вниз → centerDelta = −500 →
   shift = (−0.65)(−500) = +325px, то есть по экрану слой поднялся на
   500 − 325 = 175 = 0.35 × 500. При s = 1 сдвиг тождественно ноль —
   «статичен относительно скролла», как и требует ТЗ.

   ─── Амплитуда A ──────────────────────────────────────────────────────────
   Единственное ограничение поверх формулы. Без него слой с s = 0.3 за проход
   секции по экрану уехал бы на ~700px и порвал бы вёрстку. A едина для всех
   слоёв сцены, поэтому соотношения между ними остаются ровно те, что в ТЗ:
   относительное движение двух слоёв — это в точности (s₁ − 1) : (s₂ − 1).

       A = viewportH × amp,  amp = 0.5 по умолчанию (--parallax-amp),
                             1.0 для hero (data-amp), 0.4 для тарелок меню.

   ─── Брейкпоинты ──────────────────────────────────────────────────────────
   Множитель k читается из CSS-переменной --parallax-k, чтобы границы
   брейкпоинтов жили в одном месте — в стилях:
       desktop / laptop  k = 1     — коэффициенты как в ТЗ
       tablet            k = 0.5   — «параллакс ослабляется вдвое»
       mobile            k = 0     — сдвигов нет вовсе
       prefers-reduced-motion: reduce → k = 0

   Эффективная скорость: s_eff = 1 + (s − 1) × k. Для hero ТЗ называет
   планшетные значения явно (0.6 / 0.9 / 1.1) — они берутся из
   data-speed-tablet и имеют приоритет над формулой.

   ─── Разметка ─────────────────────────────────────────────────────────────
   data-parallax          элемент, которому пишется transform
   data-speed             speed factor на desktop
   data-speed-tablet      явное значение для tablet (необязательно)
   data-amp               амплитуда в долях высоты вьюпорта (необязательно)
   data-offset            индивидуальный разброс по Y в px (ТЗ §5, ±20px)
   data-mode="hero"       отсчёт от верха страницы, а не от центра секции
   data-anchor="frame"    прогресс считать по родительской рамке .p-frame
   data-anchor="parent"   прогресс считать по родителю

   Медленные слои (s < 1) лежат внутри .p-frame с overflow: hidden и
   переразмерены на --overscan сверху и снизу — иначе на краях появлялись бы
   пустоты. --overscan выставляется здесь же, по |s − 1| × A + |offset|.
============================================================================ */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  var layers = [];
  var viewportH = window.innerHeight;
  var k = 1;
  var frameRequested = false;
  var activeCount = 0;

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function num(value, fallback) {
    var n = parseFloat(value);
    return isFinite(n) ? n : fallback;
  }

  /* Множитель берём из CSS: брейкпоинты описаны там и только там. */
  function readK() {
    if (reduceQuery.matches) return 0;
    return num(getComputedStyle(root).getPropertyValue('--parallax-k'), 1);
  }

  function defaultAmp() {
    return num(getComputedStyle(root).getPropertyValue('--parallax-amp'), 0.5);
  }

  function collect() {
    var amp = defaultAmp();

    Array.prototype.forEach.call(document.querySelectorAll('[data-parallax]'), function (el) {
      var anchorMode = el.getAttribute('data-anchor');
      var anchor = el;
      if (anchorMode === 'frame' || anchorMode === 'parent') anchor = el.parentElement || el;

      layers.push({
        el: el,
        anchor: anchor,
        speed: num(el.getAttribute('data-speed'), 1),
        speedTablet: el.hasAttribute('data-speed-tablet')
          ? num(el.getAttribute('data-speed-tablet'), null)
          : null,
        amp: num(el.getAttribute('data-amp'), amp),
        offset: num(el.getAttribute('data-offset'), 0),
        hero: el.getAttribute('data-mode') === 'hero',
        // Слои внутри рамки нужно переразмеривать, иначе на краях будут дыры.
        framed: !!(el.parentElement && el.parentElement.classList.contains('p-frame')) ||
                el.classList.contains('p-layer'),
        active: false,
        centerDelta: 0,
        effSpeed: 1,
        range: 0,
      });
    });
  }

  /* Пересчёт всего, что зависит от размера окна и брейкпоинта. */
  function measure() {
    viewportH = window.innerHeight;
    k = readK();

    for (var i = 0; i < layers.length; i++) {
      var l = layers[i];

      if (k === 0) {
        l.effSpeed = 1;
      } else if (k !== 1 && l.speedTablet !== null) {
        l.effSpeed = l.speedTablet;          // явные значения ТЗ для tablet
      } else {
        l.effSpeed = 1 + (l.speed - 1) * k;
      }

      l.range = viewportH * l.amp;

      if (l.framed) {
        // Hero — особый случай. Сдвиг там отсчитывается от нуля страницы,
        // поэтому для медленного слоя (s < 1) он всегда направлен вниз, а сама
        // секция уезжает вверх ровно со скоростью скролла. Видимая часть hero
        // при этом остаётся покрытой без переразмеривания: слой занимает
        // [0.65·S, vh + 0.65·S], видно [S, vh], и 0.65·S ≤ S при любом S ≥ 0.
        // Раздувать фото hero на 0.65vh значило бы зумить кадр впустую.
        var needsOverscan = !(l.hero && l.effSpeed < 1);
        var overscan = needsOverscan
          ? Math.abs(l.effSpeed - 1) * l.range + Math.abs(l.offset)
          : 0;
        l.el.style.setProperty('--overscan', Math.ceil(overscan) + 'px');
      }
    }
  }

  /* Один кадр: сначала читаем ВСЕ геометрии, потом пишем ВСЕ трансформы.
     Смешивать чтение и запись нельзя — каждый getBoundingClientRect после
     записи стиля вызывал бы принудительный reflow. */
  function tick() {
    frameRequested = false;

    if (k === 0) return;

    var scrollY = window.scrollY || window.pageYOffset;
    var i, l;

    for (i = 0; i < layers.length; i++) {
      l = layers[i];
      if (!l.active) continue;
      if (l.hero) {
        l.centerDelta = -scrollY;
      } else {
        var r = l.anchor.getBoundingClientRect();
        l.centerDelta = r.top + r.height / 2 - viewportH / 2;
      }
    }

    for (i = 0; i < layers.length; i++) {
      l = layers[i];
      if (!l.active) continue;

      var progress = clamp(l.centerDelta, -l.range, l.range);
      var shift = (l.effSpeed - 1) * progress;

      // Индивидуальный разброс (ТЗ §5): пропорционален прогрессу, поэтому
      // в центре экрана тарелки выровнены, а расходятся к краям.
      if (l.offset) shift += l.offset * (progress / l.range);

      l.el.style.transform = 'translate3d(0,' + shift.toFixed(2) + 'px,0)';
    }
  }

  function schedule() {
    if (frameRequested || k === 0) return;
    frameRequested = true;
    requestAnimationFrame(tick);
  }

  /* will-change ставим только на время присутствия слоя в кадре и снимаем
     на выходе — держать его постоянно значит держать композиторный слой
     в памяти для каждого элемента страницы (примечание о производительности
     в конце ТЗ). */
  function observe() {
    if (!('IntersectionObserver' in window)) {
      for (var i = 0; i < layers.length; i++) layers[i].active = true;
      schedule();
      return;
    }

    var byElement = new Map();
    for (var j = 0; j < layers.length; j++) byElement.set(layers[j].anchor, layers[j]);

    var io = new IntersectionObserver(function (entries) {
      for (var e = 0; e < entries.length; e++) {
        var entry = entries[e];
        var layer = byElement.get(entry.target);
        if (!layer || layer.active === entry.isIntersecting) continue;

        layer.active = entry.isIntersecting;
        activeCount += entry.isIntersecting ? 1 : -1;

        if (entry.isIntersecting) {
          layer.el.style.willChange = 'transform';
        } else {
          layer.el.style.willChange = '';
          layer.el.style.transform = '';
        }
      }
      schedule();
    }, { rootMargin: '20% 0px 20% 0px', threshold: 0 });

    byElement.forEach(function (layer, element) { io.observe(element); });
  }

  function reset() {
    for (var i = 0; i < layers.length; i++) {
      layers[i].el.style.transform = '';
      layers[i].el.style.willChange = '';
      layers[i].el.style.removeProperty('--overscan');
    }
  }

  function onBreakpointChange() {
    measure();
    if (k === 0) reset(); else schedule();
  }

  var resizeFrame = 0;
  function onResize() {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(function () {
      resizeFrame = 0;
      onBreakpointChange();
    });
  }

  function init() {
    collect();
    if (!layers.length) return;

    measure();
    observe();
    schedule();

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });

    // Пользователь может переключить настройку движения не перезагружая страницу.
    if (typeof reduceQuery.addEventListener === 'function') {
      reduceQuery.addEventListener('change', onBreakpointChange);
    } else if (typeof reduceQuery.addListener === 'function') {
      reduceQuery.addListener(onBreakpointChange);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
