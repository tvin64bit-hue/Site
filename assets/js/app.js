/* Итальянка — вся интерактивность сайта. Без библиотек.
   Точки подключения реальных обработчиков форм — в разделе ОТПРАВКА ФОРМ. */
(function () {
  'use strict';

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /* ── Мобильное меню ──────────────────────────────────────────── */
  function initBurger() {
    var burger = $('.burger');
    var nav = $('.site-nav');
    if (!burger || !nav) return;

    burger.addEventListener('click', function () {
      var open = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('site-nav_open', !open);
    });

    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) {
        burger.setAttribute('aria-expanded', 'false');
        nav.classList.remove('site-nav_open');
      }
    });
  }

  /* ── Вкладки меню ────────────────────────────────────────────── */
  function initTabs() {
    $$('.tabs').forEach(function (tabs) {
      var buttons = $$('.tabs__btn', tabs);
      var panels = $$('.tabs__panel', tabs);

      function select(index) {
        buttons.forEach(function (btn, i) {
          btn.setAttribute('aria-selected', String(i === index));
          btn.tabIndex = i === index ? 0 : -1;
        });
        panels.forEach(function (panel, i) { panel.hidden = i !== index; });
      }

      buttons.forEach(function (btn, i) {
        btn.addEventListener('click', function () { select(i); });
        btn.addEventListener('keydown', function (event) {
          var step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
          if (!step) return;
          event.preventDefault();
          var next = (i + step + buttons.length) % buttons.length;
          select(next);
          buttons[next].focus();
        });
      });

      select(0);
    });
  }

  /* ── Модальные окна ──────────────────────────────────────────── */
  var lastFocused = null;

  function openModal(modal) {
    if (!modal) return;
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    var focusable = $('input, select, textarea, button', modal);
    if (focusable) focusable.focus();
  }

  function closeModal(modal) {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    if (lastFocused) lastFocused.focus();
  }

  function initModals() {
    // Открытие по data-modal="id"
    document.addEventListener('click', function (event) {
      var opener = event.target.closest('[data-modal]');
      if (opener) {
        event.preventDefault();
        openModal(document.getElementById(opener.getAttribute('data-modal')));
        return;
      }
      // Закрытие по крестику или клику по фону
      var closer = event.target.closest('[data-modal-close]');
      if (closer) {
        event.preventDefault();
        closeModal(closer.closest('.modal'));
        return;
      }
      if (event.target.classList.contains('modal')) closeModal(event.target);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') $$('.modal').forEach(closeModal);
    });
  }

  /* ── Просмотр картинок (меню и галерея) ────────────────────────
     Листается стрелками, клавишами и свайпом. Группой считаются
     все картинки внутри общего контейнера [data-zoom-group]. */
  var zoomItems = [];
  var zoomIndex = 0;

  function showZoom(index) {
    var modal = $('#modal-image');
    var image = $('#modal-image-src');
    if (!modal || !image || !zoomItems.length) return;

    zoomIndex = (index + zoomItems.length) % zoomItems.length;
    var source = zoomItems[zoomIndex];
    image.src = source.currentSrc || source.src;
    image.alt = source.alt || '';

    var counter = $('#modal-image-counter', modal);
    if (counter) {
      counter.textContent = zoomItems.length > 1
        ? zoomIndex + 1 + ' / ' + zoomItems.length : '';
    }
    $$('[data-zoom-nav]', modal).forEach(function (btn) {
      btn.hidden = zoomItems.length < 2;
    });
  }

  function initLightbox() {
    var modal = $('#modal-image');
    if (!modal) return;

    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-zoom]');
      if (trigger) {
        var source = trigger.querySelector('img') ||
          (trigger.tagName === 'IMG' ? trigger : null);
        if (!source) return;
        var group = trigger.closest('[data-zoom-group]') || document;
        zoomItems = $$('[data-zoom] img, img[data-zoom]', group);
        showZoom(Math.max(0, zoomItems.indexOf(source)));
        openModal(modal);
        return;
      }
      var nav = event.target.closest('[data-zoom-nav]');
      if (nav) {
        event.preventDefault();
        showZoom(zoomIndex + Number(nav.getAttribute('data-zoom-nav')));
      }
    });

    document.addEventListener('keydown', function (event) {
      if (modal.hidden) return;
      if (event.key === 'ArrowRight') showZoom(zoomIndex + 1);
      if (event.key === 'ArrowLeft') showZoom(zoomIndex - 1);
    });
  }

  /* ── Валидация ───────────────────────────────────────────────── */
  var PHONE_RE = /^\+?[\d\s()-]{10,20}$/;

  function setError(input, message) {
    var field = input.closest('.field');
    var slot = field && $('.field__error', field);
    if (slot) slot.textContent = message || '';
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function validate(form) {
    var valid = true;
    $$('[required]', form).forEach(function (input) {
      var value = input.value.trim();
      var message = '';

      if (input.type === 'checkbox') {
        if (!input.checked) message = 'Нужно ваше согласие';
      } else if (!value) {
        message = 'Заполните поле';
      } else if (input.type === 'tel' && !PHONE_RE.test(value)) {
        message = 'Проверьте номер телефона';
      }

      if (message) valid = false;
      setError(input, message);
    });
    return valid;
  }

  /* ── ОТПРАВКА ФОРМ ───────────────────────────────────────────────
     Заглушки. Данные никуда не уходят — форма только показывает
     подтверждение и пишет payload в консоль.

     Чтобы заявки начали приходить по-настоящему, замените тело
     sendLead() на реальный запрос, например:

       return fetch('https://formspree.io/f/ВАШ_ID', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(payload)
       }).then(function (r) {
         if (!r.ok) throw new Error('HTTP ' + r.status);
       });

     Больше менять ничего не нужно: обработчики ниже уже умеют
     показывать ошибку, если запрос не прошёл.                     */
  function sendLead(kind, payload) {
    console.info('[заглушка] заявка «' + kind + '» не отправлена, данные:', payload);
    return new Promise(function (resolve) { setTimeout(resolve, 400); });
  }

  function initForms() {
    $$('form[data-lead]').forEach(function (form) {
      var status = $('.form__status', form);
      var submit = $('[type="submit"]', form);

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!validate(form)) return;

        var payload = {};
        new FormData(form).forEach(function (value, key) { payload[key] = value; });

        var initial = submit ? submit.textContent : '';
        if (submit) { submit.disabled = true; submit.textContent = 'Отправляем…'; }

        sendLead(form.getAttribute('data-lead'), payload)
          .then(function () {
            form.reset();
            if (status) {
              status.textContent = form.getAttribute('data-success') ||
                'Спасибо! Заявка принята, мы свяжемся с вами.';
              status.hidden = false;
            }
          })
          .catch(function () {
            if (status) {
              status.textContent = 'Не удалось отправить заявку. ' +
                'Позвоните нам: +7 (908) 700-31-79';
              status.hidden = false;
            }
          })
          .then(function () {
            if (submit) { submit.disabled = false; submit.textContent = initial; }
          });
      });

      // Гасим сообщение об ошибке, как только поле правят
      form.addEventListener('input', function (event) {
        if (event.target.matches('[required]')) setError(event.target, '');
      });
    });
  }

  /* ── Спецпредложения ─────────────────────────────────────────────
     Данные лежат в data/specials.js (window.SPECIALS). Пустой
     список — показываем строку «уточняйте по телефону». */
  function initSpecials() {
    var list = $('#specials-list');
    var empty = $('#specials-empty');
    if (!list) return;

    var section = list.closest('.section');
    var items = Array.isArray(window.SPECIALS) ? window.SPECIALS : [];
    if (!items.length) return;

    if (empty) empty.hidden = true;
    if (section) section.hidden = false;
    list.innerHTML = items.map(function (item) {
      var media = item.image
        ? '<div class="card__media"><img src="' + item.image + '" alt="" loading="lazy"></div>'
        : '';
      var note = item.note ? '<p class="card__note">' + item.note + '</p>' : '';
      return '<article class="card">' + media +
        '<div class="card__body">' +
          '<h3 class="card__title">' + (item.title || '') + '</h3>' +
          '<p class="card__text">' + (item.text || '') + '</p>' +
          note +
        '</div></article>';
    }).join('');
  }

  /* ── Появление секций при скролле ────────────────────────────── */
  function initReveal() {
    var items = $$('[data-reveal]');
    if (!items.length) return;

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });

    items.forEach(function (el) { observer.observe(el); });
  }

  /* ── Счётчики цифр ───────────────────────────────────────────── */
  function initCounters() {
    var nums = $$('[data-count]');
    if (!nums.length) return;

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function run(el) {
      var target = Number(el.getAttribute('data-count'));
      if (reduced || !target) { el.textContent = String(target); return; }

      var duration = 1400;
      var started = null;
      function step(now) {
        if (started === null) started = now;
        var progress = Math.min((now - started) / duration, 1);
        // замедление к концу — движение выглядит естественнее
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = String(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    if (!('IntersectionObserver' in window)) { nums.forEach(run); return; }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        run(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.4 });

    nums.forEach(function (el) { el.textContent = '0'; observer.observe(el); });
  }

  /* ── Параллакс фото-врезок ───────────────────────────────────── */
  function initParallax() {
    var bands = $$('.band');
    if (!bands.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var ticking = false;

    function update() {
      ticking = false;
      var viewport = window.innerHeight;
      bands.forEach(function (band) {
        var image = $('.band__bg', band);
        if (!image) return;
        var box = band.getBoundingClientRect();
        if (box.bottom < 0 || box.top > viewport) return;
        // -1 сверху экрана, +1 снизу
        var position = (box.top + box.height / 2 - viewport / 2) / (viewport / 2 + box.height / 2);
        image.style.transform = 'translate3d(0, ' + (position * 9).toFixed(2) + '%, 0)';
      });
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* ── Слайдер сканов меню ─────────────────────────────────────── */
  function initSliders() {
    $$('.slider').forEach(function (slider) {
      var track = $('.slider__track', slider);
      var slides = $$('.slider__slide', slider);
      var prev = $('.slider__arrow_prev', slider);
      var next = $('.slider__arrow_next', slider);
      var dotsBox = $('.slider__dots', slider);
      if (!track || slides.length < 1) return;

      var index = 0;
      var dots = [];

      if (dotsBox && slides.length > 1) {
        dotsBox.innerHTML = '';
        slides.forEach(function (slide, i) {
          var dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'slider__dot';
          dot.setAttribute('aria-label', 'Страница ' + (i + 1));
          dot.addEventListener('click', function () { go(i); });
          dotsBox.appendChild(dot);
          dots.push(dot);
        });
      }

      function go(to) {
        index = Math.max(0, Math.min(to, slides.length - 1));
        track.style.transform = 'translateX(' + (-index * 100) + '%)';
        dots.forEach(function (dot, i) {
          dot.setAttribute('aria-current', String(i === index));
        });
        if (prev) prev.disabled = index === 0;
        if (next) next.disabled = index === slides.length - 1;
      }

      if (prev) prev.addEventListener('click', function () { go(index - 1); });
      if (next) next.addEventListener('click', function () { go(index + 1); });

      // Свайп пальцем
      var startX = null;
      slider.addEventListener('touchstart', function (event) {
        startX = event.touches[0].clientX;
      }, { passive: true });
      slider.addEventListener('touchend', function (event) {
        if (startX === null) return;
        var delta = event.changedTouches[0].clientX - startX;
        if (Math.abs(delta) > 45) go(index + (delta < 0 ? 1 : -1));
        startX = null;
      });

      if (slides.length < 2) {
        if (prev) prev.hidden = true;
        if (next) next.hidden = true;
      }
      go(0);
    });
  }

  /* ── Тень у шапки при прокрутке ──────────────────────────────── */
  function initHeaderShadow() {
    var header = $('.site-header');
    if (!header) return;
    var ticking = false;

    function update() {
      ticking = false;
      header.classList.toggle('is-stuck', window.pageYOffset > 8);
    }
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  /* ── Мелочи ──────────────────────────────────────────────────── */
  function initMisc() {
    // Год в подвале
    var year = $('[data-year]');
    if (year) year.textContent = String(new Date().getFullYear());

    // Минимальная дата брони — сегодня
    $$('input[type="date"][data-min-today]').forEach(function (input) {
      input.min = new Date().toISOString().slice(0, 10);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initBurger();
    initTabs();
    initModals();
    initLightbox();
    initForms();
    initSpecials();
    initReveal();
    initCounters();
    initParallax();
    initSliders();
    initHeaderShadow();
    initMisc();
  });
})();
