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

  /* ── Просмотр картинок (меню и галерея) ──────────────────────── */
  function initLightbox() {
    var modal = $('#modal-image');
    if (!modal) return;
    var image = $('#modal-image-src');

    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-zoom]');
      if (!trigger) return;
      var source = trigger.querySelector('img');
      if (!source) return;
      image.src = source.currentSrc || source.src;
      image.alt = source.alt || '';
      openModal(modal);
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

    var items = Array.isArray(window.SPECIALS) ? window.SPECIALS : [];
    if (!items.length) return;

    if (empty) empty.hidden = true;
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
    initMisc();
  });
})();
