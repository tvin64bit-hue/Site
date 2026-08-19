/* ============================================================================
   Re Forel — интерфейсная логика: шапка, мобильная навигация, табы
   пространств и появление блоков при входе в viewport.

   Параллакс живёт отдельно, в js/parallax.js.
============================================================================ */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* --------------------------------------------------- Появление блоков */

  /* ТЗ §2: плавное появление через opacity / translateY(40px → 0) при входе
     в viewport, threshold 0.3. Анимируем свойство translate, а не transform:
     transform занят параллаксом, и два эффекта складываются, не затирая
     друг друга. */
  function initReveal() {
    var targets = document.querySelectorAll('[data-reveal]');
    if (!targets.length) return;

    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(targets, function (el) { el.classList.add('is-revealed'); });
      return;
    }

    var io = new IntersectionObserver(function (entries, observer) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        entries[i].target.classList.add('is-revealed');
        observer.unobserve(entries[i].target);   // одноразовый эффект
      }
    }, { threshold: 0.3 });

    Array.prototype.forEach.call(targets, function (el) {
      // Блок выше сгиба покажем сразу, не дожидаясь скролла.
      if (el.getBoundingClientRect().top < window.innerHeight * 0.75) {
        el.classList.add('is-revealed');
      } else {
        io.observe(el);
      }
    });
  }

  /* ------------------------------------------------------------- Шапка */

  function initHeader() {
    var header = document.getElementById('site-header');
    var hero = document.getElementById('hero');
    if (!header) return;

    var solid = false;
    var pending = false;

    function update() {
      pending = false;
      var threshold = hero ? hero.offsetHeight * 0.6 : 120;
      var next = (window.scrollY || window.pageYOffset) > threshold;
      if (next === solid) return;
      solid = next;
      header.classList.toggle('is-solid', solid);
    }

    function onScroll() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  /* ------------------------------------------- Мобильная навигация */

  function initNavToggle() {
    var toggle = document.getElementById('nav-toggle');
    var nav = document.getElementById('site-nav');
    if (!toggle || !nav) return;

    function setOpen(open) {
      toggle.setAttribute('aria-expanded', String(open));
      nav.setAttribute('data-open', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    }

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });

    // Возврат на десктоп при открытом меню не должен оставлять body залоченным.
    window.matchMedia('(min-width: 1024px)').addEventListener('change', function (event) {
      if (event.matches) setOpen(false);
    });
  }

  /* ---------------------------------------- Активный пункт навигации */

  function initScrollSpy() {
    var links = document.querySelectorAll('.site-nav a[href^="#"]');
    if (!links.length || !('IntersectionObserver' in window)) return;

    var map = new Map();
    Array.prototype.forEach.call(links, function (link) {
      var section = document.querySelector(link.getAttribute('href'));
      if (section) map.set(section, link);
    });

    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var link = map.get(entries[i].target);
        if (!link) continue;
        if (entries[i].isIntersecting) {
          Array.prototype.forEach.call(links, function (l) { l.removeAttribute('aria-current'); });
          link.setAttribute('aria-current', 'true');
        }
      }
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    map.forEach(function (link, section) { io.observe(section); });
  }

  /* ------------------------------------------------------------- Табы */

  /* Полноценный паттерн tablist: aria-selected, roving tabindex, стрелки,
     Home/End. На странице таких групп две — «Пространства» (§4) и категории
     меню (§5), поэтому обработчик общий.

     Для «Пространств» дополнительно переключается фоновый кадр зоны
     (cross-fade 350 мс, ТЗ §4) и бейдж временной заливки. При
     prefers-reduced-motion переход мгновенный — за это отвечает CSS. */
  function initTabList(tablist) {
    const tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;

    // Бейдж заглушки ищем в общем предке группы, а не по всей странице:
    // иначе одна группа табов перетирала бы состояние другой.
    const scope = tablist.closest('section') || document;
    const badge = scope.querySelector('[data-badge-for]');

    function select(index, moveFocus) {
      const target = tabs[index];
      if (!target) return;

      tabs.forEach(function (tab, i) {
        const selected = i === index;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;

        const panel = document.getElementById(tab.getAttribute('aria-controls'));
        if (panel) panel.hidden = !selected;

        // Кадр зоны: id таба вида <префикс>-<ключ> совпадает с data-shot кадра.
        const key = tab.id.replace(/^[^-]*-/, '');
        const shot = scope.querySelector('[data-shot="' + key + '"]');
        if (shot) {
          if (selected) shot.setAttribute('data-active', 'true');
          else shot.removeAttribute('data-active');
        }

        if (badge && selected) badge.hidden = badge.getAttribute('data-badge-for') !== key;
      });

      if (moveFocus) target.focus();
    }

    tabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () { select(index, false); });

      tab.addEventListener('keydown', function (event) {
        let next = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        if (next === null) return;
        event.preventDefault();
        select(next, true);
      });
    });

    // Стартовое состояние берём из разметки, а не навязываем первый таб.
    const initial = tabs.findIndex(function (t) { return t.getAttribute('aria-selected') === 'true'; });
    select(initial < 0 ? 0 : initial, false);
  }

  function initTabs() {
    Array.prototype.forEach.call(document.querySelectorAll('[role="tablist"]'), initTabList);
  }

  /* ------------------------------------------------ Раскрытие меню */

  /* Свёрнутое состояние живёт в CSS (атрибут data-expanded на секции), здесь
     только переключение и подпись. Разметка отдаёт меню целиком, поэтому без
     JavaScript видны все позиции, а кнопка спрятана стилями. */
  function initMenuToggle() {
    const button = document.getElementById('menu-toggle');
    const section = document.getElementById('menu');
    if (!button || !section) return;

    const label = button.querySelector('.menu__toggle-label');
    const show = label && label.getAttribute('data-label-show');
    const hide = label && label.getAttribute('data-label-hide');

    button.addEventListener('click', function () {
      const expanded = section.getAttribute('data-expanded') === 'true';

      if (expanded) {
        // При сворачивании кнопка уезжает вверх на высоту скрытого списка,
        // и без возврата пользователь оказался бы посреди следующей секции.
        const top = section.getBoundingClientRect().top + window.scrollY;
        section.removeAttribute('data-expanded');
        button.setAttribute('aria-expanded', 'false');
        if (label) label.textContent = show;
        window.scrollTo({
          top: top - 80,
          behavior: reduceMotion.matches ? 'auto' : 'smooth',
        });
      } else {
        section.setAttribute('data-expanded', 'true');
        button.setAttribute('aria-expanded', 'true');
        if (label) label.textContent = hide;
      }
    });
  }

  /* ---------------------------------------------------- Появление hero */

  function initHero() {
    var hero = document.getElementById('hero');
    if (!hero) return;
    var img = hero.querySelector('img');

    function ready() { hero.classList.add('is-ready'); }

    if (!img || img.complete) ready();
    else {
      img.addEventListener('load', ready, { once: true });
      img.addEventListener('error', ready, { once: true });
    }
  }

  /* ---------------------------------------------------------------- init */

  function init() {
    initHero();
    initReveal();
    initHeader();
    initNavToggle();
    initScrollSpy();
    initTabs();
    initMenuToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
