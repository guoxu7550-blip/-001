/* =============================================================================
 * RBM Toolkit · 动态风险台账 (view-ledger.js)
 * 风险事件 → 整改动作 → 升级路径 → 闭环结论 的全生命周期账本
 * ========================================================================== */
(function (global) {
  'use strict';
  var U = global.RBM_Utils, S = global.RBM_Store, D = global.RBM_Data;
  global.RBM_Views = global.RBM_Views || {};

  var st = {
    view: 'table',
    kbGroup: 'center',
    filters: { center: '', level: '', status: '', sop: '', q: '' },
    page: 1,
    pageSize: 12,
    sort: { key: 'discoveredAt', dir: 'desc' }
  };

  function entries() {
    var db = S.load();
    var proj = currentProject();
    var list = db.ledger.filter(function (l) { return !proj || l.projectId === proj.id; });
    var f = st.filters;
    if (f.center) list = list.filter(function (l) { return l.centerId === f.center; });
    if (f.status) list = list.filter(function (l) { return l.status === f.status; });
    if (f.sop) list = list.filter(function (l) { return l.sop === f.sop; });
    if (f.level) list = list.filter(function (l) { return curLevel(l) === f.level; });
    if (f.q) {
      var q = f.q.toLowerCase();
      list = list.filter(function (l) {
        return (l.description + l.riskId + (l.centerName || '') + (l.owner || '') + (l.action || '')).toLowerCase().indexOf(q) >= 0;
      });
    }
    var k = st.sort.key, dir = st.sort.dir === 'asc' ? 1 : -1;
    list = list.slice().sort(function (a, b) {
      var va = sortVal(a, k), vb = sortVal(b, k);
      if (va === vb) return 0;
      return va > vb ? dir : -dir;
    });
    return list;
  }

  function sortVal(l, k) {
    if (k === 'currentRpn') return Number(l.currentRpn) || 0;
    if (k === 'initRpn') return Number(l.initRpn) || 0;
    if (k === 'dueDate') return l.dueDate || '9999';
    if (k === 'discoveredAt') return l.discoveredAt || '';
    if (k === 'status') return l.status || '';
    if (k === 'centerName') return l.centerName || '';
    return l[k] || '';
  }

  function curLevel(l) {
    var t = { high: 60, mid: 30 };
    var r = Number(l.currentRpn) || 0;
    if (r >= t.high) return '高';
    if (r >= t.mid) return '中';
    if (r > 0) return '低';
    return '未评估';
  }

  function currentProject() {
    var db = S.load();
    return db.projects.filter(function (p) { return p.id === db.meta.activeProject; })[0] || db.projects[0] || null;
  }

  /* ================================================================ 渲染 */
  function render(root) {
    var all = entries();
    var html = st.view === 'table' ? tableHtml(all) : st.view === 'kanban' ? kanbanHtml(all) : trendHtml(all);
    root.innerHTML = toolbar(all) + '<div id="ledger-body">' + html + '</div>';
    bind(root);
  }

  function toolbar(list) {
    var proj = currentProject();
    var centers = (proj && proj.centers) || [];
    var counts = countsOf(list);
    return '' +
      '<div class="stat-grid">' +
      stat('风险条目总数', list.length, '条', 'h-accent', '当前筛选范围') +
      stat('高风险（RPN≥60）', counts['高'], '条', 'h-high', '需优先处置') +
      stat('中风险（30–59）', counts['中'], '条', 'h-mid', '持续跟踪') +
      stat('已升级 PM/QA', list.filter(function (l) { return l.escalate; }).length, '条', 'h-high', '升级路径已触发') +
      stat('逾期未闭环', list.filter(isOverdue).length, '条', 'h-high', '超过 Due Date 且未关闭') +
      stat('已闭环', counts.closed, '条', 'h-low', '闭环率 ' + (list.length ? Math.round(counts.closed / list.length * 100) : 0) + '%') +
      '</div>' +

      '<div class="card"><div class="card-body" style="padding:13px 16px">' +
      '<div class="row" style="align-items:flex-end;flex-wrap:wrap;gap:10px">' +
      '<div style="flex:1 1 165px"><label class="fl">中心</label><select id="f-center"><option value="">全部中心</option>' +
      centers.map(function (c) { return '<option value="' + c.id + '"' + (st.filters.center === c.id ? ' selected' : '') + '>' + U.esc(c.name) + '</option>'; }).join('') +
      '</select></div>' +
      '<div style="flex:0 0 108px"><label class="fl">风险等级</label><select id="f-level"><option value="">全部</option>' +
      ['高', '中', '低'].map(function (x) { return '<option' + (st.filters.level === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>' +
      '<div style="flex:0 0 128px"><label class="fl">状态</label><select id="f-status"><option value="">全部</option>' +
      ['开放', '整改中', '已升级', '已验证待关闭', '已关闭'].map(function (x) { return '<option' + (st.filters.status === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>' +
      '<div style="flex:0 0 152px"><label class="fl">SOP 类型</label><select id="f-sop"><option value="">全部</option>' +
      D.SOP_TYPES.map(function (x) { return '<option value="' + x.id + '"' + (st.filters.sop === x.id ? ' selected' : '') + '>' + U.esc(x.name) + '</option>'; }).join('') + '</select></div>' +
      '<div style="flex:2 1 190px"><label class="fl">搜索</label><input type="search" id="f-q" placeholder="风险描述 / 编号 / 中心 / 责任人" value="' + U.esc(st.filters.q) + '"></div>' +
      '<div style="flex:0 0 auto"><div class="seg" id="view-seg">' +
      '<button data-view="table"' + (st.view === 'table' ? ' class="active"' : '') + '>表格</button>' +
      '<button data-view="kanban"' + (st.view === 'kanban' ? ' class="active"' : '') + '>看板</button>' +
      '<button data-view="trend"' + (st.view === 'trend' ? ' class="active"' : '') + '>趋势</button>' +
      '</div></div>' +
      '</div>' +
      '<div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap;align-items:center">' +
      '<button class="btn btn-primary btn-sm" id="btn-new"' + (S.can('ledgerCreate') ? '' : ' disabled') + '>＋ 新建风险条目</button>' +
      '<button class="btn btn-sm" id="btn-sync"' + (S.can('ledgerCreate') ? '' : ' disabled title="需要录入权限"') + '>⟳ 从中央监查 / KRI 抽取</button>' +
      '<button class="btn btn-sm" id="btn-import">导入 CSV</button>' +
      '<button class="btn btn-sm" id="btn-export">导出 CSV（稽查格式）</button>' +
      '<button class="btn btn-sm" id="btn-report">导出合规报表 PDF</button>' +
      '<div class="spacer"></div>' +
      (st.view === 'kanban' ? '<div class="seg" id="kb-seg"><button data-kb="center"' + (st.kbGroup === 'center' ? ' class="active"' : '') + '>按中心</button><button data-kb="level"' + (st.kbGroup === 'level' ? ' class="active"' : '') + '>按风险等级</button><button data-kb="sop"' + (st.kbGroup === 'sop' ? ' class="active"' : '') + '>按 SOP 类型</button></div>' : '') +
      '</div></div></div>';
  }

  function countsOf(list) {
    var c = { '高': 0, '中': 0, '低': 0, '未评估': 0, closed: 0 };
    list.forEach(function (l) { c[curLevel(l)] = (c[curLevel(l)] || 0) + 1; if (l.status === '已关闭') c.closed++; });
    return c;
  }

  function isOverdue(l) {
    return l.status !== '已关闭' && l.dueDate && U.daysBetween(S.todayStr(), l.dueDate) < 0;
  }

  function stat(lab, val, unit, cls, hint) {
    return '<div class="stat ' + cls + '"><div class="stat-lab">' + lab + '</div>' +
      '<div class="stat-val">' + val + '<small>' + (unit || '') + '</small></div>' +
      '<div class="stat-hint">' + U.esc(hint || '') + '</div></div>';
  }

  /* ---------------------------------------------------------------- 表格 */
  function tableHtml(list) {
    var total = list.length;
    var pages = Math.max(1, Math.ceil(total / st.pageSize));
    if (st.page > pages) st.page = pages;
    var start = (st.page - 1) * st.pageSize;
    var page = list.slice(start, start + st.pageSize);

    var body = page.length ? page.map(rowHtml).join('') :
      '<tr><td colspan="11"><div class="empty"><div class="ic">▤</div><h3>暂无风险条目</h3><p>点击「新建风险条目」开始记录，或从中央监查 / KRI 自动抽取候选风险事件。</p></div></td></tr>';

    return '<div class="card"><div class="card-head"><h2>风险台账明细</h2>' +
      '<span class="sub">共 ' + total + ' 条 · 第 ' + st.page + ' / ' + pages + ' 页</span>' +
      '<div class="spacer"></div>' +
      '<div class="legend"><span><i style="background:#dc2626"></i>高</span><span><i style="background:#d97706"></i>中</span><span><i style="background:#059669"></i>低</span></div>' +
      '</div><div class="card-body tight"><div class="tbl-wrap"><table class="tbl">' +
      '<thead><tr>' +
      th('riskId', '风险 ID') + th('centerName', '中心') + '<th>风险描述</th><th>类别 / SOP</th>' +
      th('initRpn', '初始 / 当前 RPN') + th('discoveredAt', '发现') +
      '<th>整改动作 / 责任人</th>' + th('dueDate', 'Due Date') +
      '<th>升级</th>' + th('status', '状态') + '<th class="ctr">操作</th>' +
      '</tr></thead><tbody>' + body + '</tbody></table></div>' +
      (pages > 1 ? '<div style="display:flex;gap:8px;align-items:center;justify-content:center;padding:12px">' +
        '<button class="btn btn-sm" data-pg="prev"' + (st.page === 1 ? ' disabled' : '') + '>上一页</button>' +
        '<span style="font-size:12px;color:var(--c-text-3)">' + st.page + ' / ' + pages + '</span>' +
        '<button class="btn btn-sm" data-pg="next"' + (st.page === pages ? ' disabled' : '') + '>下一页</button></div>' : '') +
      '</div></div>';
  }

  function th(key, label) {
    var arrow = st.sort.key === key ? (st.sort.dir === 'asc' ? ' ↑' : ' ↓') : '';
    return '<th data-sort="' + key + '" style="cursor:pointer;user-select:none">' + label + arrow + '</th>';
  }

  function rowHtml(l) {
    var lvl = curLevel(l);
    var overdue = isOverdue(l);
    var sop = (D.SOP_TYPES.filter(function (s) { return s.id === l.sop; })[0] || {}).name || l.sop || '—';
    var cat = (D.RISK_CATEGORIES.filter(function (c) { return c.id === l.category; })[0] || {}).name || l.category || '—';
    return '<tr data-id="' + l.id + '" style="cursor:pointer">' +
      '<td class="mono">' + U.esc(l.riskId) + '</td>' +
      '<td>' + U.esc(l.centerName || '—') + '</td>' +
      '<td style="max-width:250px"><b>' + U.esc(short(l.description, 60)) + '</b>' +
      (l.conclusion ? '<div style="font-size:10.8px;color:var(--c-text-3);margin-top:2px">复盘：' + U.esc(short(l.conclusion, 46)) + '</div>' : '') + '</td>' +
      '<td><span class="tag">' + U.esc(short(cat, 10)) + '</span><br><span style="font-size:10.8px;color:var(--c-text-3)">' + U.esc(sop) + '</span></td>' +
      '<td class="num"><span style="color:var(--c-text-3)">' + (l.initRpn || '—') + '</span> → <b style="color:' + U.levelColor(lvl) + '">' + (l.currentRpn || '—') + '</b></td>' +
      '<td style="font-size:11.4px">' + U.fmtDate(l.discoveredAt) + '<div style="color:var(--c-text-3);font-size:10.6px">' + U.esc(l.discoveredBy || '') + '</div></td>' +
      '<td style="max-width:230px;font-size:11.6px">' + U.esc(short(l.action, 56)) +
      '<div style="color:var(--c-text-3);font-size:10.6px;margin-top:2px">责任人：' + U.esc(l.owner || '—') + '</div></td>' +
      '<td style="font-size:11.4px' + (overdue ? ';color:#dc2626;font-weight:700' : '') + '">' + U.fmtDate(l.dueDate) + (overdue ? ' ⚠逾期' : '') + '</td>' +
      '<td class="ctr">' + (l.escalate ? '<span class="badge lv-high">↑ ' + U.esc(l.escalateTo || 'PM/QA') + '</span>' : '<span style="color:var(--c-text-3)">—</span>') + '</td>' +
      '<td class="ctr"><span class="badge ' + statusCls(l.status) + '">' + U.esc(l.status) + '</span></td>' +
      '<td class="ctr"><button class="btn btn-sm btn-ghost" data-edit="' + l.id + '">编辑</button></td>' +
      '</tr>';
  }

  function statusCls(s) {
    return s === '已关闭' ? 'lv-low' : s === '已升级' ? 'lv-high' : s === '整改中' ? 'lv-mid' : s === '已验证待关闭' ? 'badge-blue' : 'badge-gray';
  }

  function short(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }

  /* ---------------------------------------------------------------- 看板 */
  function kanbanHtml(list) {
    var groups = [];
    if (st.kbGroup === 'center') {
      var proj = currentProject();
      ((proj && proj.centers) || []).forEach(function (c) {
        groups.push({ key: c.id, name: c.name, level: '低', items: list.filter(function (l) { return l.centerId === c.id; }) });
      });
      var noCenter = list.filter(function (l) { return !l.centerId || !((proj && proj.centers) || []).some(function (c) { return c.id === l.centerId; }); });
      if (noCenter.length) groups.push({ key: '_', name: '未指定中心', level: '低', items: noCenter });
    } else if (st.kbGroup === 'level') {
      ['高', '中', '低'].forEach(function (lv) {
        groups.push({ key: lv, name: lv + '风险', level: lv, items: list.filter(function (l) { return curLevel(l) === lv; }) });
      });
    } else {
      D.SOP_TYPES.forEach(function (s) {
        var items = list.filter(function (l) { return l.sop === s.id; });
        if (items.length) groups.push({ key: s.id, name: s.name, level: '低', items: items });
      });
    }
    groups.forEach(function (g) {
      var hi = g.items.filter(function (l) { return curLevel(l) === '高'; }).length;
      if (hi) g.level = '高';
      else if (g.items.filter(function (l) { return curLevel(l) === '中'; }).length) g.level = '中';
    });
    groups.sort(function (a, b) { return b.items.length - a.items.length; });

    if (!list.length) return '<div class="card"><div class="card-body"><div class="empty"><div class="ic">▤</div><h3>暂无风险条目</h3><p>切换筛选条件或新建风险条目。</p></div></div></div>';

    return '<div class="kanban">' + groups.map(function (g) {
      return '<div class="kb-col"><div class="kb-col-head">' +
        '<span class="lv-bar" style="background:' + U.levelColor(g.level) + '"></span>' +
        U.esc(g.name) + '<span class="kb-count">' + g.items.length + '</span></div>' +
        (g.items.length ? g.items.map(function (l) {
          var lvl = curLevel(l);
          return '<div class="kb-card" data-edit="' + l.id + '">' +
            '<div class="t">' + U.esc(short(l.description, 52)) + '</div>' +
            '<div class="m"><span class="mono">' + U.esc(l.riskId) + '</span>' +
            '<span class="badge ' + U.levelClass(lvl) + '">' + lvl + ' ' + (l.currentRpn || '') + '</span>' +
            (l.escalate ? '<span class="tag" style="background:#fee2e2;color:#b91c1c">已升级</span>' : '') +
            (isOverdue(l) ? '<span class="tag" style="background:#fee2e2;color:#b91c1c">逾期</span>' : '') +
            '</div>' +
            '<div class="m" style="margin-top:4px"><span>' + U.esc(l.centerName || '') + '</span><span>' + U.fmtDate(l.dueDate) + '</span></div>' +
            '</div>';
        }).join('') : '<div style="font-size:11.6px;color:var(--c-text-3);padding:8px 3px">暂无条目</div>') +
        '</div>';
    }).join('') + '</div>';
  }

  /* ---------------------------------------------------------------- 趋势 */
  function trendHtml(list) {
    var proj = currentProject();
    var centerId = st.filters.center || ((proj && proj.centers[0]) ? proj.centers[0].id : '');
    var center = ((proj && proj.centers) || []).filter(function (c) { return c.id === centerId; })[0];

    var kris = S.kriFor(proj ? proj.id : '', centerId);
    var byKri = {};
    kris.forEach(function (k) { (byKri[k.kriId] = byKri[k.kriId] || []).push(k); });

    var months = [];
    for (var i = 5; i >= 0; i--) {
      var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    }

    // 风险开放/关闭趋势（按发现月份）
    var opened = months.map(function (m) { return list.filter(function (l) { return (l.discoveredAt || '').slice(0, 7) === m; }).length; });
    var closed = months.map(function (m) { return list.filter(function (l) { return (l.closedAt || '').slice(0, 7) === m; }).length; });

    // 风险等级趋势（累积开放）
    var levelSeries = ['高', '中', '低'].map(function (lv, idx) {
      var color = idx === 0 ? '#dc2626' : idx === 1 ? '#d97706' : '#059669';
      return {
        name: lv, color: color,
        points: months.map(function (m, mi) {
          return { x: m.slice(5) + '月', y: list.filter(function (l) {
            return curLevel(l) === lv && (!l.closedAt || l.closedAt.slice(0, 7) > m);
          }).length };
        })
      };
    });

    var topKri = Object.keys(byKri).slice(0, 3);

    return '' +
      '<div class="card"><div class="card-head"><h2>风险趋势分析</h2>' +
      '<span class="sub">近 6 个月 · 环比变化</span><div class="spacer"></div>' +
      '<span style="font-size:12px;color:var(--c-text-3)">中心：' + U.esc(center ? center.name : '全部') + '</span></div>' +
      '<div class="card-body">' +
      '<div style="font-size:12.6px;font-weight:600;margin-bottom:8px">风险等级存量趋势（有效条目数）</div>' +
      '<div id="tr-level"></div>' +
      '<div class="legend">' + levelSeries.map(function (s) { return '<span><i style="background:' + s.color + '"></i>' + s.name + '风险</span>'; }).join('') + '</div>' +
      '</div></div>' +

      '<div class="row" style="align-items:flex-start;flex-wrap:wrap">' +
      '<div style="flex:1 1 340px" class="card"><div class="card-head"><h2>新增 / 关闭 环比</h2></div>' +
      '<div class="card-body"><div id="tr-new"></div>' +
      '<div class="legend"><span><i style="background:#1d4ed8"></i>新增风险</span><span><i style="background:#059669"></i>闭环关闭</span></div></div></div>' +
      '<div style="flex:1 1 320px" class="card"><div class="card-head"><h2>当前风险状态分布</h2></div>' +
      '<div class="card-body" style="text-align:center"><div id="tr-donut"></div>' +
      '<div class="legend" style="justify-content:center">' +
      ['开放', '整改中', '已升级', '已验证待关闭', '已关闭'].map(function (s, i) {
        var colors = ['#94a3b8', '#d97706', '#dc2626', '#1d4ed8', '#059669'];
        return '<span><i style="background:' + colors[i] + '"></i>' + s + ' ' + list.filter(function (l) { return l.status === s; }).length + '</span>';
      }).join('') + '</div></div></div>' +
      '</div>' +

      (topKri.length ? '<div class="card"><div class="card-head"><h2>KRI 指标趋势（' + U.esc(center ? center.name : '') + '）</h2>' +
        '<span class="sub">虚线为方案规定的警戒阈值</span></div><div class="card-body">' +
        topKri.map(function (kid) {
          var arr = byKri[kid].slice().sort(function (a, b) { return a.ts < b.ts ? -1 : 1; });
          var pts = arr.map(function (k) {
            var d = new Date(k.ts);
            return { x: (d.getMonth() + 1) + '月', y: k.value };
          });
          var name = arr[0].kriName, th = arr[0].threshold;
          var last = arr[arr.length - 1];
          return '<div style="margin-bottom:18px">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
            '<b style="font-size:12.8px">' + U.esc(name) + '</b>' +
            '<span class="badge ' + (last.abnormal ? 'lv-high' : 'lv-low') + '">最新 ' + last.value + '（阈值 ' + th + '）</span>' +
            '</div><div id="kri-chart-' + kid + '"></div></div>';
        }).join('') + '</div></div>' : '');

  }

  function bindTrend() {
    var proj = currentProject();
    var list = entries();
    var lv = document.getElementById('tr-level');
    if (lv) {
      var months = [];
      for (var i = 5; i >= 0; i--) { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); }
      U.lineChart(lv, ['高', '中', '低'].map(function (l, idx) {
        return {
          name: l, color: idx === 0 ? '#dc2626' : idx === 1 ? '#d97706' : '#059669',
          points: months.map(function (m) {
            return { x: m.slice(5) + '月', y: list.filter(function (x) { return curLevel(x) === l && (!x.closedAt || x.closedAt.slice(0, 7) > m); }).length };
          })
        };
      }), { height: 210, max: Math.max(3, list.length) });
    }
    var nw = document.getElementById('tr-new');
    if (nw) {
      var months2 = [];
      for (var j = 5; j >= 0; j--) { var d2 = new Date(); d2.setDate(1); d2.setMonth(d2.getMonth() - j); months2.push(d2.getFullYear() + '-' + String(d2.getMonth() + 1).padStart(2, '0')); }
      U.lineChart(nw, [
        { name: '新增', color: '#1d4ed8', points: months2.map(function (m) { return { x: m.slice(5) + '月', y: list.filter(function (x) { return (x.discoveredAt || '').slice(0, 7) === m; }).length }; }) },
        { name: '关闭', color: '#059669', points: months2.map(function (m) { return { x: m.slice(5) + '月', y: list.filter(function (x) { return (x.closedAt || '').slice(0, 7) === m; }).length }; }) }
      ], { height: 210 });
    }
    var dn = document.getElementById('tr-donut');
    if (dn) {
      var colors = { '开放': '#94a3b8', '整改中': '#d97706', '已升级': '#dc2626', '已验证待关闭': '#1d4ed8', '已关闭': '#059669' };
      U.donut(dn, ['开放', '整改中', '已升级', '已验证待关闭', '已关闭'].map(function (s) {
        return { label: s, value: list.filter(function (l) { return l.status === s; }).length, color: colors[s] };
      }), { size: 160, centerNum: list.length, centerLabel: '条目总数' });
    }
    // KRI
    var centerId = st.filters.center || ((proj && proj.centers[0]) ? proj.centers[0].id : '');
    var kris = S.kriFor(proj ? proj.id : '', centerId);
    var byKri = {};
    kris.forEach(function (k) { (byKri[k.kriId] = byKri[k.kriId] || []).push(k); });
    Object.keys(byKri).slice(0, 3).forEach(function (kid) {
      var node = document.getElementById('kri-chart-' + kid);
      if (!node) return;
      var arr = byKri[kid].slice().sort(function (a, b) { return a.ts < b.ts ? -1 : 1; });
      U.lineChart(node, [{
        name: arr[0].kriName, color: '#0f766e',
        points: arr.map(function (k) { var d = new Date(k.ts); return { x: (d.getMonth() + 1) + '月', y: k.value }; })
      }], { height: 180, threshold: arr[0].threshold, max: Math.max(arr[0].threshold * 1.6, Math.max.apply(null, arr.map(function (k) { return k.value; })) * 1.15) });
    });
  }

  /* ================================================================ 表单 */
  function openForm(entryId) {
    if (!S.can(entryId ? 'ledgerEdit' : 'ledgerCreate')) { U.toast('当前角色无编辑权限', 'warn'); return; }
    var db = S.load();
    var proj = currentProject();
    var centers = (proj && proj.centers) || [];
    var l = entryId ? db.ledger.filter(function (x) { return x.id === entryId; })[0] : null;
    var e = l || {
      centerId: centers[0] ? centers[0].id : '', centerName: centers[0] ? centers[0].name : '',
      category: 'C1', sop: 'PROTOCOL', ctq: '', kri: '',
      description: '', initRpn: '', currentRpn: '',
      discoveredAt: S.todayStr(), discoveredBy: S.currentUser().name,
      action: '', owner: '', dueDate: S.addDays(S.todayStr(), 14), closedAt: '',
      escalate: false, escalateTo: '', conclusion: '', status: '开放', protocolVersion: proj ? proj.protocolVersion : ''
    };

    var form = U.el('div', {});
    form.innerHTML = '' +
      '<div class="row"><div class="field"><label class="fl">中心 *</label><select id="lf-center">' +
      centers.map(function (c) { return '<option value="' + c.id + '"' + (e.centerId === c.id ? ' selected' : '') + '>' + U.esc(c.name) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field"><label class="fl">风险类别 *</label><select id="lf-category">' +
      D.RISK_CATEGORIES.map(function (c) { return '<option value="' + c.id + '"' + (e.category === c.id ? ' selected' : '') + '>' + c.code + ' ' + U.esc(c.name) + '</option>'; }).join('') +
      '</select></div></div>' +

      '<div class="field"><label class="fl">风险描述 *</label><textarea id="lf-desc" placeholder="客观描述已发现的风险事实，避免主观判断。例：2 例 SAE 首次报告超过 24 小时时限">' + U.esc(e.description) + '</textarea></div>' +

      '<div class="row-3 row">' +
      '<div class="field"><label class="fl">初始 RPN</label><input type="number" id="lf-init" min="1" max="125" value="' + (e.initRpn || '') + '"></div>' +
      '<div class="field"><label class="fl">当前 RPN</label><input type="number" id="lf-cur" min="1" max="125" value="' + (e.currentRpn || '') + '">' +
      '<div style="font-size:10.8px;color:var(--c-text-3);margin-top:3px">整改后重新评估，用于衡量风险下降</div></div>' +
      '<div class="field"><label class="fl">关联方案版本</label><input type="text" id="lf-proto" value="' + U.esc(e.protocolVersion || '') + '"></div>' +
      '</div>' +

      '<div class="row">' +
      '<div class="field"><label class="fl">关联 CtQ 因子</label><select id="lf-ctq"><option value="">— 不关联 —</option>' +
      D.CTQ_FACTORS.map(function (c) { return '<option value="' + c.id + '"' + (e.ctq === c.id ? ' selected' : '') + '>' + U.esc(c.name) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field"><label class="fl">关联 KRI 指标</label><select id="lf-kri"><option value="">— 不关联 —</option>' +
      D.KRI_CATALOG.map(function (k) { return '<option value="' + k.id + '"' + (e.kri === k.id ? ' selected' : '') + '>' + U.esc(k.name) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field"><label class="fl">SOP 类型</label><select id="lf-sop">' +
      D.SOP_TYPES.map(function (s) { return '<option value="' + s.id + '"' + (e.sop === s.id ? ' selected' : '') + '>' + U.esc(s.name) + '</option>'; }).join('') +
      '</select></div>' +
      '</div>' +

      '<div class="row-3 row">' +
      '<div class="field"><label class="fl">发现日期 *</label><input type="date" id="lf-ddate" value="' + (e.discoveredAt || '') + '"></div>' +
      '<div class="field"><label class="fl">发现人 *</label><input type="text" id="lf-dby" value="' + U.esc(e.discoveredBy || '') + '"></div>' +
      '<div class="field"><label class="fl">状态</label><select id="lf-status">' +
      ['开放', '整改中', '已升级', '已验证待关闭', '已关闭'].map(function (s) { return '<option' + (e.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') +
      '</select></div>' +
      '</div>' +

      '<div class="field"><label class="fl">整改动作（CAPA）*</label><textarea id="lf-action" placeholder="具体、可验证的整改措施，避免「加强培训」这类不可衡量的表述">' + U.esc(e.action) + '</textarea></div>' +

      '<div class="row-3 row">' +
      '<div class="field"><label class="fl">责任人</label><input type="text" id="lf-owner" value="' + U.esc(e.owner || '') + '" placeholder="姓名（角色）"></div>' +
      '<div class="field"><label class="fl">Due Date</label><input type="date" id="lf-due" value="' + (e.dueDate || '') + '"></div>' +
      '<div class="field"><label class="fl">实际关闭日期</label><input type="date" id="lf-closed" value="' + (e.closedAt || '') + '"></div>' +
      '</div>' +

      '<div class="row" style="align-items:center;background:var(--c-surface-2);padding:11px 13px;border-radius:9px">' +
      '<div style="display:flex;align-items:center;gap:8px">' +
      '<input type="checkbox" id="lf-esc" style="width:auto;flex:0 0 auto"' + (e.escalate ? ' checked' : '') + '>' +
      '<label for="lf-esc" style="font-size:12.6px;font-weight:600;cursor:pointer">升级至上级（PM / QA）</label></div>' +
      '<div><select id="lf-escto">' +
      ['', 'PM', 'QA', 'PM/QA', '申办方医学部', '伦理委员会'].map(function (s) { return '<option value="' + s + '"' + (e.escalateTo === s ? ' selected' : '') + '>' + (s || '— 选择升级对象 —') + '</option>'; }).join('') +
      '</select></div>' +
      '</div>' +

      '<div class="field" style="margin-top:12px"><label class="fl">复盘结论（闭环说明）</label><textarea id="lf-conc" placeholder="风险闭环时的复盘结论：根本原因、整改有效性验证、是否需更新 RACT 评分">' + U.esc(e.conclusion || '') + '</textarea></div>';

    var save = U.el('button', { class: 'btn btn-primary', text: entryId ? '保存修改' : '创建条目' });
    var cancel = U.el('button', { class: 'btn btn-ghost', text: '取消' });
    var foot = [cancel];
    if (entryId && S.can('delete')) {
      var del = U.el('button', { class: 'btn btn-danger', text: '删除', style: 'margin-right:auto' });
      foot.unshift(del);
      del.onclick = function () {
        U.confirmDialog('删除风险条目', '该条目及其审计记录将被移除，此操作不可撤销。建议改为「已关闭」状态保留历史。', function () {
          S.deleteLedger(entryId); m.close(); render(document.getElementById('content')); U.toast('条目已删除', 'ok');
        }, '确认删除');
      };
    }
    foot.push(save);

    var m = U.openModal(entryId ? ('编辑风险条目 · ' + (l ? l.riskId : '')) : '新建风险条目', form, foot, true);
    cancel.onclick = m.close;
    save.onclick = function () {
      var centerId = form.querySelector('#lf-center').value;
      var center = centers.filter(function (c) { return c.id === centerId; })[0];
      var desc = form.querySelector('#lf-desc').value.trim();
      if (!desc) { U.toast('请填写风险描述', 'warn'); return; }
      var ctqSel = form.querySelector('#lf-ctq').value, kriSel = form.querySelector('#lf-kri').value;
      var payload = {
        id: entryId || undefined,
        centerId: centerId, centerName: center ? center.name : '',
        category: form.querySelector('#lf-category').value,
        sop: form.querySelector('#lf-sop').value,
        ctq: ctqSel, kri: kriSel,
        description: desc,
        initRpn: Number(form.querySelector('#lf-init').value) || null,
        currentRpn: Number(form.querySelector('#lf-cur').value) || null,
        protocolVersion: form.querySelector('#lf-proto').value,
        discoveredAt: form.querySelector('#lf-ddate').value,
        discoveredBy: form.querySelector('#lf-dby').value,
        action: form.querySelector('#lf-action').value,
        owner: form.querySelector('#lf-owner').value,
        dueDate: form.querySelector('#lf-due').value,
        closedAt: form.querySelector('#lf-closed').value || null,
        status: form.querySelector('#lf-status').value,
        escalate: form.querySelector('#lf-esc').checked,
        escalateTo: form.querySelector('#lf-escto').value,
        conclusion: form.querySelector('#lf-conc').value
      };
      if (payload.status === '已关闭' && !payload.closedAt) payload.closedAt = S.todayStr();
      S.saveLedger(payload);
      m.close();
      render(document.getElementById('content'));
      if (S.refreshNav) S.refreshNav();
      U.toast(entryId ? '已保存修改（含审计轨迹）' : '风险条目已创建', 'ok');
    };
  }

  /* ================================================================ 中央监查抽取 */
  function syncFromCentral() {
    if (!S.can('ledgerCreate')) { U.toast('当前角色无录入权限', 'warn'); return; }
    var db = S.load();
    var proj = currentProject();
    if (!proj) { U.toast('请先创建项目', 'warn'); return; }
    var cands = [];

    // 1) KRI 超标 → 候选风险
    S.kriFor(proj.id, '').concat(db.krValues.filter(function (k) { return k.projectId === proj.id; })).forEach(function (k) {
      if (!k.abnormal) return;
      var center = (proj.centers || []).filter(function (c) { return c.id === k.centerId; })[0];
      var exists = db.ledger.some(function (l) { return l.kri === k.kriId && l.centerId === k.centerId && l.status !== '已关闭'; });
      if (exists) return;
      var kriMeta = D.KRI_CATALOG.filter(function (x) { return x.id === k.kriId; })[0] || {};
      cands.push({
        source: '中央监查 / KRI',
        centerId: k.centerId, centerName: center ? center.name : '',
        kri: k.kriId, sop: kriMeta.sop || 'PROTOCOL',
        category: kriToCat(k.kriId),
        description: k.kriName + ' 达到 ' + k.value + '（警戒阈值 ' + k.threshold + '），触发风险预警',
        initRpn: 60, currentRpn: 60, action: '分析根本原因并制定 CAPA', status: '开放',
        discoveredAt: (k.ts || '').slice(0, 10), discoveredBy: '中央监查系统',
        dueDate: S.addDays(S.todayStr(), 21), escalate: false, escalateTo: ''
      });
    });

    // 2) 中心历史高频问题 → 候选风险
    (proj.centers || []).forEach(function (c) {
      (c.highRiskIssues || []).forEach(function (issue) {
        var exists = db.ledger.some(function (l) { return l.centerId === c.id && l.description.indexOf(issue.slice(0, 8)) >= 0; });
        if (exists) return;
        cands.push({
          source: '中心历史问题库',
          centerId: c.id, centerName: c.name, kri: '', sop: guessSop(issue),
          category: guessCat(issue),
          description: issue + '（中心历史高频问题，复发风险）',
          initRpn: 45, currentRpn: 45, action: '将该问题列为下次访视强制核查项并进行根因分析', status: '开放',
          discoveredAt: S.todayStr(), discoveredBy: 'RBM 风险引擎',
          dueDate: S.addDays(S.todayStr(), 30), escalate: false, escalateTo: ''
        });
      });
    });

    // 去重
    var seen = {}, uniq = [];
    cands.forEach(function (c) {
      var key = c.centerId + '|' + c.description.slice(0, 18);
      if (seen[key]) return; seen[key] = 1; uniq.push(c);
    });

    if (!uniq.length) { U.toast('未发现新的候选风险事件（已存在的条目不会重复生成）', 'info'); return; }

    var body = U.el('div', {});
    body.innerHTML = '<p style="margin-top:0;font-size:12.8px;color:var(--c-text-2)">系统扫描了中央监查 KRI 数据与中心历史问题库，识别出 <b>' + uniq.length + '</b> 条候选风险事件。勾选后点击「导入台账」即可生成正式条目。</p>' +
      '<div class="tbl-wrap" style="max-height:46vh;overflow:auto"><table class="tbl"><thead><tr><th style="width:34px"><input type="checkbox" id="ck-all" checked></th><th>来源</th><th>中心</th><th>风险描述</th><th>建议类别</th><th>SOP</th></tr></thead><tbody>' +
      uniq.map(function (c, i) {
        return '<tr><td><input type="checkbox" class="ck-cand" data-i="' + i + '" checked></td>' +
          '<td><span class="tag">' + U.esc(c.source) + '</span></td><td>' + U.esc(c.centerName) + '</td>' +
          '<td>' + U.esc(c.description) + '</td>' +
          '<td>' + U.esc(((D.RISK_CATEGORIES.filter(function (x) { return x.id === c.category; })[0] || {}).name || '')) + '</td>' +
          '<td>' + U.esc(((D.SOP_TYPES.filter(function (x) { return x.id === c.sop; })[0] || {}).name || '')) + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    var imp = U.el('button', { class: 'btn btn-primary', text: '导入台账' });
    var cancel = U.el('button', { class: 'btn btn-ghost', text: '取消' });
    var m = U.openModal('从中央监查 / KRI 自动抽取候选风险', body, [cancel, imp], true);
    cancel.onclick = m.close;
    body.querySelector('#ck-all').onchange = function () {
      U.$$('.ck-cand', body).forEach(function (ck) { ck.checked = this.checked; }, this);
    };
    imp.onclick = function () {
      var picked = U.$$('.ck-cand', body).filter(function (ck) { return ck.checked; }).map(function (ck) { return uniq[Number(ck.dataset.i)]; });
      if (!picked.length) { U.toast('请至少选择一条', 'warn'); return; }
      picked.forEach(function (c) { S.saveLedger(Object.assign({ projectId: proj.id }, c)); });
      m.close(); render(document.getElementById('content'));
      if (S.refreshNav) S.refreshNav();
      U.toast('已导入 ' + picked.length + ' 条风险条目', 'ok');
    };
  }

  function kriToCat(kid) {
    var map = { 'KRI-01': 'C1', 'KRI-02': 'C4', 'KRI-03': 'C4', 'KRI-04': 'C2', 'KRI-05': 'C5', 'KRI-06': 'C3', 'KRI-07': 'C2', 'KRI-08': 'C6', 'KRI-09': 'C4', 'KRI-10': 'C3', 'KRI-11': 'C8', 'KRI-12': 'C9' };
    return map[kid] || 'C9';
  }
  function guessSop(text) {
    if (/ICF|知情/.test(text)) return 'ICF';
    if (/SAE|AE|安全/.test(text)) return 'SAFETY';
    if (/IP|药物|温控|超温|发药/.test(text)) return 'IP';
    if (/数据|EDC|源文件|查询|录入/.test(text)) return 'DATA';
    if (/随机|盲/.test(text)) return 'RANDOM';
    if (/访视|方案违背|超窗/.test(text)) return 'PROTOCOL';
    if (/入排|筛选/.test(text)) return 'ELIGIBILITY';
    if (/样本/.test(text)) return 'SAMPLE';
    return 'PROTOCOL';
  }
  function guessCat(text) {
    if (/SAE|AE|安全|迟报/.test(text)) return 'C5';
    if (/IP|药物|温控|超温|发药/.test(text)) return 'C6';
    if (/数据|EDC|源文件|查询|录入|缺失/.test(text)) return 'C4';
    if (/ICF|知情|伦理|法规|遗传/.test(text)) return 'C8';
    if (/访视|方案违背|超窗|培训/.test(text)) return 'C9';
    if (/入排|筛选/.test(text)) return 'C2';
    return 'C3';
  }

  /* ================================================================ 导入导出 */
  function exportCSV() {
    var list = entries();
    var rows = list.map(function (l) {
      return {
        riskId: l.riskId, center: l.centerName, category: ((D.RISK_CATEGORIES.filter(function (c) { return c.id === l.category; })[0] || {}).name || l.category),
        sop: ((D.SOP_TYPES.filter(function (s) { return s.id === l.sop; })[0] || {}).name || l.sop),
        description: l.description, initRpn: l.initRpn, currentRpn: l.currentRpn, level: curLevel(l),
        discoveredAt: l.discoveredAt, discoveredBy: l.discoveredBy,
        action: l.action, owner: l.owner, dueDate: l.dueDate, closedAt: l.closedAt || '',
        overdue: isOverdue(l) ? '是' : '否',
        escalate: l.escalate ? '是' : '否', escalateTo: l.escalateTo || '',
        status: l.status, conclusion: l.conclusion || '',
        protocolVersion: l.protocolVersion || '',
        ctq: ((D.CTQ_FACTORS.filter(function (c) { return c.id === l.ctq; })[0] || {}).name || ''),
        kri: ((D.KRI_CATALOG.filter(function (k) { return k.id === l.kri; })[0] || {}).name || ''),
        updatedAt: l.updatedAt, updatedBy: l.updatedBy
      };
    });
    var headers = [
      { label: '风险 ID', value: 'riskId' }, { label: '中心', value: 'center' },
      { label: '风险类别', value: 'category' }, { label: 'SOP 类型', value: 'sop' },
      { label: '风险描述', value: 'description' },
      { label: '初始 RPN', value: 'initRpn' }, { label: '当前 RPN', value: 'currentRpn' }, { label: '风险等级', value: 'level' },
      { label: '发现日期', value: 'discoveredAt' }, { label: '发现人', value: 'discoveredBy' },
      { label: '整改动作', value: 'action' }, { label: '责任人', value: 'owner' },
      { label: 'Due Date', value: 'dueDate' }, { label: '实际关闭日期', value: 'closedAt' }, { label: '是否逾期', value: 'overdue' },
      { label: '是否升级', value: 'escalate' }, { label: '升级对象', value: 'escalateTo' },
      { label: '状态', value: 'status' }, { label: '复盘结论', value: 'conclusion' },
      { label: '关联方案版本', value: 'protocolVersion' }, { label: '关联 CtQ', value: 'ctq' }, { label: '关联 KRI', value: 'kri' },
      { label: '最后更新', value: 'updatedAt' }, { label: '更新人', value: 'updatedBy' }
    ];
    U.downloadCSV('风险台账_' + S.todayStr() + '.csv', rows, headers);
    U.toast('已导出 ' + rows.length + ' 条风险记录（稽查可读格式）', 'ok');
  }

  function exportReport() {
    var list = entries();
    var proj = currentProject();
    var counts = countsOf(list);
    var h = '';
    h += '<div class="print-head"><div><h1>风险台账合规报告</h1>' +
      '<div class="muted small">' + U.esc(proj ? proj.name : '') + '</div></div>' +
      '<div class="print-brand">' + U.esc(S.load().settings.orgName) + '<br>导出时间 ' + U.fmtDateTime(new Date().toISOString()) + '</div></div>';

    h += '<div class="kv">' +
      '<div class="k">条目总数</div><div class="v">' + list.length + '</div>' +
      '<div class="k">高风险条目</div><div class="v">' + counts['高'] + '</div>' +
      '<div class="k">已升级 PM/QA</div><div class="v">' + list.filter(function (l) { return l.escalate; }).length + '</div>' +
      '<div class="k">逾期未闭环</div><div class="v">' + list.filter(isOverdue).length + '</div>' +
      '<div class="k">已闭环</div><div class="v">' + counts.closed + '（闭环率 ' + (list.length ? Math.round(counts.closed / list.length * 100) : 0) + '%）</div>' +
      '<div class="k">导出人</div><div class="v">' + U.esc(S.currentUser().name) + '（' + S.currentUser().role + '）</div>' +
      '</div>';

    h += '<h2>一、风险条目明细</h2><table><thead><tr><th>风险 ID</th><th>中心</th><th>风险描述</th><th>初始/当前 RPN</th><th>发现</th><th>整改动作 / 责任人</th><th>Due Date</th><th>关闭</th><th>升级</th><th>状态</th></tr></thead><tbody>';
    h += list.map(function (l) {
      return '<tr><td>' + U.esc(l.riskId) + '</td><td>' + U.esc(l.centerName) + '</td><td>' + U.esc(l.description) + '</td>' +
        '<td>' + (l.initRpn || '—') + ' → <b>' + (l.currentRpn || '—') + '</b></td>' +
        '<td>' + U.fmtDate(l.discoveredAt) + '<br><span class="small muted">' + U.esc(l.discoveredBy || '') + '</span></td>' +
        '<td>' + U.esc(l.action || '') + '<br><span class="small muted">' + U.esc(l.owner || '') + '</span></td>' +
        '<td>' + U.fmtDate(l.dueDate) + (isOverdue(l) ? '<br><span style="color:#dc2626">逾期</span>' : '') + '</td>' +
        '<td>' + U.fmtDate(l.closedAt) + '</td>' +
        '<td>' + (l.escalate ? '是（' + U.esc(l.escalateTo || '') + '）' : '否') + '</td>' +
        '<td>' + U.esc(l.status) + '</td></tr>';
    }).join('') + '</tbody></table>';

    h += '<h2>二、复盘结论</h2><table><thead><tr><th style="width:14%">风险 ID</th><th>复盘结论</th></tr></thead><tbody>';
    var withConc = list.filter(function (l) { return l.conclusion; });
    h += withConc.length ? withConc.map(function (l) {
      return '<tr><td>' + U.esc(l.riskId) + '</td><td>' + U.esc(l.conclusion) + '</td></tr>';
    }).join('') : '<tr><td colspan="2" class="muted">暂无已闭环并记录复盘结论的条目</td></tr>';
    h += '</tbody></table>';

    h += '<div class="sign"><div>监查员 / 质量负责人 签名 / 日期</div><div>QA 审核签名 / 日期</div></div>';
    U.printHTML('风险台账合规报告', h, 'print-report');
  }

  function importCSV() {
    var input = document.createElement('input');
    input.type = 'file'; input.accept = '.csv,.txt';
    input.onchange = function () {
      var f = input.files[0]; if (!f) return;
      U.readFileText(f).then(function (text) {
        var lines = text.replace(/^\ufeff/, '').split(/\r?\n/).filter(function (x) { return x.trim(); });
        if (lines.length < 2) { U.toast('文件为空或缺少表头', 'warn'); return; }
        var head = parseCSVLine(lines[0]);
        var proj = currentProject();
        var centers = (proj && proj.centers) || [];
        var n = 0;
        for (var i = 1; i < lines.length; i++) {
          var cols = parseCSVLine(lines[i]);
          var o = {};
          head.forEach(function (k, idx) { o[k.trim()] = (cols[idx] || '').trim(); });
          var desc = o['风险描述'] || o['description'] || '';
          if (!desc) continue;
          var centerName = o['中心'] || o['center'] || '';
          var center = centers.filter(function (c) { return c.name === centerName; })[0];
          S.saveLedger({
            projectId: proj ? proj.id : '', centerId: center ? center.id : '', centerName: centerName,
            description: desc,
            initRpn: Number(o['初始RPN'] || o['initRpn']) || null,
            currentRpn: Number(o['当前RPN'] || o['currentRpn']) || null,
            discoveredAt: o['发现日期'] || S.todayStr(), discoveredBy: o['发现人'] || S.currentUser().name,
            action: o['整改动作'] || '', owner: o['责任人'] || '', dueDate: o['Due Date'] || '',
            status: o['状态'] || '开放', category: 'C9', sop: guessSop(desc),
            escalate: /是/.test(o['是否升级'] || ''), escalateTo: o['升级对象'] || '', conclusion: o['复盘结论'] || ''
          });
          n++;
        }
        render(document.getElementById('content'));
        if (S.refreshNav) S.refreshNav();
        U.toast('成功导入 ' + n + ' 条风险记录', n ? 'ok' : 'warn');
      });
    };
    input.click();
  }

  function parseCSVLine(line) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (q) {
        if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else {
        if (c === '"') q = true;
        else if (c === ',') { out.push(cur); cur = ''; }
        else cur += c;
      }
    }
    out.push(cur);
    return out;
  }

  /* ================================================================ 绑定 */
  function bind(root) {
    if (st.view === 'trend') bindTrend();

    function set(sel, val) { var n = root.querySelector(sel); if (!n) return; n.onchange = n.oninput = function () { st.filters[val] = this.value; st.page = 1; render(root); }; }
    set('#f-center', 'center'); set('#f-level', 'level'); set('#f-status', 'status'); set('#f-sop', 'sop'); set('#f-q', 'q');

    root.onclick = onClick;
  }

  function onClick(e) {
    var t = e.target.closest ? e.target.closest('[data-view],[data-kb],[data-sort],[data-pg],[data-edit],#btn-new,#btn-sync,#btn-export,#btn-report,#btn-import') : null;
    if (!t) return;
    var root = document.getElementById('content');
    if (t.dataset.view) { st.view = t.dataset.view; st.page = 1; render(root); return; }
    if (t.dataset.kb) { st.kbGroup = t.dataset.kb; render(root); return; }
    if (t.dataset.sort) {
      if (st.sort.key === t.dataset.sort) st.sort.dir = st.sort.dir === 'asc' ? 'desc' : 'asc';
      else { st.sort.key = t.dataset.sort; st.sort.dir = 'desc'; }
      render(root); return;
    }
    if (t.dataset.pg) { st.page += (t.dataset.pg === 'next' ? 1 : -1); render(root); return; }
    if (t.dataset.edit) { openForm(t.dataset.edit); return; }
    switch (t.id) {
      case 'btn-new': openForm(null); break;
      case 'btn-sync': syncFromCentral(); break;
      case 'btn-export': exportCSV(); break;
      case 'btn-report': exportReport(); break;
      case 'btn-import': importCSV(); break;
    }
  }

  global.RBM_Views.ledger = {
    title: '动态风险台账',
    sub: '风险事件 → 整改 → 升级 → 闭环 全生命周期账本',
    render: render,
    state: st,
    openForm: openForm,
    currentProject: currentProject
  };
})(window);
