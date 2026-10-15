/* =============================================================================
 * RBM Toolkit · 本次监察详情 + 监察记录 (view-checklist.js) · v2
 * 配置页 → 确认进入监察子页 → 折叠式监察清单 → 绿色确认存入监察记录
 * 导出为 Word(.doc) 文件，可直接用 WPS / MS Word 打开、编辑、打印
 * ========================================================================== */
(function (global) {
  'use strict';
  var U = global.RBM_Utils, S = global.RBM_Store, D = global.RBM_Data;
  var V = global.RBM_Views = global.RBM_Views || {};

  var st = {
    centerId: '',
    visitType: 'routine',
    visitDate: '',
    checklist: null,      // [{code,probe,guide,sop,role,name,source:[],priority,status,note}]
    center: null,
    ctx: null,
    visitRecId: null,
    signIn: null,
    photos: [],
    view: 'setup',        // setup | run
    openAcc: {},          // 条目展开状态，默认全部收起
    filter: 'all'
  };

  var VISIT_TYPES = [
    { id: 'routine', name: '常规监查访视（Routine）', freq: '按监查计划执行', mult: 1.0 },
    { id: 'trigger', name: '触发式监查访视（Triggered）', freq: 'KRI 超标或风险事件触发', mult: 1.35 },
    { id: 'hfi', name: '首例受试者访视（HFI）', freq: '中心首例入组后', mult: 1.2 },
    { id: 'followup', name: '整改跟踪访视（Follow-up）', freq: 'CAPA 验证', mult: 1.25 },
    { id: 'closeout', name: '关闭中心访视（Close-out）', freq: '中心关中心前', mult: 1.1 },
    { id: 'remote', name: '远程监查（Remote）', freq: '线上核查', mult: 0.8 }
  ];

  /* ================================================================ 渲染 */
  function render(root) {
    if (st.view === 'run' && st.checklist) root.innerHTML = runHtml();
    else root.innerHTML = setupHtml();
    bind(root);
  }

  function currentProject() {
    var db = S.load();
    return db.projects.filter(function (p) { return p.id === db.meta.activeProject; })[0] || db.projects[0] || null;
  }

  /* ---------------------------------------------------------------- 配置页 */
  function setupHtml() {
    var proj = currentProject();
    var centers = (proj && proj.centers) || [];
    if (!st.centerId && centers.length) st.centerId = centers[0].id;
    var center = centers.filter(function (c) { return c.id === st.centerId; })[0];
    st.center = center;

    if (!centers.length) {
      return '<div class="card"><div class="card-body"><div class="empty"><div class="ic">◫</div><h3>尚未配置研究中心</h3><p>请先在工作台中创建项目与中心。</p></div></div></div>';
    }

    var ctx = buildContext(center);
    st.ctx = ctx;

    return '' +
      '<div class="card"><div class="card-head"><h2>本次监察详情</h2></div>' +
      '<div class="card-body" style="padding:14px 16px">' +
      '<div class="compact-row">' +
      '<div style="flex:1.5 1 210px"><label class="fl">中心</label><select id="cl-center">' +
      centers.map(function (c) {
        return '<option value="' + c.id + '"' + (st.centerId === c.id ? ' selected' : '') + '>' + U.esc(c.name) + '（' + U.esc(c.pi || '') + '）· RPN ' + (c.rpn || '—') + '</option>';
      }).join('') + '</select></div>' +
      '<div style="flex:1.5 1 200px"><label class="fl">访视类型</label><select id="cl-type">' +
      VISIT_TYPES.map(function (v) { return '<option value="' + v.id + '"' + (st.visitType === v.id ? ' selected' : '') + '>' + U.esc(v.name) + '</option>'; }).join('') +
      '</select></div>' +
      '<div style="flex:0 0 148px"><label class="fl">访视日期</label><input type="date" id="cl-date" value="' + (st.visitDate || S.todayStr()) + '"></div>' +
      '<div style="flex:0 0 auto"><button class="btn btn-primary btn-lg" id="btn-gen">确认</button></div>' +
      '</div>' +
      '<div style="font-size:11.6px;color:var(--c-text-3);margin-top:10px">生成逻辑：中心 RPN 等级 → CtQ 因子异常状态 → 历史高频问题前 5 名 → 上次访视残留问题 → 当前 KRI 异常，五路输入共同决定核查项的<b>优先级</b>与<b>抽检比例</b>。</div>' +
      '</div></div>' +

      ctxPanel(ctx, center);
  }

  function ctxPanel(ctx, center) {
    if (!center) return '';
    return '' +
      '<div class="stat-grid">' +
      stat('中心 RPN 总分', center.rpn || '—', '', center.level === '高' ? 'h-high' : center.level === '中' ? 'h-mid' : 'h-low', center.level + '风险中心') +
      stat('已入组 / 目标', (center.enrolled || 0) + ' / ' + (center.target || 0), '', 'h-accent', '入组进度 ' + (center.target ? Math.round(center.enrolled / center.target * 100) : 0) + '%') +
      stat('未闭环问题', center.openIssues || 0, '项', 'h-high', '来自风险台账') +
      stat('KRI 异常项', ctx.kriAbnormal.length, '项', 'h-mid', '达到警戒阈值') +
      stat('CtQ 关注因子', ctx.ctq.length, '个', 'h-accent', '本中心需重点核查') +
      '</div>' +

      '<div class="row" style="align-items:flex-start;flex-wrap:wrap;margin-bottom:0">' +
      '<div style="flex:1 1 320px" class="card"><div class="card-head"><h2>本中心风险画像</h2>' +
      '<div class="spacer"></div><span class="badge ' + U.levelClass(center.level) + '">' + center.level + '风险</span></div>' +
      '<div class="card-body">' +
      '<div style="font-size:11.6px;color:var(--c-text-3);margin-bottom:5px">历史高频问题 TOP 5（近 12 个月）</div>' +
      '<ul class="list-plain">' +
      (ctx.topIssues.length ? ctx.topIssues.map(function (it, i) {
        return '<li><span class="dot high"></span><span style="font-size:12.4px"><b style="color:var(--c-text-3)">#' + (i + 1) + '</b> ' + U.esc(it.text) +
          (it.tag ? ' <span class="tag">' + U.esc(it.tag) + '</span>' : '') + '</span></li>';
      }).join('') : '<li style="color:var(--c-text-3)">暂无历史问题记录</li>') +
      '</ul>' +
      '<div style="font-size:11.6px;color:var(--c-text-3);margin:14px 0 5px">上次访视残留问题</div>' +
      '<ul class="list-plain">' +
      (ctx.residual.length ? ctx.residual.map(function (r) {
        return '<li><span class="dot mid"></span><span style="font-size:12.4px">' + U.esc(r.description) + ' <span class="tag">' + U.esc(r.status) + '</span></span></li>';
      }).join('') : '<li style="color:var(--c-text-3)">无残留问题（上次访视问题已全部闭环）</li>') +
      '</ul>' +
      '</div></div>' +

      '<div style="flex:1 1 300px" class="card"><div class="card-head"><h2>当前 KRI 异常</h2>' +
      '<div class="spacer"></div><span style="font-size:11.6px;color:var(--c-text-3)">方案版本 ' + U.esc((currentProject() || {}).protocolVersion || '—') + '</span></div>' +
      '<div class="card-body" style="padding:0">' +
      (ctx.kriAbnormal.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>KRI 指标</th><th class="num">实测</th><th class="num">阈值</th><th class="ctr">状态</th></tr></thead><tbody>' +
        ctx.kriAbnormal.map(function (k) {
          return '<tr><td>' + U.esc(k.name) + '</td><td class="num"><b>' + k.value + '</b></td><td class="num">' + k.threshold + '</td>' +
            '<td class="ctr"><span class="badge lv-high">超标</span></td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<div style="padding:24px;text-align:center;color:var(--c-text-3);font-size:12.4px">本中心当前无 KRI 异常，按常规监查执行</div>') +
      '</div></div>' +
      '</div>' +

      '<div class="card"><div class="card-head"><h2>需要重点核查的 CtQ 因子</h2>' +
      '<span class="sub">Critical to Quality — 决定数据可靠性与受试者安全的关键环节</span></div>' +
      '<div class="card-body" style="display:flex;flex-wrap:wrap;gap:8px">' +
      ctx.ctq.map(function (c) {
        return '<span class="badge ' + (c.lv === '高' ? 'lv-high' : c.lv === '中' ? 'lv-mid' : 'badge-teal') + '" style="padding:5px 11px">' + U.esc(c.name) + ' · ' + c.lv + '</span>';
      }).join('') +
      '</div></div>';
  }

  function stat(lab, val, unit, cls, hint) {
    return '<div class="stat ' + cls + '"><div class="stat-lab">' + lab + '</div>' +
      '<div class="stat-val">' + val + '<small>' + (unit || '') + '</small></div>' +
      '<div class="stat-hint">' + U.esc(hint || '') + '</div></div>';
  }

  /* ---------------------------------------------------------------- 上下文构建 */
  function buildContext(center) {
    var proj = currentProject();
    var db = S.load();
    var ledger = db.ledger.filter(function (l) { return l.projectId === (proj ? proj.id : '') && l.centerId === center.id; });

    var topIssues = (center.highRiskIssues || []).slice(0, 5).map(function (t) {
      return { text: t, tag: guessSopName(t) };
    });

    var residual = ledger.filter(function (l) { return l.status !== '已关闭'; });

    var kriAbnormal = [];
    var seen = {};
    db.krValues.filter(function (k) { return k.projectId === (proj ? proj.id : '') && k.centerId === center.id && k.abnormal; }).forEach(function (k) {
      if (seen[k.kriId]) return; seen[k.kriId] = 1;
      kriAbnormal.push({ id: k.kriId, name: k.kriName, value: k.value, threshold: k.threshold });
    });
    if (!kriAbnormal.length && center.level === '高') {
      D.KRI_CATALOG.slice(0, 3).forEach(function (k) {
        kriAbnormal.push({ id: k.id, name: k.name + '（待现场核实）', value: '待核', threshold: k.threshold });
      });
    }

    var ctqMap = {};
    function addCtq(id, lv) {
      ctqMap[id] = ctqMap[id] || { id: id, lv: '低', hits: 0 };
      ctqMap[id].hits++;
      var order = { '低': 0, '中': 1, '高': 2 };
      if (order[lv] > order[ctqMap[id].lv]) ctqMap[id].lv = lv;
    }
    residual.forEach(function (l) {
      var c = D.CTQ_FACTORS.filter(function (x) { return x.id === l.ctq; })[0];
      if (c) addCtq(c.id, (l.currentRpn >= 60 ? '高' : l.currentRpn >= 30 ? '中' : '低'));
    });
    (center.highRiskIssues || []).forEach(function (t) { matchCtq(t).forEach(function (id) { addCtq(id, '中'); }); });
    if (center.level === '高') {
      ['CtQ1', 'CtQ4', 'CtQ9'].forEach(function (id) { addCtq(id, '高'); });
      addCtq('CtQ2', '高');
    } else if (center.level === '中') {
      ['CtQ9', 'CtQ3'].forEach(function (id) { addCtq(id, '中'); });
    } else {
      ['CtQ9'].forEach(function (id) { addCtq(id, '低'); });
    }
    var ctq = Object.keys(ctqMap).map(function (k) {
      var f = D.CTQ_FACTORS.filter(function (x) { return x.id === k; })[0];
      return { id: k, name: f ? f.name : k, lv: ctqMap[k].lv, hits: ctqMap[k].hits };
    }).sort(function (a, b) {
      var o = { '高': 2, '中': 1, '低': 0 };
      return o[b.lv] - o[a.lv] || b.hits - a.hits;
    });

    return { topIssues: topIssues, residual: residual, kriAbnormal: kriAbnormal, ctq: ctq, ledger: ledger };
  }

  function guessSopName(text) {
    var m = { '知情': 'ICF', 'ICF': 'ICF', 'SAE': 'SAFETY', 'AE': 'SAFETY', '药物': 'IP', '温控': 'IP', '超温': 'IP', '数据': 'DATA', 'EDC': 'DATA', '录入': 'DATA', '随机': 'RANDOM', '访视': 'PROTOCOL', '违背': 'PROTOCOL', '筛选': 'ELIGIBILITY', '样本': 'SAMPLE', '培训': 'DELEGATION' };
    for (var k in m) if (text.indexOf(k) >= 0) return m[k];
    return 'PROTOCOL';
  }
  function matchCtq(text) {
    var out = [];
    D.CTQ_FACTORS.forEach(function (c) {
      if (c.keywords.some(function (k) { return text.indexOf(k) >= 0; })) out.push(c.id);
    });
    return out;
  }

  /* ---------------------------------------------------------------- 生成监察清单 */
  function generate() {
    var proj = currentProject();
    var center = ((proj && proj.centers) || []).filter(function (c) { return c.id === st.centerId; })[0];
    if (!center) { U.toast('请选择中心', 'warn'); return; }
    var ctx = buildContext(center);
    st.ctx = ctx;
    var vt = VISIT_TYPES.filter(function (v) { return v.id === st.visitType; })[0] || VISIT_TYPES[0];

    var items = [];
    var requiredSops = {};

    ctx.ctq.forEach(function (c) {
      var f = D.CTQ_FACTORS.filter(function (x) { return x.id === c.id; })[0];
      if (!f) return;
      requiredSops[f.sop] = requiredSops[f.sop] || { lv: '低', reasons: [] };
      var o = { '高': 2, '中': 1, '低': 0 };
      if (o[c.lv] > o[requiredSops[f.sop].lv]) requiredSops[f.sop].lv = c.lv;
      requiredSops[f.sop].reasons.push('CtQ：' + c.name + '（' + c.lv + '）');
    });

    ctx.kriAbnormal.forEach(function (k) {
      var meta = D.KRI_CATALOG.filter(function (x) { return x.id === k.id; })[0];
      if (!meta) return;
      requiredSops[meta.sop] = requiredSops[meta.sop] || { lv: '低', reasons: [] };
      requiredSops[meta.sop].lv = '高';
      requiredSops[meta.sop].reasons.push('KRI 异常：' + k.name);
    });

    ctx.residual.forEach(function (l) {
      var sop = l.sop || guessSopName(l.description);
      requiredSops[sop] = requiredSops[sop] || { lv: '低', reasons: [] };
      if (l.currentRpn >= 60) requiredSops[sop].lv = '高';
      else if (l.currentRpn >= 30 && requiredSops[sop].lv !== '高') requiredSops[sop].lv = '中';
      requiredSops[sop].reasons.push('未闭环问题：' + l.description);
    });

    ctx.topIssues.forEach(function (t) {
      var sop = guessSopName(t.text);
      requiredSops[sop] = requiredSops[sop] || { lv: '低', reasons: [] };
      if (requiredSops[sop].lv === '低') requiredSops[sop].lv = '中';
      requiredSops[sop].reasons.push('历史高频问题：' + t.text);
    });

    ['ICF', 'SAFETY', 'IP', 'DATA', 'PROTOCOL'].forEach(function (sop) {
      requiredSops[sop] = requiredSops[sop] || { lv: '低', reasons: ['常规监查覆盖项'] };
    });

    D.CHECKLIST_TEMPLATES.forEach(function (tpl) {
      var req = requiredSops[tpl.sop];
      if (!req) return;
      var priority = req.lv === '高' ? '强制' : req.lv === '中' ? '重点' : '常规';
      tpl.items.forEach(function (it) {
        var item = {
          code: it.code, probe: it.probe, guide: it.guide,
          sop: tpl.sop, role: tpl.role, tplName: tpl.name,
          source: req.reasons.slice(0, 3),
          priority: priority,
          status: '',
          note: ''
        };
        var hitTexts = ctx.topIssues.concat(ctx.residual.map(function (r) { return { text: r.description }; }))
          .filter(function (h) { return keywordHit(h.text, it.probe + it.guide); });
        if (hitTexts.length) {
          item.priority = '强制';
          item.source = ['命中本中心历史问题：' + hitTexts[0].text].concat(item.source).slice(0, 3);
        }
        items.push(item);
      });
    });

    var order = { '强制': 0, '重点': 1, '常规': 2 };
    items.sort(function (a, b) { return order[a.priority] - order[b.priority] || a.sop.localeCompare(b.sop); });

    st.checklist = items;
    st.visitType = vt.id;
    st.visitDate = st.visitDate || S.todayStr();
    st.center = center;
    st.view = 'run';
    st.signIn = null;
    st.photos = [];
    st.openAcc = {};
    st.filter = 'all';

    var rec = S.saveVisit({
      projectId: proj ? proj.id : '', centerId: center.id, centerName: center.name,
      visitType: vt.name, visitDate: st.visitDate, centerRpn: center.rpn, centerLevel: center.level,
      protocolVersion: proj ? proj.protocolVersion : '',
      checklist: items, signIn: null, photos: [], findings: [], status: '进行中'
    });
    st.visitRecId = rec.id;

    U.toast('已生成 ' + items.length + ' 项监察清单（强制 ' + items.filter(function (x) { return x.priority === '强制'; }).length + ' 项）', 'ok');
    render(document.getElementById('content'));
    if (S.refreshNav) S.refreshNav();
  }

  function keywordHit(text, probe) {
    var keys = ['ICF', '知情', 'SAE', 'AE', '安全性', '随机', '盲', '超温', '温度', '发药', '账物', '录入', '查询', '源文件', '缺失', '超窗', '访视', '违背', '筛选', '样本', '影像', '合并用药', '培训', '再同意', '揭盲'];
    return keys.some(function (k) { return text.indexOf(k) >= 0 && (probe.indexOf(k) >= 0); });
  }

  /* ---------------------------------------------------------------- 监察执行子页 */
  function runHtml() {
    var items = st.checklist;
    var forced = items.filter(function (x) { return x.priority === '强制'; });
    var done = items.filter(function (x) { return x.status; });
    var issues = items.filter(function (x) { return x.status === 'issue' || x.status === 'fail'; });
    var progress = Math.round(done.length / items.length * 100);
    var c = st.center || {};
    var vt = VISIT_TYPES.filter(function (v) { return v.id === st.visitType; })[0] || VISIT_TYPES[0];

    return '' +
      '<div class="card"><div class="card-body" style="padding:12px 15px">' +
      '<div class="back-bar">' +
      '<button class="btn btn-sm btn-back-v2" id="btn-back">← 返回</button>' +
      '<div style="min-width:0">' +
      '<div style="font-size:14.5px;font-weight:700">' + U.esc(c.name || '') + '</div>' +
      '<div style="font-size:11.4px;color:var(--c-text-3)">' + U.esc(vt.name) + ' · ' + U.fmtDate(st.visitDate) + ' · 方案 ' + U.esc((currentProject() || {}).protocolVersion || '') + '</div>' +
      '</div>' +
      '<span class="badge ' + U.levelClass(c.level) + '">中心 RPN ' + (c.rpn || '—') + '</span>' +
      '<div class="spacer"></div>' +
      '<button class="btn btn-sm" id="btn-sign">📍 签到</button>' +
      '<button class="btn btn-sm" id="btn-photo">📷 拍照取证</button>' +
      '<button class="btn btn-sm" id="btn-word">📄 导出 Word</button>' +
      '<button class="btn btn-sm' + (S.can('ledgerCreate') ? '' : ' disabled') + '" id="btn-to-ledger">问题写入台账</button>' +
      '</div>' +
      '<div style="margin-top:11px">' +
      '<div style="display:flex;justify-content:space-between;font-size:11.4px;color:var(--c-text-3);margin-bottom:4px">' +
      '<span id="cl-prog-lab">核查进度 ' + done.length + ' / ' + items.length + ' 项</span>' +
      '<span id="cl-issue-lab">发现 <b style="color:#d97706">' + issues.length + '</b> 项问题</span></div>' +
      '<div class="pbar"><i style="width:' + progress + '%;background:' + (issues.length ? '#d97706' : '#0f766e') + '"></i></div>' +
      '</div></div></div>' +

      (st.signIn ? '<div class="card"><div class="card-body" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;padding:11px 15px">' +
        '<span class="badge lv-low">✓ 已签到</span>' +
        '<span style="font-size:12.4px">' + U.esc(st.signIn.name) + ' · ' + U.fmtDateTime(st.signIn.ts) + '</span>' +
        (st.signIn.geo ? '<span style="font-size:11.8px;color:var(--c-text-3)">地理坐标 ' + U.esc(st.signIn.geo) + '</span>' : '') +
        '<button class="btn btn-sm btn-ghost" id="btn-sign-del" style="margin-left:auto">撤销签到</button>' +
        '</div></div>' : '') +

      '<div class="card"><div class="card-head"><h2>监察清单</h2>' +
      '<span class="sub">共 ' + items.length + ' 项 · 强制 ' + forced.length + ' 项 · 点击条目展开核查</span>' +
      '<div class="spacer"></div>' +
      '<div class="seg" id="cl-filter"><button data-f="all" class="active">全部</button><button data-f="强制">强制</button><button data-f="重点">重点</button><button data-f="未完成">未完成</button><button data-f="问题">有问题</button></div>' +
      '</div><div class="card-body tight" id="cl-list"></div>' +

      '<div class="card-foot" style="justify-content:space-between;flex-wrap:wrap;gap:10px">' +
      '<span style="font-size:11.6px;color:var(--c-text-3)">完成全部核查后点击「确认」，本次监察将保存到「监察记录」</span>' +
      '<button class="btn btn-confirm btn-lg" id="btn-confirm">✓ 确认</button>' +
      '</div></div>' +

      (st.photos.length ? '<div class="card"><div class="card-head"><h2>现场取证照片</h2><span class="sub">' + st.photos.length + ' 张</span></div>' +
        '<div class="card-body"><div class="shot-grid">' + st.photos.map(function (p, i) {
          return '<div class="shot"><img src="' + p.data + '" alt="取证"><button class="rm" data-photo-rm="' + i + '">×</button>' +
            '<div class="cap">' + U.esc(p.caption || '现场取证') + '<br>' + U.fmtDateTime(p.ts) + '</div></div>';
        }).join('') + '</div></div></div>' : '');
  }

  function statusOf(it) {
    return it.status === 'ok' ? '符合' : it.status === 'issue' ? '一般问题' : it.status === 'fail' ? '重大问题' : it.status === 'na' ? '不适用' : '未核查';
  }
  function statusBadge(it) {
    var m = { ok: 'lv-low', issue: 'lv-mid', fail: 'lv-high', na: 'badge-gray', '': 'lv-none' };
    return '<span class="badge ' + m[it.status] + '">' + statusOf(it) + '</span>';
  }

  function listHtml(filter) {
    var items = st.checklist;
    if (filter === '强制') items = items.filter(function (x) { return x.priority === '强制'; });
    else if (filter === '重点') items = items.filter(function (x) { return x.priority === '重点'; });
    else if (filter === '未完成') items = items.filter(function (x) { return !x.status; });
    else if (filter === '问题') items = items.filter(function (x) { return x.status === 'issue' || x.status === 'fail'; });

    if (!items.length) return '<div class="empty" style="padding:30px"><div class="ic">✓</div><h3>该筛选下无核查项</h3></div>';

    return items.map(function (it) {
      var i = st.checklist.indexOf(it);
      var open = !!st.openAcc[i];
      return '<div class="acc chk-acc' + (open ? ' open' : '') + (it.status === 'ok' ? ' done' : '') + '" data-i="' + i + '">' +
        '<div class="acc-head" data-acc="' + i + '">' +
        '<span class="chev2">▼</span>' +
        '<span class="tag mono">' + U.esc(it.code) + '</span>' +
        '<span class="badge ' + (it.priority === '强制' ? 'lv-high' : it.priority === '重点' ? 'lv-mid' : 'badge-gray') + '">' + it.priority + '</span>' +
        '<span class="acc-title">' + U.esc(it.probe) + '</span>' +
        statusBadge(it) +
        '</div>' +
        '<div class="acc-body">' +
        '<div class="chk-meta">' +
        '<span class="k">核对指引</span><span class="v">' + U.esc(it.guide) + '</span>' +
        '<span class="k">纳入依据</span><span class="v" style="color:var(--c-primary)">' + it.source.map(U.esc).join('；') + '</span>' +
        (it.note ? '<span class="k">核查记录</span><span class="v">' + U.esc(it.note) + '</span>' : '') +
        '</div>' +
        '<div class="chk-actions">' +
        '<button class="pill' + (it.status === 'issue' ? ' on-issue' : '') + '" data-st="issue" data-i="' + i + '">一般问题</button>' +
        '<button class="pill' + (it.status === 'fail' ? ' on-fail' : '') + '" data-st="fail" data-i="' + i + '">重大问题</button>' +
        '<button class="pill' + (it.status === 'na' ? ' on-ok' : '') + '" data-st="na" data-i="' + i + '">不适用</button>' +
        '<button class="pill" data-note="' + i + '">备注</button>' +
        '<span class="spacer"></span>' +
        '<button class="btn btn-sm' + (it.status === 'ok' ? ' btn-primary' : '') + '" data-ok="' + i + '">✓ 符合</button>' +
        '</div>' +
        '</div></div>';
    }).join('');
  }

  /* ================================================================ 绑定 */
  function bind(root) {
    var list = root.querySelector('#cl-list');
    if (list) list.innerHTML = listHtml(st.filter);
    root.onclick = onClick;
  }

  function onClick(e) {
    var root = document.getElementById('content');
    var t = e.target.closest ? e.target.closest('[data-acc],[data-st],[data-note],[data-ok],[data-f],[data-photo-rm],#btn-gen,#btn-back,#btn-sign,#btn-photo,#btn-word,#btn-confirm,#btn-to-ledger,#btn-sign-del') : null;
    if (!t) return;

    if (t.dataset.f) {
      st.filter = t.dataset.f;
      U.$$('#cl-filter button').forEach(function (b) { b.classList.toggle('active', b.dataset.f === st.filter); });
      var list = document.getElementById('cl-list');
      if (list) list.innerHTML = listHtml(st.filter);
      return;
    }
    if (t.dataset.acc != null && t.dataset.acc !== '') {
      var i0 = Number(t.dataset.acc);
      st.openAcc[i0] = !st.openAcc[i0];
      var acc = t.closest('.acc');
      if (acc) acc.classList.toggle('open', !!st.openAcc[i0]);
      return;
    }
    if (t.dataset.st) {
      var i1 = Number(t.dataset.i);
      st.checklist[i1].status = st.checklist[i1].status === t.dataset.st ? '' : t.dataset.st;
      if (st.checklist[i1].status !== '' && !st.checklist[i1].note) openNote(i1);
      else refreshList();
      return;
    }
    if (t.dataset.ok != null && t.dataset.ok !== '') {
      var i3 = Number(t.dataset.ok);
      st.checklist[i3].status = st.checklist[i3].status === 'ok' ? '' : 'ok';
      refreshList();
      return;
    }
    if (t.dataset.note != null && t.dataset.note !== '') { openNote(Number(t.dataset.note)); return; }
    if (t.dataset.photoRm != null && t.dataset.photoRm !== '') {
      st.photos.splice(Number(t.dataset.photoRm), 1); render(root); return;
    }

    switch (t.id) {
      case 'btn-gen': st.visitDate = (document.getElementById('cl-date') || {}).value || S.todayStr(); generate(); break;
      case 'btn-back': st.checklist = null; st.view = 'setup'; render(root); break;
      case 'btn-sign': doSignIn(); break;
      case 'btn-sign-del': st.signIn = null; render(root); U.toast('已撤销签到', 'ok'); break;
      case 'btn-photo': takePhoto(); break;
      case 'btn-word': exportWordChecklist(); break;
      case 'btn-to-ledger': pushToLedger(); break;
      case 'btn-confirm': confirmVisit(); break;
    }
  }

  function refreshList() {
    var list = document.getElementById('cl-list');
    if (list) list.innerHTML = listHtml(st.filter);
    var items = st.checklist;
    var done = items.filter(function (x) { return x.status; });
    var issues = items.filter(function (x) { return x.status === 'issue' || x.status === 'fail'; });
    var pbar = document.querySelector('#content .pbar > i');
    if (pbar) { pbar.style.width = Math.round(done.length / items.length * 100) + '%'; pbar.style.background = issues.length ? '#d97706' : '#0f766e'; }
    var pl = document.getElementById('cl-prog-lab');
    if (pl) pl.textContent = '核查进度 ' + done.length + ' / ' + items.length + ' 项';
    var il = document.getElementById('cl-issue-lab');
    if (il) il.innerHTML = '发现 <b style="color:#d97706">' + issues.length + '</b> 项问题';
    syncVisitRec();
  }

  function syncVisitRec() {
    if (!st.visitRecId) return;
    var rec = S.load().visits.filter(function (v) { return v.id === st.visitRecId; })[0];
    if (rec) {
      rec.checklist = st.checklist; rec.signIn = st.signIn; rec.photos = st.photos;
      rec.completedCount = st.checklist.filter(function (x) { return x.status; }).length;
      rec.totalCount = st.checklist.length;
      rec.issueCount = st.checklist.filter(function (x) { return x.status === 'issue'; }).length;
      rec.failCount = st.checklist.filter(function (x) { return x.status === 'fail'; }).length;
      S.persist();
    }
  }

  function openNote(i) {
    var it = st.checklist[i];
    var form = U.el('div', {});
    form.innerHTML = '<div style="font-size:12.8px;color:var(--c-text-2);margin-bottom:10px">' +
      '<span class="mono tag">' + U.esc(it.code) + '</span> ' + U.esc(it.probe) + '</div>' +
      '<label class="fl">核查记录 / 问题描述</label>' +
      '<textarea id="nt" style="min-height:92px">' + U.esc(it.note || '') + '</textarea>' +
      '<div style="font-size:11.4px;color:var(--c-text-3);margin-top:6px">建议记录：发现事实 + 涉及受试者编号 + 已与谁沟通 + 拟整改方向</div>';
    var save = U.el('button', { class: 'btn btn-primary', text: '保存记录' });
    var cancel = U.el('button', { class: 'btn btn-ghost', text: '取消' });
    var m = U.openModal('核查记录', form, [cancel, save]);
    cancel.onclick = m.close;
    save.onclick = function () {
      st.checklist[i].note = form.querySelector('#nt').value;
      m.close(); refreshList();
    };
  }

  function doSignIn() {
    var u = S.currentUser();
    var form = U.el('div', {});
    form.innerHTML = '<div class="field"><label class="fl">签到人</label><input type="text" id="si-name" value="' + U.esc(u.name) + '"></div>' +
      '<div class="field"><label class="fl">签到方式</label><select id="si-mode">' +
      '<option>现场扫码签到</option><option>GPS 定位签到</option><option>手工签到</option></select></div>' +
      '<div style="font-size:11.8px;color:var(--c-text-3)">签到将记录时间戳并写入监察记录，作为「现场执行」的证据链。</div>';
    var save = U.el('button', { class: 'btn btn-primary', text: '确认签到' });
    var cancel = U.el('button', { class: 'btn btn-ghost', text: '取消' });
    var m = U.openModal('监察现场签到', form, [cancel, save]);
    cancel.onclick = m.close;
    save.onclick = function () {
      var name = form.querySelector('#si-name').value || u.name;
      st.signIn = { name: name, ts: new Date().toISOString(), geo: '', mode: form.querySelector('#si-mode').value };
      var done = function () { m.close(); syncVisitRec(); render(document.getElementById('content')); };
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (p) {
          st.signIn.geo = p.coords.latitude.toFixed(5) + ', ' + p.coords.longitude.toFixed(5);
          done(); U.toast('签到成功（含定位）', 'ok');
        }, function () { done(); U.toast('签到成功（未获取定位，可手工补充）', 'ok'); }, { timeout: 4000 });
      } else { done(); U.toast('签到成功', 'ok'); }
    };
  }

  function takePhoto() {
    var input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.multiple = true;
    input.onchange = function () {
      var files = Array.prototype.slice.call(input.files || []);
      if (!files.length) return;
      var done = 0;
      files.forEach(function (f) {
        U.fileToDataURL(f).then(function (data) {
          compress(data, 900, 0.72).then(function (small) {
            st.photos.push({ data: small, ts: new Date().toISOString(), caption: f.name.replace(/\.[^.]+$/, '').slice(0, 24) || '现场取证' });
            done++;
            if (done === files.length) { render(document.getElementById('content')); U.toast('已添加 ' + files.length + ' 张取证照片', 'ok'); }
          });
        });
      });
    };
    input.click();
  }

  function compress(dataUrl, maxW, q) {
    return new Promise(function (res) {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxW / img.width);
        var cv = document.createElement('canvas');
        cv.width = Math.round(img.width * scale);
        cv.height = Math.round(img.height * scale);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        try { res(cv.toDataURL('image/jpeg', q)); } catch (e) { res(dataUrl); }
      };
      img.onerror = function () { res(dataUrl); };
      img.src = dataUrl;
    });
  }

  /* ---------------------------------------------------------------- 确认：保存到监察记录 */
  function confirmVisit() {
    var items = st.checklist;
    if (!items.length) return;
    var undone = items.filter(function (x) { return !x.status; }).length;
    if (undone) {
      U.confirmDialog('尚有未核查项', '还有 ' + undone + ' 项未标记核查结论，确认后将按「未核查」保存。是否继续？', function () { doConfirmSave(); }, '继续保存');
    } else doConfirmSave();
  }

  function doConfirmSave() {
    var items = st.checklist;
    var done = items.filter(function (x) { return x.status; });
    syncVisitRec();
    if (st.visitRecId) {
      S.saveVisit({
        id: st.visitRecId,
        checklist: items, signIn: st.signIn, photos: st.photos,
        status: '已完成',
        completedCount: done.length, totalCount: items.length,
        issueCount: items.filter(function (x) { return x.status === 'issue'; }).length,
        failCount: items.filter(function (x) { return x.status === 'fail'; }).length,
        confirmedAt: S.nowISO()
      });
    }
    S.audit('确认监察', (st.center ? st.center.name : '') + ' · ' + (st.visitDate || ''), '完成 ' + done.length + '/' + items.length + ' 项，已存入监察记录');
    U.toast('本次监察已保存到「监察记录」', 'ok');
    st.checklist = null; st.view = 'setup';
    if (S.refreshNav) S.refreshNav();
    global.RBM_App.go('records');
  }

  /* ---------------------------------------------------------------- Word 导出 */
  function exportWordChecklist() {
    var c = st.center || {};
    var vt = VISIT_TYPES.filter(function (v) { return v.id === st.visitType; })[0] || VISIT_TYPES[0];
    var proj = currentProject();
    var h = '<div class="print-head"><div><h1>监察清单</h1>' +
      '<div class="muted small">' + U.esc(c.name || '') + ' · ' + U.esc(vt.name) + ' · ' + U.fmtDate(st.visitDate) + '</div></div>' +
      '<div class="print-brand">' + U.esc(S.load().settings.orgName) + '<br>中心 RPN ' + (c.rpn || '—') + '（' + (c.level || '') + '风险）</div></div>';
    h += '<div class="kv">' +
      '<div class="k">项目</div><div class="v">' + U.esc(proj ? proj.name : '') + '</div>' +
      '<div class="k">方案版本</div><div class="v">' + U.esc(proj ? proj.protocolVersion : '') + '</div>' +
      '<div class="k">监查员</div><div class="v">' + U.esc(S.currentUser().name) + '</div>' +
      '<div class="k">清单项数</div><div class="v">' + st.checklist.length + '（强制 ' + st.checklist.filter(function (x) { return x.priority === '强制'; }).length + '）</div>' +
      '</div>';
    h += '<table><thead><tr><th style="width:7%">编号</th><th style="width:30%">核查项</th><th style="width:31%">核对指引 / 纳入依据</th><th style="width:8%">优先级</th><th style="width:24%">核查记录</th></tr></thead><tbody>';
    h += st.checklist.map(function (x) {
      return '<tr><td>' + U.esc(x.code) + '</td><td>' + U.esc(x.probe) + '</td>' +
        '<td class="small muted">' + U.esc(x.guide) + '<br>依据：' + U.esc(x.source.join('；')) + '</td>' +
        '<td>' + x.priority + '</td><td>' + (x.note ? U.esc(x.note) : '') + (x.status ? '<br>[' + statusOf(x) + ']' : '') + '</td></tr>';
    }).join('');
    h += '</tbody></table>';
    h += '<div class="sign"><div>监查员签名 / 日期</div><div>研究者签名 / 日期</div></div>';
    U.downloadWord('监察清单_' + (c.name || '') + '_' + (st.visitDate || S.todayStr()) + '.doc', h, '监察清单');
    U.toast('Word 文档已生成，可直接用 WPS / Office 打开、编辑与打印', 'ok');
  }

  /* ---------------------------------------------------------------- 问题写入台账 */
  function pushToLedger() {
    var probs = (st.checklist || []).filter(function (x) { return x.status === 'issue' || x.status === 'fail'; });
    if (!probs.length) { U.toast('本次监察未发现不符合项', 'info'); return; }
    var proj = currentProject();
    var c = st.center || {};
    var n = 0;
    probs.forEach(function (x) {
      S.saveLedger({
        projectId: proj ? proj.id : '', centerId: c.id, centerName: c.name,
        category: sopToCat(x.sop), sop: x.sop, ctq: sopToCtq(x.sop), kri: '',
        description: '监察核查发现（' + x.code + '）：' + (x.note || x.probe),
        initRpn: x.status === 'fail' ? 80 : 45,
        currentRpn: x.status === 'fail' ? 80 : 45,
        discoveredAt: st.visitDate || S.todayStr(),
        discoveredBy: S.currentUser().name,
        action: '根据监察记录制定整改措施，验证后关闭',
        owner: '', dueDate: S.addDays(st.visitDate || S.todayStr(), x.status === 'fail' ? 5 : 14),
        status: x.status === 'fail' ? '已升级' : '开放',
        escalate: x.status === 'fail', escalateTo: x.status === 'fail' ? 'PM/QA' : '',
        conclusion: '', protocolVersion: proj ? proj.protocolVersion : ''
      });
      n++;
    });
    U.toast('已将 ' + n + ' 项问题写入动态风险台账', 'ok');
    if (S.refreshNav) S.refreshNav();
  }

  function sopToCat(sop) {
    var m = { ICF: 'C8', ELIGIBILITY: 'C2', PROTOCOL: 'C9', SAFETY: 'C5', IP: 'C6', DATA: 'C4', EFFICACY: 'C1', RANDOM: 'C1', SAMPLE: 'C7', REGULATORY: 'C8', DELEGATION: 'C3' };
    return m[sop] || 'C9';
  }
  function sopToCtq(sop) {
    var f = D.CTQ_FACTORS.filter(function (c) { return c.sop === sop; })[0];
    return f ? f.id : '';
  }

  /* ================================================================ 监察记录视图 */
  V.records = {
    title: '监察记录',
    sub: '每次监察的完成情况、核查结论与取证留痕',
    render: function (root) {
      var db = S.load();
      var proj = currentProject();
      var list = db.visits.filter(function (v) { return !proj || v.projectId === proj.id; }).slice().reverse();

      root.innerHTML = '' +
        '<div class="card"><div class="card-head"><h2>监察记录</h2>' +
        '<span class="sub">共 ' + list.length + ' 条 · 绿色「确认」后的监察会归档到这里</span>' +
        '<div class="spacer"></div>' +
        '<button class="btn btn-sm" id="rc-offline">离线数据同步（导入/导出）</button></div>' +
        '<div class="card-body tight"><div class="tbl-wrap"><table class="tbl">' +
        '<thead><tr><th>编号</th><th>中心</th><th>访视类型</th><th class="ctr">日期</th><th class="num">完成 / 总数</th><th class="num">一般 / 重大问题</th><th class="ctr">状态</th><th class="ctr">操作</th></tr></thead><tbody>' +
        (list.length ? list.map(function (v) {
          var items = v.checklist || [];
          var done = v.completedCount != null ? v.completedCount : items.filter(function (x) { return x.status; }).length;
          var iss = v.issueCount != null ? v.issueCount : items.filter(function (x) { return x.status === 'issue'; }).length;
          var fai = v.failCount != null ? v.failCount : items.filter(function (x) { return x.status === 'fail'; }).length;
          return '<tr><td class="mono">' + U.esc(v.visitId) + '</td>' +
            '<td><b>' + U.esc(v.centerName || '—') + '</b></td>' +
            '<td style="font-size:11.8px">' + U.esc(v.visitType || '—') + '</td>' +
            '<td class="ctr">' + U.fmtDate(v.visitDate) + '</td>' +
            '<td class="num">' + done + ' / ' + (v.totalCount || items.length) + '</td>' +
            '<td class="num"><span style="color:#d97706">' + iss + '</span> / <span style="color:#dc2626">' + fai + '</span></td>' +
            '<td class="ctr"><span class="badge ' + (v.status === '已完成' ? 'lv-low' : 'badge-gray') + '">' + U.esc(v.status || '—') + '</span></td>' +
            '<td class="ctr" style="white-space:nowrap">' +
            '<button class="btn btn-sm" data-rc-view="' + v.id + '">查看</button> ' +
            '<button class="btn btn-sm" data-rc-word="' + v.id + '">导出 Word</button></td></tr>';
        }).join('') : '<tr><td colspan="8" style="text-align:center;color:var(--c-text-3);padding:30px">暂无监察记录 · 在「本次监察详情」中完成核查并点击「确认」</td></tr>') +
        '</tbody></table></div></div></div>';

      root.onclick = function (e) {
        var t = e.target.closest ? e.target.closest('[data-rc-view],[data-rc-word],#rc-offline') : null;
        if (!t) return;
        if (t.dataset.rcView) viewRecord(t.dataset.rcView);
        else if (t.dataset.rcWord) exportWordRecord(t.dataset.rcWord);
        else if (t.id === 'rc-offline') offlineSync();
      };
    }
  };

  function viewRecord(id) {
    var rec = S.load().visits.filter(function (v) { return v.id === id; })[0];
    if (!rec) return;
    var items = rec.checklist || [];
    var probs = items.filter(function (x) { return x.status === 'issue' || x.status === 'fail'; });
    var body = U.el('div', {});
    body.innerHTML = '' +
      '<div class="kv" style="display:grid;grid-template-columns:110px 1fr 110px 1fr;gap:5px 10px;margin-bottom:12px;font-size:12.4px">' +
      '<div style="color:var(--c-text-3)">编号</div><div style="font-weight:600">' + U.esc(rec.visitId) + '</div>' +
      '<div style="color:var(--c-text-3)">中心</div><div style="font-weight:600">' + U.esc(rec.centerName || '—') + '</div>' +
      '<div style="color:var(--c-text-3)">访视类型</div><div style="font-weight:600">' + U.esc(rec.visitType || '—') + '</div>' +
      '<div style="color:var(--c-text-3)">访视日期</div><div style="font-weight:600">' + U.fmtDate(rec.visitDate) + '</div>' +
      '<div style="color:var(--c-text-3)">状态</div><div style="font-weight:600">' + U.esc(rec.status || '—') + '</div>' +
      '<div style="color:var(--c-text-3)">中心 RPN</div><div style="font-weight:600">' + (rec.centerRpn || '—') + '（' + U.esc(rec.centerLevel || '—') + '）</div>' +
      '<div style="color:var(--c-text-3)">签到</div><div style="font-weight:600">' + (rec.signIn ? U.esc(rec.signIn.name) + ' · ' + U.fmtDateTime(rec.signIn.ts) : '未签到') + '</div>' +
      '<div style="color:var(--c-text-3)">取证照片</div><div style="font-weight:600">' + (rec.photos || []).length + ' 张</div>' +
      '</div>' +
      (probs.length ? '<div style="font-size:12.8px;font-weight:700;margin:6px 0">发现问题（' + probs.length + ' 项）</div>' +
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>编号</th><th>核查项</th><th>级别</th><th>记录</th></tr></thead><tbody>' +
        probs.map(function (x) {
          return '<tr><td class="mono">' + U.esc(x.code) + '</td><td>' + U.esc(x.probe) + '</td>' +
            '<td>' + (x.status === 'fail' ? '<span class="badge lv-high">重大</span>' : '<span class="badge lv-mid">一般</span>') + '</td>' +
            '<td style="font-size:11.6px">' + U.esc(x.note || '现场核查发现不符合项') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="perm-note info" style="margin:8px 0 0">本次监察未发现不符合项。</div>') +
      '<div style="font-size:12.8px;font-weight:700;margin:14px 0 6px">逐项核查结论（' + items.length + ' 项）</div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>编号</th><th>核查项</th><th class="ctr">优先级</th><th class="ctr">结论</th></tr></thead><tbody>' +
      items.map(function (x) {
        var res = x.status === 'ok' ? '符合' : x.status === 'issue' ? '一般问题' : x.status === 'fail' ? '重大问题' : x.status === 'na' ? '不适用' : '未核查';
        return '<tr><td class="mono">' + U.esc(x.code) + '</td><td>' + U.esc(x.probe) + '</td><td class="ctr">' + x.priority + '</td><td class="ctr">' + res + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    var word = U.el('button', { class: 'btn btn-primary', text: '导出 Word 报告' });
    var close = U.el('button', { class: 'btn btn-ghost', text: '关闭' });
    var m = U.openModal('监察记录 · ' + rec.visitId, body, [close, word], true);
    close.onclick = m.close;
    word.onclick = function () { exportWordRecord(id); };
  }

  function exportWordRecord(id) {
    var rec = S.load().visits.filter(function (v) { return v.id === id; })[0];
    if (!rec) return;
    var items = rec.checklist || [];
    var ok = items.filter(function (x) { return x.status === 'ok'; }).length;
    var iss = items.filter(function (x) { return x.status === 'issue'; }).length;
    var fai = items.filter(function (x) { return x.status === 'fail'; }).length;
    var na = items.filter(function (x) { return x.status === 'na'; }).length;
    var undone = items.filter(function (x) { return !x.status; }).length;
    var user = S.currentUser();

    var h = '<div class="print-head"><div><h1>监查访视报告（Monitoring Visit Report）</h1>' +
      '<div class="muted small">' + U.esc(rec.centerName || '') + ' · ' + U.esc(rec.visitType || '') + ' · ' + U.fmtDate(rec.visitDate) + '</div></div>' +
      '<div class="print-brand">' + U.esc(S.load().settings.orgName) + '<br>导出 ' + U.fmtDateTime(new Date().toISOString()) + '</div></div>';

    h += '<div class="kv">' +
      '<div class="k">中心编号</div><div class="v">' + U.esc(rec.centerId || '—') + '</div>' +
      '<div class="k">中心 RPN</div><div class="v">' + (rec.centerRpn || '—') + '（' + U.esc(rec.centerLevel || '—') + '风险）</div>' +
      '<div class="k">方案版本</div><div class="v">' + U.esc(rec.protocolVersion || '—') + '</div>' +
      '<div class="k">监查员</div><div class="v">' + U.esc(user.name) + '（CRA）</div>' +
      '</div>';

    h += '<h2>一、核查结果汇总</h2><table><thead><tr><th>核查项总数</th><th>符合</th><th>一般问题</th><th>重大问题</th><th>不适用</th><th>未完成</th><th>完成率</th></tr></thead><tbody>' +
      '<tr><td>' + items.length + '</td><td>' + ok + '</td><td>' + iss + '</td><td><b>' + fai + '</b></td><td>' + na + '</td><td>' + undone + '</td>' +
      '<td>' + Math.round((items.length - undone) / (items.length || 1) * 100) + '%</td></tr></tbody></table>';

    var probs = items.filter(function (x) { return x.status === 'issue' || x.status === 'fail'; });
    h += '<h2>二、发现问题明细</h2><table><thead><tr><th>编号</th><th>核查项</th><th>级别</th><th>问题描述 / 记录</th></tr></thead><tbody>' +
      (probs.length ? probs.map(function (x) {
        return '<tr><td>' + U.esc(x.code) + '</td><td>' + U.esc(x.probe) + '</td>' +
          '<td>' + (x.status === 'fail' ? '<b style="color:#dc2626">重大</b>' : '一般') + '</td>' +
          '<td>' + U.esc(x.note || '现场核查发现不符合项，已与研究者沟通') + '</td></tr>';
      }).join('') : '<tr><td colspan="4" class="muted">本次监察未发现不符合项</td></tr>') +
      '</tbody></table>';

    h += '<h2>三、逐项核查记录</h2><table><thead><tr><th style="width:9%">编号</th><th style="width:44%">核查项</th><th style="width:8%">优先级</th><th style="width:11%">结论</th><th>备注</th></tr></thead><tbody>' +
      items.map(function (x) {
        var res = x.status === 'ok' ? '符合' : x.status === 'issue' ? '一般问题' : x.status === 'fail' ? '重大问题' : x.status === 'na' ? '不适用' : '未核查';
        return '<tr><td>' + U.esc(x.code) + '</td><td>' + U.esc(x.probe) + '</td><td>' + x.priority + '</td><td>' + res + '</td><td>' + U.esc(x.note || '') + '</td></tr>';
      }).join('') +
      '</tbody></table>';

    if (rec.signIn) {
      h += '<h2>四、现场签到与取证</h2><div class="kv">' +
        '<div class="k">签到人</div><div class="v">' + U.esc(rec.signIn.name) + '</div>' +
        '<div class="k">签到时间</div><div class="v">' + U.fmtDateTime(rec.signIn.ts) + '</div>' +
        '<div class="k">地理坐标</div><div class="v">' + U.esc(rec.signIn.geo || '—') + '</div>' +
        '<div class="k">取证照片</div><div class="v">' + (rec.photos || []).length + ' 张</div>' +
        '</div>';
    }

    h += '<h2>五、结论与后续行动</h2><p style="font-size:12px">本次监察共完成 ' + (items.length - undone) + ' 项核查，发现一般问题 ' + iss + ' 项、重大问题 ' + fai + ' 项。' +
      (fai ? '<b>重大问题需在 5 个工作日内提交 CAPA 并上报 PM/QA。</b>' : '未发现重大问题。') + '</p>';
    h += '<div class="sign"><div>监查员（' + U.esc(user.name) + '）签名 / 日期</div><div>PM / QA 审阅签名 / 日期</div></div>';

    U.downloadWord('监查访视报告_' + (rec.centerName || '') + '_' + U.fmtDate(rec.visitDate) + '.doc', h, '监查访视报告');
    U.toast('Word 报告已生成，可直接用 WPS / Office 打开、编辑与打印', 'ok');
  }

  /* ---------------------------------------------------------------- 离线同步 */
  function offlineSync() {
    var body = U.el('div', {});
    var db = S.load();
    var visits = db.visits;
    body.innerHTML = '<p style="margin-top:0;font-size:12.8px;color:var(--c-text-2)">现场网络不稳定时，可先在本机离线完成清单，回到办公室后导出数据包再导入到主库。数据包为 JSON 格式，包含清单、核查结论、签到与取证信息。</p>' +
      '<div style="background:var(--c-surface-2);border-radius:9px;padding:12px 14px;font-size:12.4px">' +
      '<b>本机已保存监察记录：' + visits.length + ' 条</b>' +
      (visits.length ? '<ul style="margin:8px 0 0;padding-left:18px">' + visits.slice(-5).map(function (v) {
        return '<li>' + U.esc(v.visitId) + ' · ' + U.esc(v.centerName || '') + ' · ' + U.fmtDate(v.visitDate) + ' · ' + U.esc(v.status || '') + '</li>';
      }).join('') + '</ul>' : '') +
      '</div>';
    var exp = U.el('button', { class: 'btn', text: '导出离线数据包' });
    var imp = U.el('button', { class: 'btn', text: '导入离线数据包' });
    var close = U.el('button', { class: 'btn btn-ghost', text: '关闭' });
    var m = U.openModal('离线数据同步', body, [exp, imp, close], true);
    close.onclick = m.close;
    exp.onclick = function () {
      U.downloadJSON('RBM离线数据包_' + S.todayStr() + '.json', { type: 'rbm-visit-package', exportedAt: new Date().toISOString(), visits: visits, ledger: db.ledger, krValues: db.krValues });
      U.toast('离线数据包已导出', 'ok');
    };
    imp.onclick = function () {
      var input = document.createElement('input');
      input.type = 'file'; input.accept = '.json';
      input.onchange = function () {
        var f = input.files[0]; if (!f) return;
        U.readFileText(f).then(function (txt) {
          try {
            var data = JSON.parse(txt);
            var db2 = S.load();
            var nv = 0, nl = 0;
            (data.visits || []).forEach(function (v) {
              var idx = db2.visits.findIndex(function (x) { return x.visitId === v.visitId; });
              if (idx >= 0) db2.visits[idx] = v; else db2.visits.push(v);
              nv++;
            });
            (data.ledger || []).forEach(function (l) {
              if (!db2.ledger.some(function (x) { return x.riskId === l.riskId; })) { db2.ledger.push(l); nl++; }
            });
            S.persist();
            S.audit('导入离线数据包', '文件 ' + f.name, '导入监察 ' + nv + ' 条、风险 ' + nl + ' 条');
            m.close();
            if (S.refreshNav) S.refreshNav();
            global.RBM_App.go('records');
            U.toast('已导入监察 ' + nv + ' 条、风险 ' + nl + ' 条', 'ok');
          } catch (err) { U.toast('数据包解析失败，请确认文件格式', 'error'); }
        });
      };
      input.click();
    };
  }

  global.RBM_Views.checklist = {
    title: '本次监察详情',
    sub: '',
    render: render,
    state: st,
    buildContext: buildContext,
    currentProject: currentProject,
    pushToLedger: pushToLedger,
    open: function (centerId) { st.centerId = centerId; st.view = 'setup'; st.checklist = null; }
  };
})(window);
