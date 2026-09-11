/* Dr. Vincent Sam Jebadurai — site behaviour.
   No dependencies. Every feature degrades to working HTML if JS is off. */
(function () {
  'use strict';

  var onReady = function (fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  };

  /* ------------------------------------------------------------ nav */
  function initNav() {
    var btn = document.querySelector('.menu-toggle');
    var nav = document.querySelector('.nav');
    if (!btn || !nav) return;

    var setOpen = function (open) {
      nav.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    };

    btn.addEventListener('click', function () {
      setOpen(!nav.classList.contains('is-open'));
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        btn.focus();
      }
    });

    document.addEventListener('click', function (e) {
      if (!nav.classList.contains('is-open')) return;
      if (nav.contains(e.target) || btn.contains(e.target)) return;
      setOpen(false);
    });
  }

  /* ------------------------------------------------------------ year */
  function initYear() {
    var y = String(new Date().getFullYear());
    Array.prototype.forEach.call(document.querySelectorAll('[data-year]'), function (el) {
      el.textContent = y;
    });
  }

  /* ------------------------------------------- publication explorer */
  function initExplorer() {
    var root = document.querySelector('[data-explorer]');
    if (!root) return;

    var rows = Array.prototype.slice.call(root.querySelectorAll('.pub-row'));
    var count = root.querySelector('[data-count]');
    var empty = root.querySelector('[data-empty]');
    var inputs = Array.prototype.slice.call(root.querySelectorAll('[data-filter]'));

    var get = function (name) {
      var el = root.querySelector('[data-filter="' + name + '"]');
      return el ? el.value.trim().toLowerCase() : '';
    };

    function apply() {
      var q = get('q'), year = get('year'), area = get('area'), type = get('type');
      var shown = 0;

      rows.forEach(function (row) {
        var ok = true;
        if (year && row.getAttribute('data-year') !== year) ok = false;
        if (ok && type && row.getAttribute('data-type') !== type) ok = false;
        if (ok && area && (' ' + row.getAttribute('data-areas') + ' ').indexOf(' ' + area + ' ') === -1) ok = false;
        if (ok && q && row.getAttribute('data-text').indexOf(q) === -1) ok = false;
        row.hidden = !ok;
        if (ok) shown++;
      });

      if (count) {
        count.textContent = shown === rows.length
          ? 'Showing all ' + rows.length + ' publications.'
          : 'Showing ' + shown + ' of ' + rows.length + ' publications.';
      }
      if (empty) empty.hidden = shown !== 0;
    }

    inputs.forEach(function (el) {
      el.addEventListener('input', apply);
      el.addEventListener('change', apply);
    });

    var reset = root.querySelector('[data-reset]');
    if (reset) {
      reset.addEventListener('click', function () {
        inputs.forEach(function (el) { el.value = ''; });
        apply();
        var q = root.querySelector('[data-filter="q"]');
        if (q) q.focus();
      });
    }

    // Deep link: /publications/?area=3d-concrete-printing
    var param = new URLSearchParams(window.location.search).get('area');
    if (param) {
      var sel = root.querySelector('[data-filter="area"]');
      if (sel && Array.prototype.some.call(sel.options, function (o) { return o.value === param; })) {
        sel.value = param;
      }
    }
    apply();
  }

  /* ------------------------------------------------- copy citation */
  function initCite() {
    var btn = document.querySelector('[data-copy-cite]');
    var text = document.querySelector('[data-cite]');
    if (!btn || !text) return;

    btn.addEventListener('click', function () {
      var value = text.textContent.trim();
      var done = function (ok) {
        var original = btn.getAttribute('data-label') || btn.textContent;
        btn.setAttribute('data-label', original);
        btn.textContent = ok ? 'Citation copied' : 'Press Ctrl+C to copy';
        window.setTimeout(function () { btn.textContent = original; }, 2200);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(function () { done(true); }, function () { select(); });
      } else {
        select();
      }

      function select() {
        try {
          var range = document.createRange();
          range.selectNodeContents(text);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          done(false);
        } catch (e) { done(false); }
      }
    });
  }

  /* ------------------------------------------------------- search */
  function initSearch() {
    var root = document.querySelector('[data-search]');
    if (!root) return;

    var input = root.querySelector('[data-search-input]');
    var out = root.querySelector('[data-search-results]');
    var status = root.querySelector('[data-search-status]');
    var chips = Array.prototype.slice.call(root.querySelectorAll('.chip'));
    var base = root.getAttribute('data-base') || '';
    var index = null;
    var typeFilter = '';

    // Depth-aware prefix so /x/y/ links resolve from the search page.
    var prefix = (function () {
      var path = window.location.pathname.replace(/\/index\.html$/, '/');
      var depth = path.split('/').filter(Boolean).length;
      return depth > 0 ? new Array(depth + 1).join('../') : '';
    }());

    function load() {
      if (index) return Promise.resolve(index);
      // The index is inlined into the page so this works from file:// too.
      if (window.SEARCH_INDEX) { index = window.SEARCH_INDEX; return Promise.resolve(index); }
      return fetch(window.SEARCH_INDEX_URL)
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (data) { index = data; return index; });
    }

    function href(item) {
      return prefix + item.url.replace(/^\//, '') + 'index.html';
    }

    function render(results, q) {
      out.innerHTML = '';
      if (!q) {
        status.textContent = 'Start typing to search across publications, research, patents, projects, articles and talks.';
        return;
      }
      if (!results.length) {
        status.textContent = 'No matches for “' + q + '”' + (typeFilter ? ' in ' + typeFilter + 's' : '') + '.';
        return;
      }
      status.textContent = results.length + ' result' + (results.length === 1 ? '' : 's') + ' for “' + q + '”' +
        (typeFilter ? ' in ' + typeFilter + 's' : '') + '.';

      var frag = document.createDocumentFragment();
      results.slice(0, 60).forEach(function (item) {
        var a = document.createElement('a');
        a.className = 'result';
        a.href = href(item);
        a.innerHTML = '<span class="result-type">' + item.type + '</span>' +
          '<h3></h3><p class="result-meta"></p>';
        a.querySelector('h3').textContent = item.title;
        a.querySelector('.result-meta').textContent = item.meta;
        frag.appendChild(a);
      });
      out.appendChild(frag);
    }

    function score(item, q) {
      var t = item.title.toLowerCase();
      if (t === q) return 100;
      if (t.indexOf(q) === 0) return 60;
      if (t.indexOf(q) !== -1) return 40;
      if ((item.meta || '').toLowerCase().indexOf(q) !== -1) return 20;
      if ((item.text || '').toLowerCase().indexOf(q) !== -1) return 10;
      return 0;
    }

    function run() {
      var q = input.value.trim().toLowerCase();
      if (!q) { render([], ''); return; }
      load().then(function (data) {
        var hits = data
          .filter(function (i) { return !typeFilter || i.type === typeFilter; })
          .map(function (i) { return { item: i, s: score(i, q) }; })
          .filter(function (x) { return x.s > 0; })
          .sort(function (a, b) { return b.s - a.s || a.item.title.localeCompare(b.item.title); })
          .map(function (x) { return x.item; });
        render(hits, input.value.trim());
      }).catch(function () {
        status.textContent = 'Search index could not be loaded. Browse the sections from the navigation instead.';
      });
    }

    input.addEventListener('input', run);
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.classList.remove('is-on'); });
        chip.classList.add('is-on');
        typeFilter = chip.getAttribute('data-type') || '';
        run();
      });
    });

    var q0 = new URLSearchParams(window.location.search).get('q');
    if (q0) { input.value = q0; run(); }
    input.focus();
  }

  onReady(function () {
    initNav();
    initYear();
    initExplorer();
    initCite();
    initSearch();
  });
}());
