/* =============================================================================
 * RBM Toolkit · RACT 数字化评分系统 (view-ract.js) · v2
 * 精简为评分向导 · 条目折叠展开 · 原位刷新修复点击失灵 · 评估库
 * ========================================================================== */
(function (global) {
  'use strict';
  var U = global.RBM_Utils, S = global.RBM_Store, D = global.RBM_Data;
  global.RBM_Views = global.RBM_Views || {};

  var st = {
    ractId: null,
    scope: 'study',
    centerId: '',
    scores: {},
    weights: {},
    thresholds: null,     // 使用系统默认（高≥60 / 中≥30），界面不再提供调整
    wizIdx: 0,
    status: '草稿',
    tab: 'score',
    openItems: {}         // 条目折叠状态，默认收起
  };

  function blankState() {
    var w = {};
    D.RISK_CATEGORIES.forEach(function (c) { w[c.id] = c.weight; });
    return { ractId: null, scope: 'study', centerId: '', scores: {}, weights: w, thresholds: null, wizIdx: 0, status: '草稿', tab: 'score', openItems: {} };
  }

  function loadRACT(id) {
    var db = S.load();
    var r = db.racts.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    st.ractId = r.id;
    st.scores = JSON.parse(JSON.stringify(r.scores || {}));
    st.weights = Object.assign({}, r.weights || {});
    st.thresholds = r.thresholds || null;
    st.status = r.status || '草稿';
    st.openItems = {};
  }

  function result() { return S.computeRACT(st); }
  function thresholds() { return st.thresholds || S.load().settings.thresholds; }

  function getProject() {
    var db = S.load();
    var id = db.meta.activeProject;
    return db.projects.filter(function (p) { return p.id === id; })[0] || db.projects[0] || null;
  }

  function ratioLevel(ratio) {
    var t = S.load().settings.indexThresholds;
    var v = ratio * 100;
    return v >= t.high ? '高' : v >= t.mid ? '中' : v > 0 ? '低' : '未评估';
  }

  /* ================================================================ 渲染入口 */
  function render(root, ctx) {
    if (ctx && ctx.loadRactId) { loadRACT(ctx.loadRactId); ctx.loadRactId = null; }
    if (ctx && ctx.tab) { st.tab = ctx.tab; }
    root.innerHTML = '<div id="ract-root"></div>';
    var rr = root.querySelector('#ract-root');
    rr.onclick = onClick;
    rr.onchange = onChange;
    paint(rr);
  }

  function paint(rr) {
    rr.innerHTML = toolbar(result()) + '<div id="ract-tab-body"></div>';
    renderTab(rr, result());
  }

  /* ================================================================ 工具栏（精简） */
  function toolbar(r) {
    var editable = S.can('ractEdit');
    return '' +
      '<div class="card" style="margin-bottom:13px">' +
      '<div class="card-body" style="padding:13px 16px">' +
      '<div class="row" style="align-items:center;gap:12px;flex-wrap:wrap">' +
      '<div style="flex:1 1 260px;min-width:200px">' +
      '<div style="display:flex;justify-content:space-between;font-size:11.4px;color:var(--c-text-3);margin-bottom:4px">' +
      '<span id="prog-text">评分进度 ' + r.scoredCount + ' / ' + r.totalCount + ' 项</span><span id="prog-pct">' + r.progress + '%</span></div>' +
      '<div class="pbar"><i style="width:' + r.progress + '%;background:' + U.levelColor(r.level) + '"></i></div>' +
      '</div>' +
      '<span class="badge ' + statusBadge(st.status) + '">' + U.esc(st.status) + '</span>' +
      '<div class="spacer"></div>' +
      '<div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center">' +
      '<button class="btn btn-ghost btn-sm" id="btn-fill-demo">载入示例评分</button>' +
      '<button class="btn btn-ghost btn-sm" id="btn-clear">清空</button>' +
      '<button class="btn btn-sm" id="btn-print">导出 PDF</button>' +
      '<button class="btn btn-primary btn-sm" id="btn-save"' + (editable ? '' : ' disabled') + '>保存评估</button>' +
      '</div></div>' +
      '<div style="margin-top:12px">' + tabs() + '</div>' +
      '</div></div>' +
      '<div id="ract-tab-body"></div>';
  }

  function statusBadge(s) {
    return s === '已发布' ? 'badge-teal' : s === '已签署' ? 'badge-blue' : 'badge-gray';
  }

  function tabs() {
    var t = [['score', '评分向导'], ['result', '结果与分级'], ['action', '监查策略建议'], ['lib', '评估库']];
    return '<div class="seg" id="ract-tabs">' +
      t.map(function (x) { return '<button data-tab="' + x[0] + '"' + (st.tab === x[0] ? ' class="active"' : '') + '>' + x[1] + '</button>'; }).join('') +
      '</div>';
  }

  function renderTab(root, r) {
    var body = root.querySelector('#ract-tab-body');
    if (!body) return;
    if (st.tab === 'score') body.innerHTML = wizardView(r);
    else if (st.tab === 'result') body.innerHTML = resultView(r);
    else if (st.tab === 'action') body.innerHTML = actionView(r);
    else body.innerHTML = libView();
    bindCharts(body, r);
  }

  /* ================================================================ 评分向导（条目折叠，默认收起） */
  function wizardView(r) {
    var cat = D.RISK_CATEGORIES[st.wizIdx] || D.RISK_CATEGORIES[0];
    var cr = r.categories.filter(function (c) { return c.id === cat.id; })[0];
    var steps = D.RISK_CATEGORIES.map(function (c, i) {
      var ccr = r.categories.filter(function (x) { return x.id === c.id; })[0];
      var done = ccr.items.every(function (x) { return x.scored; });
      return '<div class="wz' + (i === st.wizIdx ? ' active' : (done ? ' done' : '')) + '" data-n="' + (i + 1) + '" data-wz="' + i + '" title="' + U.esc(c.name) + '">' + U.esc(c.name) + '</div>';
    }).join('');

    var remain = cat.items.filter(function (it) {
      var s = st.scores[it.id] || {};
      return !(s.p && s.i && s.d);
    }).length;

    return '' +
      '<div class="wizard-steps" style="margin-bottom:14px">' + steps + '</div>' +
      '<div class="card"><div class="card-head">' +
      '<span style="font-size:16px">' + cat.icon + '</span>' +
      '<h2>' + U.esc(cat.name) + '</h2>' +
      '<span class="sub">第 ' + (st.wizIdx + 1) + ' / 9 类</span>' +
      '<span class="badge ' + U.levelClass(ratioLevel(cr.ratio)) + '" id="cat-ratio">类别风险 ' + Math.round(cr.ratio * 1000) / 10 + '%</span>' +
      '<div class="spacer"></div>' +
      '<span class="cat-weight" style="display:flex;align-items:center;gap:5px">' +
      '<span style="font-size:10.4px;color:var(--c-text-3)">权重</span>' +
      '<input type="number" step="0.1" min="0.1" max="3" value="' + cr.weight + '" data-weight="' + cat.id + '" style="width:54px;padding:3px 6px;font-size:12px;text-align:center" title="类别权重，影响综合风险指数"></span>' +
      '</div>' +
      '<div class="card-body" style="padding:13px 15px">' +
      '<div style="font-size:12.2px;color:var(--c-text-2);margin-bottom:10px">' + U.esc(cat.desc) + ' · 点击条目展开 P / I / D 评分（1–5 分）。</div>' +
      cat.items.map(function (it) { return wzItem(it); }).join('') +
      '</div>' +
      '<div class="card-foot">' +
      '<button class="btn btn-sm" data-wz-nav="prev"' + (st.wizIdx === 0 ? ' disabled' : '') + '>← 上一类</button>' +
      '<button class="btn btn-primary btn-sm" data-wz-nav="next"' + (st.wizIdx === D.RISK_CATEGORIES.length - 1 ? ' disabled' : '') + '>下一类 →</button>' +
      '<div class="spacer"></div>' +
      '<span id="wz-remain" ' + (remain ? 'style="font-size:11.8px;color:var(--c-text-3)"' : 'class="badge lv-low"') + '>' +
      (remain ? '本类剩余 ' + remain + ' 项未评分' : '✓ 本类已评分完成') + '</span>' +
      '</div></div>' +
      summaryStrip(r);
  }

  function wzItem(it) {
    var sc = st.scores[it.id] || {};
    var c = S.computeItem({ p: sc.p, i: sc.i, d: sc.d });
    var lvl = S.levelOfRPN(c.rpn, thresholds());
    var open = !!st.openItems[it.id];
    return '' +
      '<div class="acc' + (open ? ' open' : '') + (c.scored ? ' done' : '') + '" data-item="' + it.id + '">' +
      '<div class="acc-head" data-toggle-item="' + it.id + '">' +
      '<span class="chev2">▼</span>' +
      '<span class="tag mono">' + it.id + '</span>' +
      '<span class="acc-title">' + U.esc(it.name) + '</span>' +
      (c.scored ? '<span class="acc-sub" data-rpn style="font-weight:700;color:' + U.levelColor(lvl) + '">' + c.rpn + '</span>' : '<span class="acc-sub" data-rpn style="color:var(--c-text-3)">未评分</span>') +
      '<span class="badge ' + U.levelClass(lvl) + '" data-lvl>' + lvl + '</span>' +
      '</div>' +
      '<div class="acc-body">' +
      '<div class="anchor-pop" style="margin:0 0 11px">评分锚点：' + U.esc(it.anchor) + '</div>' +
      scoreRow(it.id, 'p', '概率 P — 发生可能性', sc.p) +
      scoreRow(it.id, 'i', '影响 I — 后果严重度', sc.i) +
      scoreRow(it.id, 'd', '可检测度 D — 越难发现分越高', sc.d) +
      '</div></div>';
  }

  function scoreRow(itemId, dim, label, val) {
    var g = D.SCALE_GUIDE[dim.toUpperCase()];
    var cur = val ? g.anchors[Number(val) - 1] : null;
    return '' +
      '<div class="wz-score-row" data-row="' + itemId + '-' + dim + '">' +
      '<span class="lb">' + label + '</span>' +
      '<div class="score-cell ' + dim + '">' +
      [1, 2, 3, 4, 5].map(function (v) {
        return '<button class="sc' + (Number(val) === v ? ' on' : '') + '" data-score="' + itemId + '" data-dim="' + dim + '" data-val="' + v + '" title="' + U.esc(g.anchors[v - 1].t) + '">' + v + '</button>';
      }).join('') +
      '</div>' +
      '<span class="hint" data-hint>' + (cur ? U.esc(cur.t) : U.esc(g.anchors[0].t) + ' … ' + U.esc(g.anchors[4].t)) + '</span>' +
      '</div>';
  }

  /* ================================================================ 汇总条 */
  function summaryStrip(r) {
    var th = thresholds();
    function stat(lab, val, unit, cls, hint) {
      return '<div class="stat ' + cls + '"><div class="stat-lab">' + lab + '</div>' +
        '<div class="stat-val">' + val + (unit ? '<small>' + unit + '</small>' : '') + '</div>' +
        '<div class="stat-hint">' + U.esc(hint || '') + '</div></div>';
    }
    return '<div class="stat-grid" style="margin-top:13px">' +
      stat('综合风险指数', r.index, '/100', 'h-' + (r.level === '高' ? 'high' : r.level === '中' ? 'mid' : 'low'), r.level + '风险') +
      stat('加权风险总分', Math.round(r.totalWeighted), '', 'h-accent', '满分 ' + Math.round(r.maxWeighted)) +
      stat('高风险条目', r.counts['高'] || 0, '项', 'h-high', 'RPN ≥ ' + th.high) +
      stat('中风险条目', r.counts['中'] || 0, '项', 'h-mid', 'RPN ' + th.mid + '–' + (th.high - 1)) +
      stat('低风险条目', r.counts['低'] || 0, '项', 'h-low', 'RPN < ' + th.mid) +
      '</div>';
  }

  /* ================================================================ 结果视图 */
  function resultView(r) {
    var cats = r.categories.slice().sort(function (a, b) { return b.ratio - a.ratio; });
    var hot = r.items.slice().sort(function (a, b) { return b.weighted - a.weighted; }).filter(function (x) { return x.scored; }).slice(0, 12);
    var th = thresholds();

    return '' +
      summaryStrip(r) +
      '<div class="row" style="align-items:flex-start;flex-wrap:wrap;margin-bottom:0">' +
      '<div style="flex:1 1 340px;margin-bottom:0" class="card"><div class="card-head"><h2>九大类别风险占比</h2><span class="sub">按加权得分占比排序</span></div>' +
      '<div class="card-body" id="chart-cat"></div></div>' +
      '<div style="flex:0 0 250px" class="card"><div class="card-head"><h2>风险分级分布</h2></div>' +
      '<div class="card-body" style="text-align:center"><div id="chart-donut"></div>' +
      '<div class="legend" style="justify-content:center">' +
      '<span><i style="background:#dc2626"></i>高 ' + (r.counts['高'] || 0) + '</span>' +
      '<span><i style="background:#d97706"></i>中 ' + (r.counts['中'] || 0) + '</span>' +
      '<span><i style="background:#059669"></i>低 ' + (r.counts['低'] || 0) + '</span>' +
      '<span><i style="background:#cbd5e1"></i>未评估 ' + (r.counts['未评估'] || 0) + '</span>' +
      '</div></div></div>' +
      '</div>' +

      '<div class="acc-card"><div class="acc-card-head" data-acc-card="r-detail">' +
      '<h2>类别风险明细</h2><span class="sub">各类别权重 / 加权得分 / 分级</span><span class="chev2">▼</span></div>' +
      '<div class="acc-card-body" style="padding:0">' +
      '<div class="tbl-wrap"><table class="tbl">' +
      '<thead><tr><th>类别</th><th class="num">原始 RPN 合计</th><th class="num">权重</th><th class="num">加权得分</th><th class="num">风险占比</th><th class="ctr">分级</th><th class="ctr">高/中/低</th></tr></thead><tbody>' +
      cats.map(function (c) {
        return '<tr><td><b>' + U.esc(c.name) + '</b><br><span style="font-size:10.8px;color:var(--c-text-3)">' + c.code + '</span></td>' +
          '<td class="num">' + c.raw + '</td><td class="num">' + c.weight + '</td>' +
          '<td class="num"><b>' + Math.round(c.weighted) + '</b></td>' +
          '<td class="num">' + Math.round(c.ratio * 1000) / 10 + '%</td>' +
          '<td class="ctr"><span class="badge ' + U.levelClass(ratioLevel(c.ratio)) + '">' + ratioLevel(c.ratio) + '</span></td>' +
          '<td class="ctr" style="font-size:11.4px"><span style="color:#dc2626">' + (c.counts['高'] || 0) + '</span> / <span style="color:#d97706">' + (c.counts['中'] || 0) + '</span> / <span style="color:#059669">' + (c.counts['低'] || 0) + '</span></td></tr>';
      }).join('') +
      '</tbody></table></div></div></div>' +

      '<div class="acc-card"><div class="acc-card-head" data-acc-card="r-top">' +
      '<h2>TOP 12 高加权风险条目</h2><span class="sub">建议作为监查计划与访视清单的优先靶点</span><span class="chev2">▼</span></div>' +
      '<div class="acc-card-body" style="padding:0">' +
      '<div class="tbl-wrap"><table class="tbl">' +
      '<thead><tr><th>风险条目</th><th>类别</th><th class="ctr">P</th><th class="ctr">I</th><th class="ctr">D</th><th class="num">RPN</th><th class="num">加权</th><th class="ctr">分级</th></tr></thead><tbody>' +
      (hot.length ? hot.map(function (x) {
        return '<tr><td>' + U.esc(x.name) + '</td><td><span class="tag">' + x.catName + '</span></td>' +
          '<td class="ctr">' + x.p + '</td><td class="ctr">' + x.i + '</td><td class="ctr">' + x.d + '</td>' +
          '<td class="num"><b>' + x.rpn + '</b></td><td class="num">' + Math.round(x.weighted) + '</td>' +
          '<td class="ctr"><span class="badge ' + U.levelClass(x.level) + '">' + x.level + '</span></td></tr>';
      }).join('') : '<tr><td colspan="8" class="ctr" style="color:var(--c-text-3);padding:22px">尚无评分数据</td></tr>') +
      '</tbody></table></div></div></div>';
  }

  /* ================================================================ 策略视图 */
  function actionView(r) {
    var sug = S.suggestActions(r);
    var ov = sug.overall;
    return '' +
      '<div class="card" style="border-left:4px solid ' + U.levelColor(ov.level) + '">' +
      '<div class="card-head"><h2>整体监查策略建议</h2>' +
      '<span class="badge ' + U.levelClass(ov.level) + '">综合风险 ' + ov.level + '（指数 ' + r.index + '）</span></div>' +
      '<div class="card-body">' +
      '<div class="row" style="flex-wrap:wrap;gap:12px">' +
      kv('现场监查频率', ov.frequency) +
      kv('数据核查（SDV）比例', ov.sdv) +
      kv('升级与报告路径', ov.escalate) +
      '</div>' +
      '<div class="perm-note info" style="margin-top:12px;margin-bottom:0">' + U.esc(ov.notes) + '</div>' +
      '</div></div>' +

      '<div style="font-size:12.6px;font-weight:700;margin:4px 0 8px">各风险类别 · 针对性监查动作（点击展开）</div>' +
      sug.byCategory.map(function (g, i) {
        return '<div class="acc-card"><div class="acc-card-head" data-acc-card="act-' + i + '">' +
          '<span class="lv-bar" style="background:' + U.levelColor(g.level) + '"></span>' +
          '<h2>' + U.esc(g.catName) + '</h2>' +
          '<span class="badge ' + U.levelClass(g.level) + '">' + g.level + ' · ' + g.ratio + '%</span>' +
          '<span class="chev2">▼</span></div>' +
          '<div class="acc-card-body"><ul class="list-plain">' +
          g.actions.map(function (a) { return '<li><span class="dot ' + g.level + '"></span><span style="font-size:12.4px">' + U.esc(a) + '</span></li>'; }).join('') +
          '</ul></div></div>';
      }).join('') +

      '<div class="acc-card"><div class="acc-card-head" data-acc-card="hot8">' +
      '<h2>高风险条目 TOP 8 · 优先靶点</h2><span class="chev2">▼</span></div>' +
      '<div class="acc-card-body" style="padding:0">' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="num">#</th><th>风险条目</th><th>类别</th><th class="num">RPN</th><th class="num">加权</th><th class="ctr">分级</th></tr></thead><tbody>' +
      (sug.hotItems.length ? sug.hotItems.map(function (x, i) {
        return '<tr><td class="num">' + (i + 1) + '</td><td>' + U.esc(x.name) + '</td><td><span class="tag">' + x.catName + '</span></td>' +
          '<td class="num"><b>' + x.rpn + '</b></td><td class="num">' + Math.round(x.weighted) + '</td>' +
          '<td class="ctr"><span class="badge ' + U.levelClass(x.level) + '">' + x.level + '</span></td></tr>';
      }).join('') : '<tr><td colspan="6" class="ctr" style="color:var(--c-text-3);padding:22px">尚无评分数据</td></tr>') +
      '</tbody></table></div></div></div>';
  }

  function kv(k, v) {
    return '<div style="flex:1 1 230px;background:var(--c-surface-2);border-radius:9px;padding:11px 13px">' +
      '<div style="font-size:11.2px;color:var(--c-text-3);margin-bottom:3px">' + k + '</div>' +
      '<div style="font-size:12.8px;font-weight:600;line-height:1.5">' + U.esc(v) + '</div></div>';
  }

  /* ================================================================ 评估库 */
  function libView() {
    var db = S.load();
    return '' +
      '<div class="card"><div class="card-head"><h2>历史评估库</h2>' +
      '<span class="sub">历史项目 RACT 可复用为模板 · 点击「载入」进入评分向导继续编辑</span></div>' +
      '<div class="card-body tight"><div class="tbl-wrap"><table class="tbl">' +
      '<thead><tr><th>标题</th><th class="ctr">版本</th><th class="num">风险指数</th><th class="ctr">分级</th><th class="ctr">状态</th><th>更新人 / 时间</th><th class="ctr">操作</th></tr></thead><tbody>' +
      (db.racts.length ? db.racts.slice().reverse().map(function (r) {
        var res = S.computeRACT(r);
        var cur = r.id === st.ractId;
        return '<tr' + (cur ? ' class="sel"' : '') + '><td><b>' + U.esc(r.title || r.scopeLabel) + '</b>' +
          (cur ? ' <span class="tag" style="background:var(--c-primary-l);color:var(--c-primary)">当前</span>' : '') + '</td>' +
          '<td class="ctr"><span class="tag">' + U.esc(r.version) + '</span></td>' +
          '<td class="num"><b>' + res.index + '</b></td>' +
          '<td class="ctr"><span class="badge ' + U.levelClass(res.level) + '">' + res.level + '</span></td>' +
          '<td class="ctr"><span class="badge ' + (r.status === '已发布' ? 'badge-teal' : 'badge-gray') + '">' + U.esc(r.status) + '</span></td>' +
          '<td style="font-size:11.4px">' + U.esc(r.updatedBy || r.createdBy) + '<br><span style="color:var(--c-text-3)">' + U.fmtDateTime(r.updatedAt) + '</span></td>' +
          '<td class="ctr"><button class="btn btn-sm" data-load-ract="' + r.id + '">载入</button></td></tr>';
      }).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--c-text-3);padding:26px">暂无 RACT 记录，完成评分后点击「保存评估」</td></tr>') +
      '</tbody></table></div></div></div>';
  }

  /* ================================================================ 图表绑定 */
  function bindCharts(body, r) {
    var catEl = body.querySelector('#chart-cat');
    if (catEl) {
      var data = r.categories.map(function (c) {
        return { label: c.name, value: Math.round(c.ratio * 1000) / 10, max: 100, level: ratioLevel(c.ratio), display: Math.round(c.ratio * 1000) / 10 + '%' };
      }).sort(function (a, b) { return b.value - a.value; });
      U.barChart(catEl, data, { colorOf: function (d) { return U.levelColor(d.level); }, labelLen: 14 });
    }
    var dn = body.querySelector('#chart-donut');
    if (dn) {
      U.donut(dn, [
        { label: '高', value: r.counts['高'] || 0, color: '#dc2626' },
        { label: '中', value: r.counts['中'] || 0, color: '#d97706' },
        { label: '低', value: r.counts['低'] || 0, color: '#059669' },
        { label: '未评估', value: r.counts['未评估'] || 0, color: '#cbd5e1' }
      ], { centerNum: r.index, centerLabel: '风险指数', size: 160 });
    }
  }

  /* ================================================================ 事件 */
  function onClick(e) {
    var t = e.target.closest ? e.target.closest('[data-score],[data-toggle-item],[data-acc-card],[data-tab],[data-wz],[data-wz-nav],[data-load-ract],#btn-save,#btn-clear,#btn-fill-demo,#btn-print') : null;
    if (!t) return;
    var rr = document.getElementById('ract-root');

    /* 评分：原位更新，不做整行重建 —— 修复点击失灵 */
    if (t.dataset.score) {
      if (!S.can('ractEdit')) { U.toast('当前角色无评分权限', 'warn'); return; }
      var id = t.dataset.score, dim = t.dataset.dim, val = Number(t.dataset.val);
      st.scores[id] = st.scores[id] || {};
      st.scores[id][dim] = val;   // 直接赋值（点击已选项不再反选，避免“点了没反应”的观感）
      // 按钮态
      var cell = t.parentElement;
      U.$$('.sc', cell).forEach(function (b) { b.classList.toggle('on', Number(b.dataset.val) === val && b.dataset.dim === dim); });
      // 行内锚点提示
      var rowHint = rr.querySelector('[data-row="' + id + '-' + dim + '"] [data-hint]');
      if (rowHint) {
        var g = D.SCALE_GUIDE[dim.toUpperCase()];
        rowHint.textContent = g.anchors[val - 1].t;
      }
      updateItemLive(id);
      updateLive();
      return;
    }
    /* 条目折叠 */
    if (t.dataset.toggleItem) {
      var iid = t.dataset.toggleItem;
      st.openItems[iid] = !st.openItems[iid];
      var acc = t.closest('.acc');
      if (acc) acc.classList.toggle('open', !!st.openItems[iid]);
      return;
    }
    /* 卡片折叠 */
    if (t.dataset.accCard) {
      var card = t.closest('.acc-card');
      if (card) card.classList.toggle('open');
      return;
    }
    /* 标签页 */
    if (t.dataset.tab) {
      st.tab = t.dataset.tab;
      U.$$('#ract-tabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === st.tab); });
      renderTab(rr, result());
      return;
    }
    /* 向导导航 */
    if (t.dataset.wz != null && t.dataset.wz !== '') { st.wizIdx = Number(t.dataset.wz); st.openItems = {}; paint(rr); return; }
    if (t.dataset.wzNav) {
      st.wizIdx += (t.dataset.wzNav === 'next' ? 1 : -1);
      st.wizIdx = Math.max(0, Math.min(D.RISK_CATEGORIES.length - 1, st.wizIdx));
      st.openItems = {};
      paint(rr);
      return;
    }
    /* 载入历史评估 */
    if (t.dataset.loadRact) {
      loadRACT(t.dataset.loadRact);
      st.tab = 'score';
      U.toast('已载入历史评估，可继续编辑', 'ok');
      paint(rr);
      return;
    }
    /* 动作 */
    switch (t.id) {
      case 'btn-save': doSave(); break;
      case 'btn-clear':
        U.confirmDialog('清空评分', '将清空当前所有 P/I/D 打分（权重保留），此操作不可撤销。', function () {
          st.scores = {}; st.ractId = null; st.status = '草稿'; paint(rr); U.toast('已清空评分', 'ok');
        }, '清空');
        break;
      case 'btn-fill-demo': fillDemo(); paint(rr); U.toast('已载入示范评分数据', 'ok'); break;
      case 'btn-print': printRACT(); break;
    }
  }

  function onChange(e) {
    var t = e.target;
    if (t.dataset && t.dataset.weight) {
      if (!S.can('ractEdit')) { t.value = st.weights[t.dataset.weight]; return; }
      var w = Number(t.value);
      if (!(w > 0)) { w = 1; t.value = 1; }
      st.weights[t.dataset.weight] = w;
      updateLive();
    }
  }

  /* 单个条目头部原位刷新 */
  function updateItemLive(id) {
    var rr = document.getElementById('ract-root');
    var acc = rr ? rr.querySelector('.acc[data-item="' + id + '"]') : null;
    if (!acc) return;
    var sc = st.scores[id] || {};
    var c = S.computeItem({ p: sc.p, i: sc.i, d: sc.d });
    var lvl = S.levelOfRPN(c.rpn, thresholds());
    var nEl = acc.querySelector('[data-rpn]');
    if (nEl) {
      if (c.scored) { nEl.textContent = c.rpn; nEl.style.color = U.levelColor(lvl); nEl.style.fontWeight = '700'; }
      else { nEl.textContent = '未评分'; nEl.style.color = 'var(--c-text-3)'; nEl.style.fontWeight = ''; }
    }
    var lEl = acc.querySelector('[data-lvl]');
    if (lEl) { lEl.textContent = lvl; lEl.className = 'badge ' + U.levelClass(lvl); }
    acc.classList.toggle('done', !!c.scored);
  }

  /* 全局轻量刷新：进度 / 汇总 / 类别占比 / 向导步骤与剩余提示 */
  function updateLive() {
    var rr = document.getElementById('ract-root');
    if (!rr) return;
    var r = result();
    var pbar = rr.querySelector('.pbar > i');
    if (pbar) { pbar.style.width = r.progress + '%'; pbar.style.background = U.levelColor(r.level); }
    var pt = rr.querySelector('#prog-text'); if (pt) pt.textContent = '评分进度 ' + r.scoredCount + ' / ' + r.totalCount + ' 项';
    var pp = rr.querySelector('#prog-pct'); if (pp) pp.textContent = r.progress + '%';
    var sts = rr.querySelectorAll('.stat');
    function setStat(i, v, unit) {
      if (!sts[i]) return;
      var val = sts[i].querySelector('.stat-val');
      if (val) val.innerHTML = v + '<small>' + (unit || '') + '</small>';
    }
    setStat(0, r.index, '/100');
    setStat(1, Math.round(r.totalWeighted), '');
    setStat(2, r.counts['高'] || 0, '项');
    setStat(3, r.counts['中'] || 0, '项');
    setStat(4, r.counts['低'] || 0, '项');
    // 当前类别占比
    var cat = D.RISK_CATEGORIES[st.wizIdx];
    if (cat) {
      var cr = r.categories.filter(function (x) { return x.id === cat.id; })[0];
      var cb = rr.querySelector('#cat-ratio');
      if (cb && cr) {
        cb.textContent = '类别风险 ' + Math.round(cr.ratio * 1000) / 10 + '%';
        cb.className = 'badge ' + U.levelClass(ratioLevel(cr.ratio));
      }
      // 本类剩余提示
      var remainEl = rr.querySelector('#wz-remain');
      if (remainEl) {
        var remain = cat.items.filter(function (it) {
          var s = st.scores[it.id] || {};
          return !(s.p && s.i && s.d);
        }).length;
        if (remain) { remainEl.className = ''; remainEl.style.cssText = 'font-size:11.8px;color:var(--c-text-3)'; remainEl.textContent = '本类剩余 ' + remain + ' 项未评分'; }
        else { remainEl.className = 'badge lv-low'; remainEl.style.cssText = ''; remainEl.textContent = '✓ 本类已评分完成'; }
      }
      // 向导步骤完成态
      D.RISK_CATEGORIES.forEach(function (c, i) {
        var node = rr.querySelector('.wz[data-wz="' + i + '"]');
        if (!node) return;
        var ccr = r.categories.filter(function (x) { return x.id === c.id; })[0];
        var done = ccr.items.every(function (x) { return x.scored; });
        node.classList.toggle('done', done && i !== st.wizIdx);
      });
    }
  }

  /* ================================================================ 保存 */
  function doSave() {
    if (!S.can('ractEdit')) { U.toast('当前角色无保存权限', 'warn'); return; }
    var r = result();
    if (r.scoredCount === 0) { U.toast('请至少完成一项评分', 'warn'); return; }
    var proj = getProject();
    var scopeLabel = '项目级 RACT · ' + (proj ? proj.shortName : '');
    var title = (proj ? proj.shortName + ' ' : '') + '风险评估';

    var rec = S.saveRACT({
      id: st.ractId,
      projectId: proj ? proj.id : '',
      scope: 'study',
      centerId: '',
      centerName: '',
      scopeLabel: scopeLabel,
      title: title,
      scores: st.scores,
      weights: st.weights,
      thresholds: thresholds(),
      index: r.index,
      level: r.level,
      status: st.status
    }, st.ractId ? '评分修订（指数 ' + r.index + '，' + r.level + '风险）' : '创建评估（指数 ' + r.index + '，' + r.level + '风险）');

    st.ractId = rec.id; st.status = rec.status;
    U.toast('已保存：' + rec.version + ' · 综合风险指数 ' + r.index, 'ok');
    if (S.refreshNav) S.refreshNav();
  }

  function fillDemo() {
    var demo = {
      'C1-1': [3, 4, 2], 'C1-2': [5, 5, 4], 'C1-3': [4, 4, 3], 'C1-4': [2, 3, 2], 'C1-5': [3, 4, 3], 'C1-6': [3, 4, 3], 'C1-7': [2, 5, 3],
      'C2-1': [3, 3, 2], 'C2-2': [4, 5, 3], 'C2-3': [3, 4, 2], 'C2-4': [3, 3, 2], 'C2-5': [4, 4, 3], 'C2-6': [4, 4, 3],
      'C3-1': [4, 5, 4], 'C3-2': [4, 4, 3], 'C3-3': [3, 3, 3], 'C3-4': [3, 3, 2], 'C3-5': [5, 4, 4], 'C3-6': [4, 3, 3], 'C3-7': [2, 3, 2],
      'C4-1': [4, 4, 4], 'C4-2': [3, 5, 4], 'C4-3': [5, 4, 3], 'C4-4': [4, 4, 5], 'C4-5': [3, 3, 3], 'C4-6': [3, 4, 4], 'C4-7': [3, 3, 4],
      'C5-1': [5, 5, 4], 'C5-2': [3, 4, 4], 'C5-3': [4, 4, 5], 'C5-4': [2, 5, 4], 'C5-5': [3, 5, 4], 'C5-6': [3, 4, 4],
      'C6-1': [4, 5, 3], 'C6-2': [3, 4, 2], 'C6-3': [3, 3, 4], 'C6-4': [3, 5, 3], 'C6-5': [2, 4, 3], 'C6-6': [3, 3, 3],
      'C7-1': [3, 4, 4], 'C7-2': [2, 4, 3], 'C7-3': [3, 3, 4], 'C7-4': [2, 3, 3], 'C7-5': [3, 4, 4], 'C7-6': [3, 5, 3],
      'C8-1': [3, 3, 2], 'C8-2': [3, 4, 3], 'C8-3': [4, 5, 4], 'C8-4': [3, 4, 3], 'C8-5': [2, 5, 4], 'C8-6': [3, 4, 3],
      'C9-1': [3, 4, 3], 'C9-2': [3, 3, 3], 'C9-3': [3, 3, 4], 'C9-4': [5, 4, 3], 'C9-5': [4, 4, 3], 'C9-6': [3, 4, 3], 'C9-7': [3, 3, 3]
    };
    Object.keys(demo).forEach(function (k) { st.scores[k] = { p: demo[k][0], i: demo[k][1], d: demo[k][2] }; });
  }

  /* ================================================================ 导出 PDF */
  function printRACT() {
    var r = result();
    var sug = S.suggestActions(r);
    var proj = getProject();
    var user = S.currentUser();
    var th = thresholds();
    var h = '';
    h += '<div class="print-head"><div><h1>基于风险的评估报告（RACT）</h1>' +
      '<div class="muted small">' + U.esc((proj ? proj.shortName : '') + ' 风险评估') + '</div></div>' +
      '<div class="print-brand">' + U.esc(S.load().settings.orgName) + '<br>RBM 监查工作台 · 导出 ' + U.fmtDateTime(new Date().toISOString()) + '</div></div>';

    h += '<div class="kv">' +
      '<div class="k">项目</div><div class="v">' + U.esc(proj ? proj.name : '—') + '</div>' +
      '<div class="k">方案版本</div><div class="v">' + U.esc(proj ? proj.protocolVersion : '—') + '</div>' +
      '<div class="k">评估范围</div><div class="v">项目级 RACT</div>' +
      '<div class="k">评估状态</div><div class="v">' + U.esc(st.status) + '</div>' +
      '<div class="k">综合风险指数</div><div class="v">' + r.index + ' / 100（' + r.level + '风险）</div>' +
      '<div class="k">条目分级</div><div class="v">高 ' + (r.counts['高'] || 0) + ' / 中 ' + (r.counts['中'] || 0) + ' / 低 ' + (r.counts['低'] || 0) + '</div>' +
      '<div class="k">RPN 阈值</div><div class="v">高 ≥ ' + th.high + '，中 ≥ ' + th.mid + '</div>' +
      '<div class="k">评估人</div><div class="v">' + U.esc(user.name) + '（CRA）</div>' +
      '</div>';

    h += '<h2>一、整体监查策略</h2><table><thead><tr><th style="width:22%">维度</th><th>建议</th></tr></thead><tbody>' +
      '<tr><td>现场监查频率</td><td>' + U.esc(sug.overall.frequency) + '</td></tr>' +
      '<tr><td>数据核查（SDV）比例</td><td>' + U.esc(sug.overall.sdv) + '</td></tr>' +
      '<tr><td>升级与报告路径</td><td>' + U.esc(sug.overall.escalate) + '</td></tr>' +
      '<tr><td>总体说明</td><td>' + U.esc(sug.overall.notes) + '</td></tr></tbody></table>';

    h += '<h2>二、类别风险明细</h2><table><thead><tr><th>风险类别</th><th>权重</th><th>加权得分</th><th>风险占比</th><th>分级</th></tr></thead><tbody>' +
      r.categories.map(function (c) {
        return '<tr><td>' + U.esc(c.name) + '（' + c.code + '）</td><td>' + c.weight + '</td><td>' + Math.round(c.weighted) + '</td>' +
          '<td>' + Math.round(c.ratio * 1000) / 10 + '%</td><td>' + ratioLevel(c.ratio) + '</td></tr>';
      }).join('') + '</tbody></table>';

    h += '<h2>三、高风险条目明细（RPN ≥ ' + th.high + '）</h2><table><thead><tr><th>风险条目</th><th>类别</th><th>P</th><th>I</th><th>D</th><th>RPN</th><th>加权</th></tr></thead><tbody>';
    var highs = r.items.filter(function (x) { return x.level === '高'; });
    h += highs.length ? highs.map(function (x) {
      return '<tr><td>' + U.esc(x.name) + '</td><td>' + U.esc(x.catName) + '</td><td>' + x.p + '</td><td>' + x.i + '</td><td>' + x.d + '</td><td><b>' + x.rpn + '</b></td><td>' + Math.round(x.weighted) + '</td></tr>';
    }).join('') : '<tr><td colspan="7" class="muted">无高风险条目</td></tr>';
    h += '</tbody></table>';

    h += '<h2>四、针对性监查动作</h2>';
    sug.byCategory.forEach(function (g) {
      h += '<h3>' + U.esc(g.catName) + '（' + g.level + ' · ' + g.ratio + '%）</h3><ul>' +
        g.actions.map(function (a) { return '<li>' + U.esc(a) + '</li>'; }).join('') + '</ul>';
    });

    h += '<div class="sign"><div>评估人（' + U.esc(user.name) + ' / CRA) 签名 / 日期</div><div>QA / PM 审核签名 / 日期</div></div>';
    U.printHTML('RACT 风险评估报告', h, 'print-report');
  }

  global.RBM_Views.ract = {
    title: 'RACT 风险评估',
    sub: '填空即打分 · 自动算 RPN · 自动归类 · 自动关联监查策略',
    render: render,
    reset: function () {
      var b = blankState();
      Object.keys(st).forEach(function (k) { delete st[k]; });
      Object.assign(st, b);
    },
    loadRACT: loadRACT,
    state: st,
    getProject: getProject,
    ratioLevel: ratioLevel
  };
})(window);
