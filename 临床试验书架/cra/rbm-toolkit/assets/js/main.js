/* =============================================================================
 * RBM Toolkit · 主控制器 (main.js)
 * 路由 / 导航 / 角色切换 / 项目管理 / 深链处理
 * ========================================================================== */
(function (global) {
  'use strict';
  var U = global.RBM_Utils, S = global.RBM_Store, D = global.RBM_Data;

  var V = global.RBM_Views;
  var current = 'dashboard';

  function go(view, ctx) {
    if (!V[view]) view = 'dashboard';
    current = view;
    // 侧边导航高亮
    U.$$('#nav .nav-item').forEach(function (b) { b.classList.toggle('active', b.dataset.view === view); });
    // 标题
    var cfg = V[view];
    document.getElementById('page-title').textContent = cfg.title || '';
    document.getElementById('page-sub').textContent = cfg.sub || '';
    // 渲染
    var content = document.getElementById('content');
    content.innerHTML = '';
    content.onclick = null;
    content.oninput = null;
    content.onchange = null;
    try { cfg.render(content, ctx || {}); }
    catch (err) {
      console.error(err);
      if (global.__errs) global.__errs.push(view + ' → ' + err.message);
      content.innerHTML = '<div class="card"><div class="card-body"><div class="empty"><div class="ic">!</div><h3>页面渲染出现异常</h3><p>' + U.esc(err.message) + '</p>' +
        '<button class="btn btn-primary" onclick="location.reload()">重新加载</button></div></div></div>';
    }
    // 关闭移动端侧栏
    document.getElementById('sidebar').classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    refreshNav();
    try { location.hash = view; } catch (e) { }
  }

  /* ------------------------------------------------------------------ 导航徽标 */
  function refreshNav() {
    var db = S.load();
    var proj = db.projects.filter(function (p) { return p.id === db.meta.activeProject; })[0];
    if (!proj) {
      ['nv-ract', 'nv-ledger', 'nv-checklist'].forEach(function (id) { var n = document.getElementById(id); if (n) n.style.display = 'none'; });
      return;
    }
    var racts = db.racts.filter(function (r) { return r.projectId === proj.id; });
    var draft = racts.filter(function (r) { return r.status === '草稿' || r.status === '待审核'; }).length;
    setBadge('nv-ract', draft, draft ? '' : (racts.length ? racts.length + ' 份' : ''), !draft);
    var open = db.ledger.filter(function (l) { return l.projectId === proj.id && l.status !== '已关闭'; }).length;
    setBadge('nv-ledger', open, open ? '' : '已清零', !open);
    var visits = db.visits.filter(function (v) { return v.projectId === proj.id && v.status === '进行中'; }).length;
    setBadge('nv-checklist', visits, visits ? '' : '', !visits);
  }

  function setBadge(id, num, altText, ok) {
    var n = document.getElementById(id);
    if (!n) return;
    if (num > 0) { n.style.display = ''; n.textContent = num; n.className = 'nav-badge'; }
    else if (altText) { n.style.display = ''; n.textContent = altText; n.className = 'nav-badge ok'; }
    else { n.style.display = 'none'; }
  }

  /* ------------------------------------------------------------------ 项目选择器 */
  function renderProjects() {
    var db = S.load();
    var sel = document.getElementById('project-select');
    sel.innerHTML = db.projects.map(function (p) {
      return '<option value="' + p.id + '"' + (db.meta.activeProject === p.id ? ' selected' : '') + '>' + U.esc(p.shortName + ' · ' + p.phase) + '</option>';
    }).join('') + '<option value="__new">＋ 新建项目…</option>';

    sel.onchange = function () {
      if (this.value === '__new') { openProjectForm(); this.value = db.meta.activeProject; return; }
      var pid = this.value;
      db.meta.activeProject = pid;
      S.persist();
      var target = db.projects.filter(function (p) { return p.id === pid; })[0];
      S.audit('切换项目', target ? target.name : pid, '');
      V.ract.reset && V.ract.reset();
      V.kri.centerId = '';
      V.ledger.state.page = 1;
      U.toast('已切换项目', 'ok');
      go(current);
    };
  }

  function openProjectForm() {
    var form = U.el('div', {});
    form.innerHTML = '' +
      '<div class="field"><label class="fl">项目全称 *</label><input type="text" id="pj-name" placeholder="例：ABC-201 · 某药物治疗 2 型糖尿病的 III 期临床研究"></div>' +
      '<div class="row"><div class="field"><label class="fl">项目简称 *</label><input type="text" id="pj-short" placeholder="ABC-201"></div>' +
      '<div class="field"><label class="fl">方案版本</label><input type="text" id="pj-ver" value="V1.0"></div>' +
      '<div class="field"><label class="fl">期别</label><select id="pj-phase"><option>I 期</option><option>II 期</option><option selected>III 期</option><option>IV 期</option><option>真实世界研究</option><option>器械临床试验</option></select></div></div>' +
      '<div class="row"><div class="field"><label class="fl">适应证</label><input type="text" id="pj-ind" placeholder="例：中重度活动性克罗恩病"></div>' +
      '<div class="field"><label class="fl">目标入组（总）</label><input type="number" id="pj-target" value="120"></div></div>' +
      '<div class="field"><label class="fl">SDV 策略</label><input type="text" id="pj-sdv" value="关键数据 100% SDV，非关键数据抽样 20%"></div>' +
      '<div class="field"><label class="fl">研究中心（每行一家，格式：中心名称|PI 姓名|目标入组数）</label>' +
      '<textarea id="pj-centers" style="min-height:110px" placeholder="北京协和医院|张伟|30&#10;上海中山医院|李明|25">北京协和医院|张伟|30&#10;上海中山医院|李明|25&#10;广州中山一院|黄强|22</textarea></div>';
    var save = U.el('button', { class: 'btn btn-primary', text: '创建项目' });
    var cancel = U.el('button', { class: 'btn btn-ghost', text: '取消' });
    var m = U.openModal('新建临床研究项目', form, [cancel, save], true);
    cancel.onclick = m.close;
    save.onclick = function () {
      var name = form.querySelector('#pj-name').value.trim();
      var short = form.querySelector('#pj-short').value.trim();
      if (!name || !short) { U.toast('请填写项目全称与简称', 'warn'); return; }
      var centersRaw = form.querySelector('#pj-centers').value.split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean);
      var centers = centersRaw.map(function (line, i) {
        var parts = line.split('|').map(function (x) { return x.trim(); });
        return {
          id: 'S' + String(i + 1).padStart(3, '0'),
          name: parts[0] || ('中心 ' + (i + 1)), pi: parts[1] || '', enrolled: 0,
          target: Number(parts[2]) || 20, rpn: 0, level: '低', openIssues: 0,
          lastVisit: '', nextVisit: '', krAnomalies: 0, cp: '', highRiskIssues: [],
          createdAt: S.nowISO()
        };
      });
      var rec = S.addProject({
        name: name, shortName: short,
        protocolVersion: form.querySelector('#pj-ver').value || 'V1.0',
        phase: form.querySelector('#pj-phase').value,
        indication: form.querySelector('#pj-ind').value,
        totalTarget: Number(form.querySelector('#pj-target').value) || 0,
        centerCount: centers.length,
        sdvPolicy: form.querySelector('#pj-sdv').value,
        centers: centers
      });
      S.load().meta.activeProject = rec.id;
      S.persist();
      m.close();
      renderProjects();
      U.toast('项目「' + short + '」已创建，含 ' + centers.length + ' 家中心', 'ok');
      go('dashboard');
    };
  }

  /* ------------------------------------------------------------------ 用户面板（头像 / 姓名 / 最近操作轨迹） */
  var AVATAR_KEY = 'rbm_toolkit_avatar_v1';

  function getAvatar() {
    try { return localStorage.getItem(AVATAR_KEY) || ''; } catch (e) { return ''; }
  }

  function setAvatar(dataUrl) {
    try { localStorage.setItem(AVATAR_KEY, dataUrl); } catch (e) { U.toast('头像保存失败（存储空间不足）', 'warn'); }
  }

  function resizeAvatar(dataUrl, cb) {
    var img = new Image();
    img.onload = function () {
      var cv = document.createElement('canvas');
      cv.width = 128; cv.height = 128;
      var ctx = cv.getContext('2d');
      var s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 128, 128);
      try { cb(cv.toDataURL('image/jpeg', 0.85)); } catch (e) { cb(dataUrl); }
    };
    img.onerror = function () { U.toast('图片读取失败，请换一张试试', 'warn'); };
    img.src = dataUrl;
  }

  function openUserPanel() {
    var u = S.currentUser();
    var av = getAvatar();
    var form = U.el('div', {});
    form.innerHTML = '' +
      '<div class="up-avatar-wrap" style="margin-bottom:14px">' +
      '<div class="up-avatar-big" id="up-av">' + (av ? '<img src="' + av + '">' : U.esc((u.name || 'U').slice(0, 2).toUpperCase())) + '</div>' +
      '<div><div style="font-size:15px;font-weight:700">' + U.esc(u.name) + '</div>' +
      '<button class="btn btn-sm" id="up-av-btn" style="margin-top:8px">上传头像</button>' +
      '<input type="file" id="up-av-file" accept="image/*" style="display:none">' +
      '</div></div>' +
      '<div class="field"><label class="fl">姓名</label><input type="text" id="us-name" value="' + U.esc(u.name) + '"></div>' +
      '<div class="up-role-line"><span class="badge badge-teal">CRA</span><span style="font-size:12.6px;font-weight:600">CRA 监查员</span>' +
      '<span style="font-size:11.4px;color:var(--c-text-3)">（本工具当前仅面向 CRA 角色使用）</span></div>' +
      '<div style="height:12px"></div>' +
      '<button class="link-btn" id="up-audit-link"><span>🕘</span><span>最近操作轨迹</span><span class="arr">→</span></button>';

    var save = U.el('button', { class: 'btn btn-primary', text: '保存' });
    var cancel = U.el('button', { class: 'btn btn-ghost', text: '取消' });
    var m = U.openModal('个人信息', form, [cancel, save]);

    form.querySelector('#up-av-btn').onclick = function () { form.querySelector('#up-av-file').click(); };
    form.querySelector('#up-av-file').onchange = function () {
      var f = this.files[0]; if (!f) return;
      U.fileToDataURL(f).then(function (data) {
        resizeAvatar(data, function (small) {
          setAvatar(small);
          form.querySelector('#up-av').innerHTML = '<img src="' + small + '">';
          updateUserChip();
          U.toast('头像已更新', 'ok');
        });
      });
    };
    form.querySelector('#up-audit-link').onclick = function () { m.close(); go('audit'); };
    cancel.onclick = m.close;
    save.onclick = function () {
      var name = form.querySelector('#us-name').value.trim() || '陈监查';
      S.setUser(name, 'CRA');
      S.audit('更新个人信息', name, '');
      m.close();
      updateUserChip();
      U.toast('个人信息已保存', 'ok');
      go(current);
    };
  }

  function updateUserChip() {
    var u = S.currentUser();
    document.getElementById('u-name').textContent = u.name;
    document.getElementById('u-role').textContent = 'CRA 监查员';
    var av = getAvatar();
    var holder = document.getElementById('u-avatar');
    var img = document.getElementById('u-avatar-img');
    if (av) {
      holder.childNodes[0].nodeValue = '';
      img.src = av; img.style.display = '';
    } else {
      holder.childNodes[0].nodeValue = (u.name || 'U').slice(0, 2).toUpperCase();
      img.style.display = 'none';
    }
    var rb = document.getElementById('role-badge');
    rb.textContent = 'CRA';
    rb.className = 'badge badge-teal';
  }

  /* ------------------------------------------------------------------ 深链 */
  function handleHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) return false;
    var parts = h.split('?');
    var view = parts[0];
    var qs = {};
    (parts[1] || '').split('&').forEach(function (kv) {
      if (!kv) return;
      var a = kv.split('=');
      qs[a[0]] = decodeURIComponent(a[1] || '');
    });
    if (!V[view]) return false;
    if (view === 'checklist' && qs.center) V.checklist.open(qs.center);
    go(view);
    return true;
  }

  /* ------------------------------------------------------------------ 初始化 */
  function init() {
    S.load();
    if (!S.currentUser().name || S.currentUser().name === '当前用户') S.setUser('陈监查', 'CRA');
    updateUserChip();
    renderProjects();

    document.getElementById('nav').addEventListener('click', function (e) {
      var b = e.target.closest('.nav-item');
      if (b) go(b.dataset.view);
    });
    document.getElementById('user-chip').onclick = openUserPanel;
    document.getElementById('menu-toggle').onclick = function () {
      document.getElementById('sidebar').classList.toggle('open');
    };
    document.addEventListener('click', function (e) {
      var sb = document.getElementById('sidebar');
      if (sb.classList.contains('open') && !sb.contains(e.target) && e.target.id !== 'menu-toggle' && !e.target.closest('#menu-toggle')) {
        sb.classList.remove('open');
      }
    });
    window.addEventListener('hashchange', function () { handleHash(); });

    // 供其他模块调用
    S.refreshNav = refreshNav;

    if (!handleHash()) go('dashboard');
    if (/[?&]diag=1/.test(location.search)) setTimeout(runDiagnostics, 400);
  }

  /* ------------------------------------------------------------------ 自检（?diag=1） */
  function runDiagnostics() {
    var out = [];
    var views = ['dashboard', 'ract', 'ledger', 'checklist', 'records', 'kri', 'audit', 'guide', 'share', 'centers'];
    views.forEach(function (v) {
      window.__errs.length = 0;
      try {
        go(v);
        var c = document.getElementById('content');
        var len = c.innerHTML.length;
        out.push('[VIEW] ' + v + ' ' + (len > 600 ? 'OK' : 'EMPTY') + ' len=' + len +
          (window.__errs.length ? ' ERR=' + window.__errs.join(' ; ') : ''));
      } catch (e) { out.push('[VIEW] ' + v + ' THROW ' + e.message); }
    });

    window.__errs.length = 0;
    try {
      var r = S.computeRACT({ scores: { 'C1-1': { p: 4, i: 5, d: 4 } }, weights: {}, thresholds: { high: 60, mid: 30 } });
      var it = r.items.filter(function (x) { return x.id === 'C1-1'; })[0];
      out.push('[CALC] RPN=' + it.rpn + ' level=' + it.level + ' index=' + r.index + ' items=' + r.totalCount);
      var sug = S.suggestActions(r);
      out.push('[CALC] actions.cats=' + sug.byCategory.length + ' overall=' + sug.overall.level);
    } catch (e) { out.push('[CALC] THROW ' + e.message); }

    /* RACT：折叠条目展开 + 连续打分（验证点击修复） */
    try {
      go('ract');
      var rr = document.querySelector('#ract-root');
      out.push('[RACT] steps=' + rr.querySelectorAll('.wz').length + ' accs=' + rr.querySelectorAll('.acc[data-item]').length + ' stats=' + rr.querySelectorAll('.stat').length);
      var head = rr.querySelector('[data-toggle-item="C1-1"]');
      if (head) head.click();
      ['p', 'i', 'd'].forEach(function (dim, k) {
        var val = [4, 5, 4][k];
        var b = rr.querySelector('[data-score="C1-1"][data-dim="' + dim + '"][data-val="' + val + '"]');
        if (b) b.click();
        var b2 = rr.querySelector('[data-score="C1-1"][data-dim="' + dim + '"][data-val="' + val + '"]');
        if (b2) b2.click();
      });
      var acc21 = rr.querySelector('.acc[data-item="C1-1"]');
      out.push('[RACT] scored C1-1 (4/5/4 + repeat-click) rpn=' + (acc21 ? (acc21.querySelector('[data-rpn]') || {}).textContent : 'n/a') +
        ' level=' + (acc21 ? (acc21.querySelector('[data-lvl]') || {}).textContent : 'n/a') +
        ' prog=' + (document.querySelector('#prog-text') || {}).textContent);
      var tb = rr.querySelector('[data-tab="result"]');
      if (tb) { tb.click(); out.push('[RACT] resultTab charts cat=' + !!document.getElementById('chart-cat') + ' donut=' + !!document.getElementById('chart-donut')); }
      tb = rr.querySelector('[data-tab="action"]'); if (tb) tb.click();
      tb = rr.querySelector('[data-tab="lib"]'); if (tb) tb.click(); out.push('[RACT] libRows=' + document.querySelectorAll('#ract-tab-body tbody tr').length);
      tb = rr.querySelector('[data-tab="score"]'); if (tb) tb.click();
      var nx = rr.querySelector('[data-wz-nav="next"]'); if (nx) nx.click();
      var pv = rr.querySelector('[data-wz-nav="prev"]'); if (pv) pv.click();
      out.push('[RACT] errs=' + (window.__errs.length ? window.__errs.join(' ; ') : 'none'));
    } catch (e) { out.push('[RACT] THROW ' + e.message); }

    /* 本次监察详情：确认 → 子页 → 折叠清单 → 绿色确认 → 监察记录 */
    try {
      go('checklist');
      window.__errs.length = 0;
      var sel = document.getElementById('cl-center');
      out.push('[CHK] centers=' + (sel ? sel.options.length : 'missing'));
      var gen = document.getElementById('btn-gen');
      if (gen) gen.click();
      var accs = document.querySelectorAll('#cl-list .acc');
      out.push('[CHK] runView accs=' + accs.length + ' openAtStart=' + document.querySelectorAll('#cl-list .acc.open').length + ' backBtn=' + !!document.getElementById('btn-back'));
      if (accs.length) {
        accs[0].querySelector('.acc-head').click();
        out.push('[CHK] afterExpand open=' + document.querySelectorAll('#cl-list .acc.open').length);
        var pill = accs[0].querySelector('.pill[data-st="fail"]');
        if (pill) { pill.click(); out.push('[CHK] markFail dialog=' + !!document.querySelector('.modal-mask')); }
        var saveBtn = document.querySelector('.modal-foot .btn-primary'); if (saveBtn) saveBtn.click();
      }
      var cf = document.getElementById('btn-confirm');
      if (cf) { cf.click(); var okBtn = document.querySelector('.modal-foot .btn-danger'); if (okBtn) okBtn.click(); }
      out.push('[CHK] afterConfirm recordsRows=' + document.querySelectorAll('#content table.tbl tbody tr').length +
        ' wordBtns=' + document.querySelectorAll('[data-rc-word]').length);
      out.push('[CHK] errs=' + (window.__errs.length ? window.__errs.join(' ; ') : 'none'));
    } catch (e) { out.push('[CHK] THROW ' + e.message); }

    /* 操作轨迹：日期筛选 */
    try {
      go('audit');
      window.__errs.length = 0;
      var rows0 = document.querySelectorAll('#content table.tbl tbody tr').length;
      var toEl = document.getElementById('audit-to');
      if (toEl) {
        toEl.value = '2000-01-01';
        toEl.dispatchEvent(new Event('change'));
      }
      var rows1 = document.querySelectorAll('#content table.tbl tbody tr').length;
      out.push('[AUDIT] rows0=' + rows0 + ' afterDateFilter=' + rows1);
      var cd = document.getElementById('audit-clear-date'); if (cd) cd.click();
      out.push('[AUDIT] errs=' + (window.__errs.length ? window.__errs.join(' ; ') : 'none'));
    } catch (e) { out.push('[AUDIT] THROW ' + e.message); }

    try {
      go('ledger');
      out.push('[LEDGER] rows=' + document.querySelectorAll('table.tbl tbody tr').length);
      var kb = document.querySelector('[data-view="kanban"]');
      if (kb) { kb.click(); out.push('[LEDGER] kanban cols=' + document.querySelectorAll('.kb-col').length); }
      var tr = document.querySelector('[data-view="trend"]');
      if (tr) { tr.click(); out.push('[LEDGER] trend svgs=' + document.querySelectorAll('.chart-svg').length); }
      var tv = document.querySelector('[data-view="table"]'); if (tv) tv.click();
      var nw = document.getElementById('btn-new');
      if (nw) { nw.click(); out.push('[LEDGER] formModal=' + !!document.querySelector('.modal-mask')); }
      var mx = document.querySelector('.modal-x'); if (mx) mx.click();
      out.push('[LEDGER] errs=' + (window.__errs.length ? window.__errs.join(' ; ') : 'none'));
    } catch (e) { out.push('[LEDGER] THROW ' + e.message); }

    /* 头像弹层 */
    try {
      window.__errs.length = 0;
      document.getElementById('user-chip').click();
      out.push('[USER] modal=' + !!document.querySelector('.modal-mask') + ' uploadBtn=' + !!document.getElementById('up-av-btn') + ' auditLink=' + !!document.getElementById('up-audit-link') + ' roleRadios=' + document.querySelectorAll('input[name=us-role]').length);
      var x2 = document.querySelector('.modal-x'); if (x2) x2.click();
      out.push('[USER] errs=' + (window.__errs.length ? window.__errs.join(' ; ') : 'none'));
    } catch (e) { out.push('[USER] THROW ' + e.message); }

    try {
      go('share');
      var cv = document.querySelector('#qr-main canvas');
      out.push('[QR] canvas=' + (cv ? cv.width + 'x' + cv.height : 'MISSING') + ' centerQRsection=' + !!document.getElementById('qr-centers'));
    } catch (e) { out.push('[QR] THROW ' + e.message); }

    out.push('[ENV] QRCode=' + (typeof global.QRCode) + ' store=' + (typeof S.computeRACT) + ' data=' + D.RISK_CATEGORIES.length + 'cats/' + D.CHECKLIST_TEMPLATES.length + 'tpls');
    try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); out.push('[ENV] localStorage=OK'); } catch (e) { out.push('[ENV] localStorage=FAIL ' + e.message); }

    var pre = document.createElement('pre');
    pre.id = 'diag-result';
    pre.textContent = '=== DIAG START ===\n' + out.join('\n') + '\n=== DIAG END ===';
    pre.style.display = 'none';
    document.body.appendChild(pre);
  }

  global.RBM_App = { go: go, refreshNav: refreshNav, renderProjects: renderProjects, openUserPanel: openUserPanel, getAvatar: getAvatar };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
