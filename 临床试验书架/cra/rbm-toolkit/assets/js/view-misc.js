/* =============================================================================
 * RBM Toolkit · 工作台 / 中心分层 / 操作轨迹 / KRI / 指南 / 分享 (view-misc.js) v2
 * ========================================================================== */
(function (global) {
  'use strict';
  var U = global.RBM_Utils, S = global.RBM_Store, D = global.RBM_Data;
  var V = global.RBM_Views = global.RBM_Views || {};

  function currentProject() {
    var db = S.load();
    return db.projects.filter(function (p) { return p.id === db.meta.activeProject; })[0] || db.projects[0] || null;
  }

  /* ================================================================ 工作台 */
  V.dashboard = {
    title: '监控工作台',
    sub: '',
    render: function (root) {
      var proj = currentProject();
      if (!proj) {
        root.innerHTML = '<div class="card"><div class="card-body"><div class="empty"><div class="ic">◱</div><h3>尚未创建项目</h3><p>点击右上角「项目管理」新建一个临床研究项目。</p></div></div></div>';
        return;
      }
      var db = S.load();
      var centers = proj.centers || [];
      var ledger = db.ledger.filter(function (l) { return l.projectId === proj.id; });
      var racts = db.racts.filter(function (r) { return r.projectId === proj.id; });
      var latest = racts.sort(function (a, b) { return (a.updatedAt || '') < (b.updatedAt || '') ? 1 : -1; })[0];
      var rres = latest ? S.computeRACT(latest) : null;
      var visits = db.visits.filter(function (v) { return v.projectId === proj.id; });
      var openIssues = ledger.filter(function (l) { return l.status !== '已关闭'; });
      var overdue = openIssues.filter(function (l) { return l.dueDate && U.daysBetween(S.todayStr(), l.dueDate) < 0; });
      var escalated = ledger.filter(function (l) { return l.escalate && l.status !== '已关闭'; });
      var totalEnrolled = centers.reduce(function (a, c) { return a + (Number(c.enrolled) || 0); }, 0);
      var totalTarget = centers.reduce(function (a, c) { return a + (Number(c.target) || 0); }, 0);
      var highC = centers.filter(function (c) { return c.level === '高'; });

      root.innerHTML = '' +
        '<div class="card" style="background:linear-gradient(135deg,#0e3038,#12414a);border:none;color:#e8f3f4">' +
        '<div class="card-body" style="display:flex;gap:20px;align-items:center;flex-wrap:wrap;padding:16px 18px">' +
        '<div style="flex:1 1 320px">' +
        '<div style="font-size:11.4px;letter-spacing:1px;opacity:.65">CURRENT STUDY</div>' +
        '<div style="font-size:18px;font-weight:700;margin:4px 0 2px">' + U.esc(proj.name) + '</div>' +
        '<div style="font-size:12.4px;opacity:.78">' + U.esc(proj.phase) + ' · ' + U.esc(proj.indication) + ' · 方案 ' + U.esc(proj.protocolVersion) + ' · ' + centers.length + ' 家中心 · SDV 策略：' + U.esc(proj.sdvPolicy || '—') + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:22px;flex-wrap:wrap">' +
        heroNum('综合风险指数', rres ? rres.index : '—', rres ? rres.level : '未评估', rres ? U.levelColor(rres.level) : '#94a3b8') +
        heroNum('入组进度', totalEnrolled + '/' + (totalTarget || '—'), (totalTarget ? Math.round(totalEnrolled / totalTarget * 100) + '%' : ''), '#34d399') +
        heroNum('未闭环风险', openIssues.length, overdue.length ? '逾期 ' + overdue.length + ' 项' : '无逾期', overdue.length ? '#f87171' : '#34d399') +
        '</div>' +
        '</div></div>' +

        '<div class="stat-grid">' +
        statClick('高风险中心', highC.length, '家', 'h-high', 'RPN 指数 ≥ ' + db.settings.indexThresholds.high, 'centers') +
        statClick('在研中心总数', centers.length, '家', 'h-accent', '目标入组 ' + totalTarget + ' · 点击查看风险分层', 'centers') +
        statClick('风险条目（开放）', openIssues.length, '条', 'h-mid', '台账未闭环条目', 'ledger') +
        statClick('已升级 PM/QA', escalated.length, '条', 'h-high', '需上级介入', 'ledger') +
        statClick('已完成监察', visits.filter(function (v) { return v.status === '已完成'; }).length, '次', 'h-low', '已归档监察记录', 'records') +
        statClick('已发布 RACT', racts.filter(function (r) { return r.status === '已发布'; }).length, '份', 'h-accent', '可作为监查计划依据', 'ract') +
        '</div>' +

        '<div class="card"><div class="card-head"><h2>待处理风险 TOP</h2>' +
        '<div class="spacer"></div><button class="btn btn-sm" data-goto="ledger">查看全部</button></div>' +
        '<div class="card-body tight"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>风险</th><th>中心</th><th class="num">当前 RPN</th><th>状态</th><th>Due</th></tr></thead><tbody>' +
        (openIssues.length ? openIssues.slice().sort(function (a, b) { return (b.currentRpn || 0) - (a.currentRpn || 0); }).slice(0, 5).map(function (l) {
          var od = l.dueDate && U.daysBetween(S.todayStr(), l.dueDate) < 0;
          return '<tr style="cursor:pointer" data-risk="' + l.id + '"><td><span class="mono" style="font-size:10.6px">' + U.esc(l.riskId) + '</span><br>' + U.esc(l.description.slice(0, 34)) + '…</td>' +
            '<td style="font-size:11.6px">' + U.esc(l.centerName) + '</td>' +
            '<td class="num"><b style="color:' + U.levelColor(l.currentRpn >= 60 ? '高' : l.currentRpn >= 30 ? '中' : '低') + '">' + (l.currentRpn || '—') + '</b></td>' +
            '<td><span class="badge ' + (l.status === '已关闭' ? 'lv-low' : l.status === '已升级' ? 'lv-high' : 'lv-mid') + '">' + U.esc(l.status) + '</span></td>' +
            '<td style="font-size:11.4px' + (od ? ';color:#dc2626;font-weight:700' : '') + '">' + U.fmtDate(l.dueDate) + '</td></tr>';
        }).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--c-text-3);padding:26px">暂无未闭环风险，体系运行良好</td></tr>') +
        '</tbody></table></div></div></div>';

      root.onclick = function (e) {
        var t = e.target.closest ? e.target.closest('[data-goto],[data-risk]') : null;
        if (!t) return;
        if (t.dataset.goto) { global.RBM_App.go(t.dataset.goto); return; }
        if (t.dataset.risk) { global.RBM_App.go('ledger'); setTimeout(function () { V.ledger.openForm(t.dataset.risk); }, 60); }
      };
    }
  };

  function heroNum(lab, val, sub, color) {
    return '<div><div style="font-size:11.2px;opacity:.7">' + lab + '</div>' +
      '<div style="font-size:27px;font-weight:800;line-height:1.2;color:' + color + '">' + val + '</div>' +
      '<div style="font-size:11.2px;opacity:.72">' + sub + '</div></div>';
  }
  function statClick(lab, val, unit, cls, hint, view) {
    return '<div class="stat click ' + cls + '" data-goto="' + view + '"><span class="stat-go">查看 →</span><div class="stat-lab">' + lab + '</div>' +
      '<div class="stat-val">' + val + '<small>' + (unit || '') + '</small></div>' +
      '<div class="stat-hint">' + U.esc(hint || '') + '</div></div>';
  }
  function stat(lab, val, unit, cls, hint) {
    return '<div class="stat ' + cls + '"><div class="stat-lab">' + lab + '</div>' +
      '<div class="stat-val">' + val + '<small>' + (unit || '') + '</small></div>' +
      '<div class="stat-hint">' + U.esc(hint || '') + '</div></div>';
  }

  /* ================================================================ 中心风险分层（工作台子页） */
  V.centers = {
    title: '中心风险分层与监察资源分配',
    sub: '',
    render: function (root) {
      var proj = currentProject();
      if (!proj) { root.innerHTML = emptyCard('尚未创建项目'); return; }
      var centers = proj.centers || [];
      var db = S.load();
      var sorted = centers.slice().sort(function (a, b) { return (b.rpn || 0) - (a.rpn || 0); });
      var highC = centers.filter(function (c) { return c.level === '高'; });

      root.innerHTML = '' +
        '<div class="stat-grid">' +
        stat('在研中心', centers.length, '家', 'h-accent', proj.shortName) +
        stat('高风险中心', highC.length, '家', 'h-high', 'RPN ≥ ' + db.settings.indexThresholds.high) +
        stat('中风险中心', centers.filter(function (c) { return c.level === '中'; }).length, '家', 'h-mid', '持续跟踪') +
        stat('低风险中心', centers.filter(function (c) { return c.level === '低'; }).length, '家', 'h-low', '常规监查') +
        '</div>' +

        '<div class="card"><div class="card-head"><h2>中心风险分层与监查资源分配</h2>' +
        '<span class="sub">按综合 RPN 排序 · 高风险中心应获得更高监查频次</span></div>' +
        '<div class="card-body tight"><div class="tbl-wrap"><table class="tbl">' +
        '<thead><tr><th>中心</th><th>PI</th><th class="num">RPN</th><th class="ctr">分级</th><th class="num">入组</th><th class="num">未闭环</th><th class="num">KRI 异常</th><th>建议监查频率</th><th class="ctr">操作</th></tr></thead><tbody>' +
        sorted.map(function (c) {
          var freq = c.level === '高' ? '每 4–6 周现场' : c.level === '中' ? '每 8–12 周现场' : '每季度现场';
          return '<tr><td><b>' + U.esc(c.name) + '</b><div style="font-size:10.6px;color:var(--c-text-3)">' + U.esc(c.id) + '</div></td>' +
            '<td>' + U.esc(c.pi || '—') + '</td>' +
            '<td class="num"><b style="color:' + U.levelColor(c.level) + '">' + (c.rpn || '—') + '</b></td>' +
            '<td class="ctr"><span class="badge ' + U.levelClass(c.level) + '">' + U.esc(c.level) + '</span></td>' +
            '<td class="num">' + (c.enrolled || 0) + '/' + (c.target || '—') + '</td>' +
            '<td class="num">' + (c.openIssues || 0) + '</td>' +
            '<td class="num"' + (((c.krAnomalies || 0) > 0) ? ' style="color:#dc2626;font-weight:700"' : '') + '>' + (c.krAnomalies || 0) + '</td>' +
            '<td style="font-size:11.6px">' + freq + '</td>' +
            '<td class="ctr"><button class="btn btn-sm" data-make-checklist="' + c.id + '">生成清单</button></td></tr>';
        }).join('') +
        '</tbody></table></div></div></div>';

      root.onclick = function (e) {
        var t = e.target.closest ? e.target.closest('[data-make-checklist]') : null;
        if (!t) return;
        V.checklist.open(t.dataset.makeChecklist);
        global.RBM_App.go('checklist');
      };
    }
  };

  /* ================================================================ 最近操作轨迹（头像子页，只读 + 日期筛选） */
  V.audit = {
    title: '最近操作轨迹',
    sub: '只读记录 · 可按日期筛选',
    q: '',
    from: '',
    to: '',
    page: 1,
    render: function (root) {
      var db = S.load();
      var q = V.audit.q || '', from = V.audit.from || '', to = V.audit.to || '';
      var logs = db.audit.filter(function (a) {
        if (from && (a.ts || '').slice(0, 10) < from) return false;
        if (to && (a.ts || '').slice(0, 10) > to) return false;
        if (!q) return true;
        return (a.action + a.target + a.detail + a.user + a.role).toLowerCase().indexOf(q.toLowerCase()) >= 0;
      });

      var pageSize = 12;
      var pages = Math.max(1, Math.ceil(logs.length / pageSize));
      if (V.audit.page > pages) V.audit.page = pages;
      var start = (V.audit.page - 1) * pageSize;
      var pageLogs = logs.slice(start, start + pageSize);

      root.innerHTML = '' +
        '<div class="stat-grid">' +
        stat('筛选结果', logs.length, '条', 'h-accent', '共 ' + db.audit.length + ' 条记录') +
        stat('今日操作', db.audit.filter(function (a) { return (a.ts || '').slice(0, 10) === S.todayStr(); }).length, '条', 'h-mid', '按日期统计') +
        stat('最近操作人', logs[0] ? U.esc(logs[0].user) : '—', '', 'h-low', logs[0] ? U.fmtDateTime(logs[0].ts) : '暂无') +
        '</div>' +

        '<div class="card"><div class="card-head"><h2>操作轨迹</h2>' +
        '<span class="sub">只读 · 不可编辑</span>' +
        '<div class="spacer"></div>' +
        '<input type="date" id="audit-from" value="' + U.esc(from) + '" title="开始日期" style="width:138px;font-size:12px;padding:4px 8px">' +
        '<span style="color:var(--c-text-3);font-size:11.6px">至</span>' +
        '<input type="date" id="audit-to" value="' + U.esc(to) + '" title="结束日期" style="width:138px;font-size:12px;padding:4px 8px">' +
        '<button class="btn btn-sm" id="audit-clear-date">清除日期</button>' +
        '<input type="search" id="audit-q" placeholder="搜索操作 / 对象 / 用户" value="' + U.esc(q) + '" style="width:200px;font-size:12.4px;padding:5px 9px">' +
        '<button class="btn btn-sm" id="audit-export">导出 CSV</button></div>' +
        '<div class="card-body tight"><div class="tbl-wrap"><table class="tbl">' +
        '<thead><tr><th style="width:132px">时间</th><th style="width:82px">用户</th><th style="width:60px">角色</th><th style="width:126px">操作</th><th>对象</th><th>详情</th></tr></thead><tbody>' +
        (pageLogs.length ? pageLogs.map(function (a) {
          return '<tr><td style="font-size:11.4px">' + U.fmtDateTime(a.ts) + '</td>' +
            '<td>' + U.esc(a.user) + '</td><td><span class="tag">' + U.esc(a.role) + '</span></td>' +
            '<td>' + U.esc(a.action) + '</td><td style="font-size:11.8px">' + U.esc(a.target) + '</td>' +
            '<td style="font-size:11.6px;color:var(--c-text-2)">' + U.esc(a.detail) + '</td></tr>';
        }).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--c-text-3);padding:26px">该日期范围内无记录</td></tr>') +
        '</tbody></table></div>' +
        (pages > 1 ? '<div style="display:flex;gap:8px;align-items:center;justify-content:center;padding:11px">' +
          '<button class="btn btn-sm" data-pg="prev"' + (V.audit.page === 1 ? ' disabled' : '') + '>上一页</button>' +
          '<span style="font-size:12px;color:var(--c-text-3)">' + V.audit.page + ' / ' + pages + '</span>' +
          '<button class="btn btn-sm" data-pg="next"' + (V.audit.page === pages ? ' disabled' : '') + '>下一页</button></div>' : '') +
        '</div></div>';

      var qEl = root.querySelector('#audit-q');
      qEl.oninput = U.debounce(function () { V.audit.q = this.value; V.audit.page = 1; V.audit.render(root); }, 260);
      root.querySelector('#audit-from').onchange = function () { V.audit.from = this.value; V.audit.page = 1; V.audit.render(root); };
      root.querySelector('#audit-to').onchange = function () { V.audit.to = this.value; V.audit.page = 1; V.audit.render(root); };
      root.querySelector('#audit-clear-date').onclick = function () { V.audit.from = ''; V.audit.to = ''; V.audit.page = 1; V.audit.render(root); };
      root.querySelector('#audit-export').onclick = function () {
        U.downloadCSV('操作轨迹_' + S.todayStr() + '.csv', logs.map(function (a) {
          return { time: a.ts, user: a.user, role: a.role, action: a.action, target: a.target, detail: a.detail };
        }), [{ label: '时间', value: 'time' }, { label: '用户', value: 'user' }, { label: '角色', value: 'role' }, { label: '操作', value: 'action' }, { label: '对象', value: 'target' }, { label: '详情', value: 'detail' }]);
        U.toast('操作轨迹已导出', 'ok');
      };
      root.onclick = function (e) {
        var t = e.target.closest ? e.target.closest('[data-pg]') : null;
        if (!t) return;
        V.audit.page += (t.dataset.pg === 'next' ? 1 : -1);
        V.audit.render(root);
      };
    }
  };

  /* ================================================================ KRI 监测 */
  V.kri = {
    title: 'KRI 指标监测',
    sub: '关键风险指标录入、警戒阈值与趋势追踪',
    centerId: '',
    render: function (root) {
      var proj = currentProject();
      if (!proj) { root.innerHTML = emptyCard('尚未创建项目'); return; }
      var centers = proj.centers || [];
      var cid = V.kri.centerId || (centers[0] ? centers[0].id : '');
      V.kri.centerId = cid;
      var vals = S.kriFor(proj.id, cid);
      var byId = {};
      vals.forEach(function (v) { byId[v.kriId] = v; });

      root.innerHTML = '' +
        '<div class="card"><div class="card-head"><h2>KRI 录入与状态</h2>' +
        '<span class="sub">录入本期实测值，系统自动判定是否触及警戒线</span>' +
        '<div class="spacer"></div>' +
        '<select id="kri-center" style="width:auto;min-width:190px">' +
        centers.map(function (c) { return '<option value="' + c.id + '"' + (cid === c.id ? ' selected' : '') + '>' + U.esc(c.name) + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="card-body tight"><div class="tbl-wrap"><table class="tbl">' +
        '<thead><tr><th>KRI 指标</th><th>关联 SOP</th><th class="num">警戒阈值</th><th class="num">本期实测</th><th class="ctr">判定</th><th style="width:150px">录入实测值</th></tr></thead><tbody>' +
        D.KRI_CATALOG.map(function (k) {
          var cur = byId[k.id];
          var abn = cur && cur.abnormal;
          return '<tr><td><b>' + U.esc(k.name) + '</b><div style="font-size:10.6px;color:var(--c-text-3)">' + k.id + ' · 单位 ' + k.unit + '</div></td>' +
            '<td style="font-size:11.6px">' + U.esc((D.SOP_TYPES.filter(function (s) { return s.id === k.sop; })[0] || {}).name || k.sop) + '</td>' +
            '<td class="num">' + k.threshold + '</td>' +
            '<td class="num"><b style="color:' + (abn ? '#dc2626' : cur ? '#059669' : 'var(--c-text-3)') + '">' + (cur ? cur.value : '未录入') + '</b></td>' +
            '<td class="ctr">' + (cur ? '<span class="badge ' + (abn ? 'lv-high' : 'lv-low') + '">' + (abn ? '超标' : '正常') + '</span>' : '<span class="badge badge-gray">待录</span>') + '</td>' +
            '<td><div style="display:flex;gap:5px"><input type="number" step="0.1" data-kri-input="' + k.id + '" placeholder="实测值" style="padding:4px 7px;font-size:12px">' +
            '<button class="btn btn-sm btn-primary" data-kri-save="' + k.id + '">记录</button></div></td></tr>';
        }).join('') +
        '</tbody></table></div></div></div>' +

        (vals.length ? '<div class="acc-card"><div class="acc-card-head" data-acc-card="kri-trend">' +
          '<h2>指标趋势（历史记录）</h2><span class="sub">点击展开各指标的历史走势与警戒线</span><span class="chev2">▼</span></div>' +
          '<div class="acc-card-body">' +
          Object.keys(byId).map(function (kid) {
            var arr = vals.filter(function (v) { return v.kriId === kid; }).sort(function (a, b) { return a.ts < b.ts ? -1 : 1; });
            if (arr.length < 2) return '';
            return '<div style="margin-bottom:18px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><b style="font-size:12.8px">' + U.esc(arr[0].kriName) + '</b>' +
              '<span class="badge ' + (arr[arr.length - 1].abnormal ? 'lv-high' : 'lv-low') + '">最新 ' + arr[arr.length - 1].value + '</span></div>' +
              '<div id="kri-' + kid + '"></div></div>';
          }).join('') + '</div></div>' : '');

      root.querySelector('#kri-center').onchange = function () {
        V.kri.centerId = this.value; V.kri.render(root);
      };
      var accHead = root.querySelector('[data-acc-card="kri-trend"]');
      if (accHead) accHead.onclick = function () { this.closest('.acc-card').classList.toggle('open'); };
      root.onclick = function (e) {
        var t = e.target.closest ? e.target.closest('[data-kri-save]') : null;
        if (!t) return;
        var kid = t.dataset.kriSave;
        var input = root.querySelector('[data-kri-input="' + kid + '"]');
        var v = input.value;
        if (v === '') { U.toast('请先填写实测值', 'warn'); return; }
        var meta = D.KRI_CATALOG.filter(function (x) { return x.id === kid; })[0];
        S.setKRI(proj.id, cid, kid, v, meta.name, meta.threshold);
        U.toast(Number(v) >= meta.threshold ? '⚠ ' + meta.name + ' 已超过警戒阈值，建议生成风险条目' : '已记录：' + meta.name + ' = ' + v, Number(v) >= meta.threshold ? 'warn' : 'ok');
        V.kri.render(root);
      };
      // 趋势图
      vals.length && Object.keys(byId).forEach(function (kid) {
        var node = root.querySelector('#kri-' + kid);
        if (!node) return;
        var arr = vals.filter(function (v) { return v.kriId === kid; }).sort(function (a, b) { return a.ts < b.ts ? -1 : 1; });
        if (arr.length < 2) return;
        U.lineChart(node, [{ name: arr[0].kriName, color: '#0f766e', points: arr.map(function (k) { var d = new Date(k.ts); return { x: U.fmtDate(k.ts).slice(5), y: k.value }; }) }],
          { height: 170, threshold: arr[0].threshold });
      });
    }
  };

  /* ================================================================ 使用指南 */
  V.guide = {
    title: '使用指南',
    sub: '工具方法论、操作路径与落地建议',
    render: function (root) {
      root.innerHTML = '' +
        '<div class="card"><div class="card-head"><h2>三分钟上手</h2><span class="sub">这套工具的完整工作流</span></div>' +
        '<div class="card-body">' +
        '<div class="wizard-steps" style="margin-bottom:6px">' +
        '<div class="wz active" data-n="1">RACT 评分</div>' +
        '<div class="wz active" data-n="2">生成监查策略</div>' +
        '<div class="wz active" data-n="3">风险台账闭环</div>' +
        '<div class="wz active" data-n="4">本次监察详情</div>' +
        '<div class="wz active" data-n="5">监察记录归档</div>' +
        '</div>' +
        '<div style="font-size:12.8px;color:var(--c-text-2);margin-top:14px">' +
        '<p style="margin:0 0 8px"><b>① RACT 评分</b>：进入「RACT 风险评估」，用评分向导对 9 大风险类别下的 60+ 个条目打分（概率 P × 影响 I × 可检测度 D）。点击条目展开打分，RPN 与分级实时更新，加权汇总为 0–100 的综合风险指数。</p>' +
        '<p style="margin:0 0 8px"><b>② 生成监查策略</b>：切换到「监查策略建议」，系统按类别风险占比自动输出差异化监查动作（现场频率、SDV 比例、升级路径）。</p>' +
        '<p style="margin:0 0 8px"><b>③ 风险台账闭环</b>：进入「动态风险台账」，新建或从中央监查/KRI 自动抽取风险事件，记录整改动作、责任人、Due Date，按需升级至 PM/QA，最终填写复盘结论完成闭环。</p>' +
        '<p style="margin:0 0 8px"><b>④ 本次监察详情</b>：选择中心、访视类型与日期后点击「确认」，系统读取该中心的 RPN、CtQ 状态、历史高频问题、残留问题与 KRI 异常，自动生成带优先级（强制/重点/常规）的监察清单。逐项展开核查，全部完成后点击右下角绿色「确认」，本次监察归档。</p>' +
        '<p style="margin:0"><b>⑤ 监察记录</b>：所有已确认的监察在「监察记录」中归档，可随时查看明细或一键导出 Word 报告（可用 WPS / Office 打开编辑打印）。发现问题可写入风险台账，形成闭环。</p>' +
        '</div></div></div>' +

        accGuide('RACT 数字化评分系统', 'RACT Builder', [
          '9 大风险类别、60+ 条子项，内置评分锚点（1–5 分行为定义）',
          'P × I × D 自动计算 RPN，按阈值自动分级（默认高 ≥60 / 中 ≥30）',
          '类别权重可调（0.1–3.0），加权归一化为 0–100 综合风险指数',
          '自动归类分级 → 自动匹配监查动作建议',
          '评估库：历史 RACT 可载入复用，保存即生成版本快照',
          '一键导出风险评估报告 PDF'
        ], 'g1') +
        accGuide('动态风险台账', 'Risk Ledger', [
          '10 类核心字段：风险 ID、描述与类别、初始/当前 RPN、中心、发现日期与人、整改动作、责任人、Due Date、实际关闭日期、升级状态、复盘结论',
          '看板视图：按中心 / 按风险等级 / 按 SOP 类型自由切换',
          '趋势分析：风险等级存量趋势、新增/闭环环比、KRI 指标趋势',
          '从中央监查 KRI 与中心历史问题库自动抽取候选风险',
          '合规稽查可读格式 CSV 导出 + 风险台账合规报告 PDF',
          '逾期预警：自动标记超过 Due Date 仍未闭环的条目'
        ], 'g2') +
        accGuide('本次监察详情 与 监察记录', 'Visit Monitoring & Records', [
          '五路输入驱动：中心 RPN / CtQ 因子 / 历史高频问题 TOP5 / 残留问题 / KRI 异常',
          '自动标注每项纳入依据与优先级（强制 / 重点 / 常规）',
          '模板库覆盖 10 类 SOP：知情同意、入选排除、方案依从、安全性、IP、数据、疗效、随机化、样本、法规',
          '现场签到（含 GPS 定位）、拍照取证（自动压缩）',
          '折叠式监察清单：默认收起，按需展开，页面不冗长',
          '绿色「确认」一键归档到监察记录；Word 报告可直接用 WPS / Office 编辑打印',
          '离线可用：导出/导入离线数据包，回到办公室再同步'
        ], 'g3') +
        accGuide('个人中心 与 操作轨迹', 'Profile & Audit Trail', [
          '点击左下角头像：可上传头像、修改姓名（当前版本仅面向 CRA 角色）',
          '头像弹层内点击「最近操作轨迹」进入只读子页，支持按日期范围筛选与关键词搜索',
          '全量操作留痕：时间、用户、角色、操作、对象、详情、设备',
          '操作轨迹可导出 CSV，满足稽查现场追溯要求'
        ], 'g4') +
        accGuide('方法论依据', 'References', [
          'ICH E6(R2/R3) GCP：要求申办者建立基于风险的质量管理体系，采用风险比例化的监查策略。',
          'TransCelerate RACT：风险评估分类工具，从方案设计、中心特征、数据完整性、安全性等维度系统识别风险。',
          'FMEA 风险优先数（RPN）：以「发生概率 × 影响程度 × 可检测难度」量化风险优先次序，D 定义为「越难发现分越高」。',
          'CtQ（Critical to Quality）：识别对数据可靠性与受试者安全至关重要的环节，作为差异化监查的核心靶点。',
          'KRI 关键风险指标：以量化指标持续监测风险趋势，触发式监查（Triggered Monitoring）的决策依据。'
        ], 'g5');

      root.onclick = function (e) {
        var t = e.target.closest ? e.target.closest('[data-acc-card]') : null;
        if (!t) return;
        t.closest('.acc-card').classList.toggle('open');
      };
    }
  };

  function accGuide(title, en, points, key) {
    return '<div class="acc-card"><div class="acc-card-head" data-acc-card="' + key + '">' +
      '<h2>' + U.esc(title) + '</h2><span class="sub">' + U.esc(en) + '</span><span class="chev2">▼</span></div>' +
      '<div class="acc-card-body"><ul class="list-plain">' +
      points.map(function (p) { return '<li><span class="dot"></span><span style="font-size:12.6px">' + U.esc(p) + '</span></li>'; }).join('') +
      '</ul></div></div>';
  }

  /* ================================================================ 分享 / 二维码 */
  V.share = {
    title: '分享 / 二维码',
    sub: '移动端扫码访问本工具',
    render: function (root) {
      var url = location.href.split('#')[0];

      root.innerHTML = '' +
        '<div class="row" style="align-items:flex-start;flex-wrap:wrap;margin-bottom:0">' +
        '<div style="flex:0 0 300px" class="card"><div class="card-head"><h2>工具访问二维码</h2></div>' +
        '<div class="card-body"><div class="qr-holder" id="qr-main"></div>' +
        '<div style="text-align:center;font-size:11.6px;color:var(--c-text-3);word-break:break-all">' + U.esc(url) + '</div>' +
        '<div style="margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">' +
        '<button class="btn btn-sm" id="btn-copy">复制链接</button>' +
        '<button class="btn btn-sm" id="btn-qr-download">下载二维码</button>' +
        '</div>' +
        '<div class="perm-note info" style="margin-top:14px;margin-bottom:0">把这个二维码打印后贴在中心办公室或研究者文件夹上，CRA 现场只需扫码即可打开监查工具，无需安装任何 App。</div>' +
        '</div></div>' +

        '<div style="flex:1 1 340px" class="card"><div class="card-head"><h2>离线与部署说明</h2></div>' +
        '<div class="card-body" style="font-size:12.6px;color:var(--c-text-2)">' +
        '<p style="margin-top:0"><b>数据存储：</b>所有数据保存在浏览器本地（localStorage），不上传服务器，符合临床数据合规要求。同一浏览器/设备上数据持续保留。</p>' +
        '<p><b>离线使用：</b>现场无网络时可正常打开工具（首次访问后浏览器会缓存页面）。完成的清单可通过「监察记录 → 离线数据同步」导出 JSON 数据包，回到办公室导入主库。</p>' +
        '<p><b>跨设备迁移：</b>在「监察记录」中导出离线数据包，在新设备导入即可；操作轨迹可在头像弹层的「最近操作轨迹」子页导出 CSV。</p>' +
        '<p style="margin-bottom:0"><b>重置数据：</b>如需恢复示范数据，点击下方按钮。</p>' +
        '<button class="btn btn-sm btn-danger" id="btn-reset" style="margin-top:12px">重置为示范数据</button>' +
        '</div></div>' +
        '</div>';

      renderQR(root.querySelector('#qr-main'), url);

      var cp = root.querySelector('#btn-copy');
      if (cp) cp.onclick = function () {
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { U.toast('链接已复制', 'ok'); }, function () { fallbackCopy(url); });
        else fallbackCopy(url);
      };
      var dl = root.querySelector('#btn-qr-download');
      if (dl) dl.onclick = function () {
        var cv = root.querySelector('#qr-main canvas');
        if (!cv) { U.toast('二维码尚未生成', 'warn'); return; }
        var a = document.createElement('a');
        a.href = cv.toDataURL('image/png');
        a.download = 'RBM监查工作台_二维码.png';
        a.click();
        U.toast('二维码已下载', 'ok');
      };
      var rs = root.querySelector('#btn-reset');
      if (rs) rs.onclick = function () {
        U.confirmDialog('重置为示范数据', '将清空当前所有评分、台账、监察记录与操作轨迹，并重新载入示范项目。此操作不可撤销。', function () {
          S.reset(true);
          U.toast('已重置为示范数据', 'ok');
          global.RBM_App.go('dashboard');
        }, '确认重置');
      };
    }
  };

  function renderQR(holder, text, size) {
    if (!holder) return;
    holder.innerHTML = '';
    if (typeof QRCode === 'undefined') {
      holder.innerHTML = '<div style="font-size:11.6px;color:var(--c-text-3);padding:20px;text-align:center">二维码组件未加载<br>请直接复制下方链接分享</div>';
      return;
    }
    try {
      new QRCode(holder, {
        text: text, width: size || 188, height: size || 188,
        colorDark: '#0e3038', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (e) {
      holder.innerHTML = '<div style="font-size:11.6px;color:var(--c-text-3);padding:16px">二维码生成失败</div>';
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); U.toast('链接已复制', 'ok'); } catch (e) { U.toast('复制失败，请手动复制', 'warn'); }
    ta.remove();
  }

  function emptyCard(msg) {
    return '<div class="card"><div class="card-body"><div class="empty"><div class="ic">◱</div><h3>' + U.esc(msg) + '</h3></div></div></div>';
  }
})(window);
