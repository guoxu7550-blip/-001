/* =============================================================================
 * Studio Wall · 交互层 (shelf.js)
 * 只做行为：折叠、筛选、搜索、浮层、返回顶部。
 * 内容全部是静态 HTML，禁用 JS 时仍可完整阅读。
 * ========================================================================== */
(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ------------------------------------------------------------- 折叠面板 */
  function bindAccordion() {
    $$('.item').forEach(function (el) {
      var head = $('.item-head', el);
      if (!head || head.dataset.bound) return;
      head.dataset.bound = '1';
      head.setAttribute('aria-expanded', 'false');
      head.addEventListener('click', function () {
        var open = el.classList.toggle('open');
        head.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
  }

  function openItem(el, scroll) {
    if (!el) return;
    el.classList.add('open');
    var head = $('.item-head', el);
    if (head) head.setAttribute('aria-expanded', 'true');
    if (scroll) {
      setTimeout(function () {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
  }

  /* ------------------------------------------------------- 搜索 + 分类筛选 */
  function makeFilter(root) {
    var items   = $$('.item', root);
    var groups  = $$('[data-group]', root);
    var keyword = '';
    var cat     = 'all';

    function apply() {
      var q = keyword.trim().toLowerCase();
      items.forEach(function (el) {
        var okCat = (cat === 'all') || (el.getAttribute('data-cat') === cat);
        var okQ   = !q || el.textContent.toLowerCase().indexOf(q) >= 0;
        el.style.display = (okCat && okQ) ? '' : 'none';
      });
      groups.forEach(function (g) {
        var any = $$('.item', g).some(function (el) { return el.style.display !== 'none'; });
        g.style.display = any ? '' : 'none';
      });
      var empty = $('#empty-state');
      if (empty) {
        var total = items.filter(function (el) { return el.style.display !== 'none'; }).length;
        empty.classList.toggle('hidden', total > 0);
      }
    }

    return {
      setKeyword: function (v) { keyword = v || ''; apply(); },
      setCat:     function (v) { cat = v || 'all'; apply(); },
      reset:      function () { keyword = ''; cat = 'all'; apply(); },
      count:      function () { return items.length; }
    };
  }

  /* ------------------------------------------------------------- 浮层控制 */
  var sheetState = { open: null };

  function closeSheet() {
    if (!sheetState.open) return;
    var s = sheetState.open;
    s.classList.remove('on');
    var scrim = $('#scrim');
    if (scrim) scrim.classList.remove('on');
    document.body.classList.remove('is-locked');
    var last = s.getAttribute('data-last-focus');
    sheetState.open = null;
    if (last) { var t = $('#' + last); if (t) t.focus({ preventScroll: true }); }
  }

  function openSheet(name) {
    var s = $('.sheet[data-sheet="' + name + '"]');
    if (!s) return;
    if (sheetState.open) closeSheet();
    var scrim = $('#scrim');
    if (scrim) scrim.classList.add('on');
    s.classList.add('on');
    document.body.classList.add('is-locked');
    sheetState.open = s;
    var focusable = $('input', s) || $('button', s);
    setTimeout(function () { if (focusable) focusable.focus({ preventScroll: true }); }, 260);
  }

  function bindSheets() {
    $$('[data-sheet-open]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var name = btn.getAttribute('data-sheet-open');
        var sheet = $('.sheet[data-sheet="' + name + '"]');
        if (sheet) sheet.setAttribute('data-last-focus', btn.id || '');
        openSheet(name);
      });
    });
    $$('[data-sheet-close]').forEach(function (btn) {
      btn.addEventListener('click', function (e) { e.preventDefault(); closeSheet(); });
    });
    var scrim = $('#scrim');
    if (scrim) scrim.addEventListener('click', closeSheet);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
  }

  /* --------------------------------------------------- 首页：全站条目检索 */
  function bindGlobalSearch() {
    var input = $('#gsearch');
    var box   = $('#gresults');
    var index = window.SHELF_INDEX || [];
    if (!input || !box) return;

    function render(list) {
      if (!list.length) {
        box.innerHTML = '<p class="sheet-p" style="padding:12px 2px">没有找到匹配的条目。试试「SUSAR」「CTR」「HER2」「RACT」。</p>';
        return;
      }
      box.innerHTML = list.slice(0, 40).map(function (r) {
        return '<a class="res res-shadow" href="' + r.href + '">' +
                 '<span>' + r.t + '</span>' +
                 '<small>' + r.v + '</small>' +
               '</a>';
      }).join('');
    }

    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      if (!q) { render(index.slice(0, 8)); return; }
      render(index.filter(function (r) { return (r.s || r.t).toLowerCase().indexOf(q) >= 0; }));
    });

    render(index.slice(0, 8));   /* 打开即有内容，不是空面板 */
  }

  /* ------------------------------------------------------------- 返回顶部 */
  function bindToTop() {
    var btn = $('.to-top');
    if (!btn) return;
    function onScroll() {
      btn.classList.toggle('on', window.scrollY > 420);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------------------------------------------- 首页：Editions 封面墙聚焦 */
  function bindHomeScene() {
    var scene = $('#scene');
    if (!scene || scene.dataset.bound) return;
    scene.dataset.bound = '1';

    var layer = $('.focus-layer', scene);
    if (!layer) return;
    var fimg = $('#foImg');
    var fopen = $('#foOpen');
    var fword = $('#foWord');
    var fcn = $('#foCn');
    var siT = $('#siTitle');
    var siTag = $('#siTag');
    var defT = siT ? siT.getAttribute('data-default') : '';
    var defG = siTag ? siTag.getAttribute('data-default') : '';
    var focused = null;

    function close() {
      scene.classList.remove('has-focus');
      layer.classList.remove('on');
      layer.setAttribute('aria-hidden', 'true');
      focused = null;
      if (siT) siT.textContent = defT;
      if (siTag) siTag.textContent = defG;
    }

    $$('.vol-link', scene).forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var key = a.getAttribute('data-key');
        if (focused === key) { close(); return; }   /* 再点一次 = 收起 */
        focused = key;
        var img = a.getAttribute('data-img');
        if (fimg && img) fimg.src = img;
        if (fopen) fopen.href = a.getAttribute('data-href') || '#';
        var wEl = a.querySelector('.v-word');
        var cEl = a.querySelector('.v-cn');
        if (fword) fword.textContent = wEl ? wEl.textContent : '';
        if (fcn) fcn.textContent = cEl ? cEl.textContent : '';
        if (siT) siT.textContent = a.getAttribute('data-name') || '';
        if (siTag) siTag.textContent = a.getAttribute('data-tag') || '';
        scene.classList.add('has-focus');
        layer.classList.add('on');
        layer.setAttribute('aria-hidden', 'false');
      });
    });

    /* 点击空白处收起（封面与胶囊自身不受影响，仍可切换其它封面） */
    scene.addEventListener('click', function (e) {
      if (!scene.classList.contains('has-focus')) return;
      if (e.target.closest('.vol-link') || e.target.closest('.focus-cover') || e.target.closest('.fo-open')) return;
      close();
    });
  }

  /* --------------------------------------------------------------- 初始化 */
  function init(opt) {
    opt = opt || {};
    var scope = $('#content') || document;
    var filter = null;

    bindAccordion();
    bindSheets();
    bindToTop();

    if ($('.item')) {
      filter = makeFilter(scope);

      var search = $('#search');
      if (search) {
        search.addEventListener('input', function () { filter.setKeyword(search.value); });
        search.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') { search.value = ''; filter.setKeyword(''); }
        });
        var clear = $('.f-clear');
        if (clear) clear.addEventListener('click', function () {
          search.value = ''; filter.setKeyword(''); search.focus();
        });
      }

      $$('[data-chip-group] .chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          var group = chip.closest('[data-chip-group]');
          $$('.chip', group).forEach(function (c) { c.classList.remove('on'); });
          chip.classList.add('on');
          filter.setCat(chip.getAttribute('data-cat-value'));
        });
      });

      var openAll  = $('[data-toggle="open"]');
      var closeAll = $('[data-toggle="close"]');
      if (openAll)  openAll.addEventListener('click', function () {
        $$('.item', scope).filter(function (el) { return el.style.display !== 'none'; })
          .forEach(function (el) { el.classList.add('open'); });
      });
      if (closeAll) closeAll.addEventListener('click', function () {
        $$('.item', scope).forEach(function (el) { el.classList.remove('open'); });
      });

      /* 顶栏放大镜：聚焦页内搜索框 */
      var navSearch = $('[data-focus="search"]');
      if (navSearch && search) {
        navSearch.addEventListener('click', function (e) {
          e.preventDefault();
          search.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(function () { search.focus({ preventScroll: true }); }, 320);
        });
      }
    }

    bindGlobalSearch();

    /* 深链：#q12 / #ema5 直接展开并定位 */
    if (location.hash && location.hash.length > 1) {
      var target = document.getElementById(location.hash.slice(1));
      if (target && target.classList.contains('item')) openItem(target, true);
    }

    if (opt.onReady) opt.onReady(filter);
  }

  window.Shelf = { init: init, initHome: bindHomeScene, openItem: openItem, openSheet: openSheet, closeSheet: closeSheet };
})();
