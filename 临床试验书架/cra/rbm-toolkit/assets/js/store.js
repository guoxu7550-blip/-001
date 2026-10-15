/* =============================================================================
 * RBM Toolkit · 状态与存储层 (store.js)
 * 本地持久化（localStorage）、版本快照、审计轨迹、角色权限、示例数据种子
 * ========================================================================== */
(function (global) {
  'use strict';

  var KEY = 'rbm_toolkit_db_v1';
  var CURRENT_USER_KEY = 'rbm_toolkit_user_v1';

  function uid(prefix) {
    return (prefix || 'ID') + '-' + Date.now().toString(36).toUpperCase() +
      '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function nowISO() { return new Date().toISOString(); }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function addDays(dateStr, days) {
    var d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ------------------------------------------------------------------ 默认库结构 */
  function emptyDB() {
    return {
      meta: { createdAt: nowISO(), updatedAt: nowISO(), schema: 1 },
      projects: [],      // 项目（方案）
      racts: [],         // RACT 评估记录（含版本）
      ledger: [],        // 风险台账
      visits: [],        // 访视记录（清单 + 签到 + 取证）
      krValues: [],      // KRI 实际值
      audit: [],         // 审计轨迹
      settings: {
        thresholds: { high: 60, mid: 30 },      // 条目级 RPN 阈值
        indexThresholds: { high: 50, mid: 25 }, // 综合风险指数分级
        defaultSdvHigh: 100, defaultSdvMid: 30, defaultSdvLow: 10,
        orgName: '临床运营中心 · RBM 质量体系'
      }
    };
  }

  /* ------------------------------------------------------------------ 数据读写 */
  var DB = null;

  function load() {
    if (DB) return DB;
    try {
      var raw = localStorage.getItem(KEY);
      DB = raw ? JSON.parse(raw) : null;
    } catch (e) { DB = null; }
    if (!DB || !DB.meta) { DB = emptyDB(); seed(DB); persist(); }
    return DB;
  }

  function persist() {
    if (!DB) return;
    DB.meta.updatedAt = nowISO();
    try { localStorage.setItem(KEY, JSON.stringify(DB)); }
    catch (e) { console.warn('持久化失败', e); }
  }

  function reset(keepSeed) {
    DB = emptyDB();
    if (keepSeed !== false) seed(DB);
    persist();
    return DB;
  }

  /* ------------------------------------------------------------------ 审计轨迹 */
  function audit(action, target, detail, before, after) {
    var db = load();
    var u = currentUser();
    db.audit.unshift({
      id: uid('AUD'),
      ts: nowISO(),
      user: u.name,
      role: u.role,
      action: action,
      target: target,
      detail: detail || '',
      before: before === undefined ? null : before,
      after: after === undefined ? null : after,
      device: (navigator.userAgent || '').slice(0, 60)
    });
    if (db.audit.length > 800) db.audit.length = 800;
    persist();
  }

  /* ------------------------------------------------------------------ 当前用户/角色 */
  function currentUser() {
    try {
      var raw = localStorage.getItem(CURRENT_USER_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return { name: '当前用户', role: 'CRA' };
  }

  function setUser(name, role) {
    var u = { name: name || '当前用户', role: role || 'CRA' };
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(u));
    return u;
  }

  function perm(key) {
    var role = currentUser().role;
    var cfg = global.RBM_Data.ROLES[role];
    if (!cfg) return false;
    return !!cfg.perm[key];
  }

  function can(key) { return perm(key); }

  /* ------------------------------------------------------------------ 评分计算 */
  function computeItem(item) {
    var p = Number(item.p) || 0, i = Number(item.i) || 0, d = Number(item.d) || 0;
    var scored = p > 0 && i > 0 && d > 0;
    return { rpn: scored ? p * i * d : 0, scored: scored };
  }

  function levelOfRPN(rpn, thresholds) {
    var t = thresholds || load().settings.thresholds;
    if (rpn >= t.high) return '高';
    if (rpn >= t.mid) return '中';
    if (rpn > 0) return '低';
    return '未评估';
  }

  function levelOfIndex(idx, th) {
    var t = th || load().settings.indexThresholds;
    if (idx >= t.high) return '高';
    if (idx >= t.mid) return '中';
    return '低';
  }

  /** 计算一份 RACT（scores: {itemId:{p,i,d}}, weights: {catId:number}） */
  function computeRACT(ract) {
    var cats = global.RBM_Data.RISK_CATEGORIES;
    var thresholds = (ract.thresholds) || load().settings.thresholds;
    var result = { categories: [], items: [], totalRaw: 0, totalWeighted: 0, maxWeighted: 0, index: 0, counts: { 高: 0, 中: 0, 低: 0, 未评估: 0 } };

    cats.forEach(function (cat) {
      var w = (ract.weights && ract.weights[cat.id] != null) ? Number(ract.weights[cat.id]) : cat.weight;
      var catRaw = 0, catWeighted = 0, catMax = 0, catCounts = { 高: 0, 中: 0, 低: 0, 未评估: 0 };
      var catItems = [];

      cat.items.forEach(function (it) {
        var sc = (ract.scores && ract.scores[it.id]) || {};
        var rec = { p: Number(sc.p) || 0, i: Number(sc.i) || 0, d: Number(sc.d) || 0 };
        var c = computeItem(rec);
        var level = levelOfRPN(c.rpn, thresholds);
        var item = {
          id: it.id, catId: cat.id, catName: cat.name, name: it.name, anchor: it.anchor,
          p: rec.p, i: rec.i, d: rec.d,
          rpn: c.rpn, weighted: c.rpn * w, weight: w, level: level, scored: c.scored
        };
        catRaw += c.rpn;
        catWeighted += item.weighted;
        catMax += 125 * w;
        catCounts[level] = (catCounts[level] || 0) + 1;
        result.counts[level] = (result.counts[level] || 0) + 1;
        catItems.push(item);
        result.items.push(item);
      });

      result.categories.push({
        id: cat.id, code: cat.code, name: cat.name, en: cat.en, icon: cat.icon, desc: cat.desc,
        weight: w, raw: catRaw, weighted: catWeighted, maxWeighted: catMax,
        ratio: catMax > 0 ? catWeighted / catMax : 0,
        items: catItems, counts: catCounts
      });
      result.totalRaw += catRaw;
      result.totalWeighted += catWeighted;
      result.maxWeighted += catMax;
    });

    result.index = result.maxWeighted > 0 ? Math.round(result.totalWeighted / result.maxWeighted * 1000) / 10 : 0;
    result.level = levelOfIndex(result.index);
    result.scoredCount = result.items.filter(function (x) { return x.scored; }).length;
    result.totalCount = result.items.length;
    result.progress = Math.round(result.scoredCount / result.totalCount * 100);
    return result;
  }

  /** 依据 RACT 结果生成监查动作建议 */
  function suggestActions(result) {
    var A = global.RBM_Data.MONITORING_ACTIONS;
    var out = [];
    result.categories.forEach(function (cat) {
      var level = levelOfIndex(cat.ratio * 100);
      var acts = (A[cat.id] || {})[level.toLowerCase() === '高' ? 'high' : (level === '中' ? 'mid' : 'low')] || [];
      if (!acts.length) return;
      out.push({
        catId: cat.id, catName: cat.name, ratio: Math.round(cat.ratio * 1000) / 10,
        level: level, actions: acts
      });
    });
    // 高频项优先（RPN ≥ 高阈值 的条目单独列出）
    var hotItems = result.items.slice().sort(function (a, b) { return b.weighted - a.weighted; })
      .filter(function (x) { return x.rpn > 0; }).slice(0, 8);
    return { byCategory: out, hotItems: hotItems, overall: overallStrategy(result) };
  }

  function overallStrategy(result) {
    var idx = result.index;
    if (idx >= load().settings.indexThresholds.high) {
      return {
        level: '高', frequency: '每 4–6 周现场监查 + 每周远程监查',
        sdv: '关键数据（CtQ）100% SDV，非关键数据抽样 ≥30%',
        escalate: '纳入 QA 定向稽查计划，风险月报上报 PM/QA',
        notes: '中心整体风险偏高，建议提升监查强度、开展专项培训、并复核监查资源配置。'
      };
    }
    if (idx >= load().settings.indexThresholds.mid) {
      return {
        level: '中', frequency: '每 8–12 周现场监查 + 每月远程监查',
        sdv: '关键数据 100% SDV，非关键数据抽样 20%',
        escalate: '风险季报上报 PM，重点问题按需上报 QA',
        notes: '中心存在可控风险，建议按 KRI 动态调整监查频率并跟踪闭环。'
      };
    }
    return {
      level: '低', frequency: '每季度现场监查 + 常规远程监查',
      sdv: '关键数据抽样 SDV ≥10%，依托中央统计监测',
      escalate: '纳入常规质量报告',
      notes: '中心风险可控，可降低现场监查频次、将资源向高风险中心倾斜。'
    };
  }

  /* ------------------------------------------------------------------ 项目/中心 */
  function addProject(p) {
    var db = load();
    var rec = Object.assign({ id: uid('PRJ'), createdAt: nowISO(), createdBy: currentUser().name }, p);
    db.projects.push(rec);
    audit('创建项目', '项目 ' + rec.name, '方案版本 ' + (rec.protocolVersion || '-'));
    persist();
    return rec;
  }

  function getProject(id) {
    return load().projects.filter(function (p) { return p.id === id; })[0] || null;
  }

  function addCenter(projectId, center) {
    var db = load();
    var p = db.projects.filter(function (x) { return x.id === projectId; })[0];
    if (!p) return null;
    p.centers = p.centers || [];
    var rec = Object.assign({ id: uid('S'), createdAt: nowISO() }, center);
    p.centers.push(rec);
    audit('新增中心', '中心 ' + rec.name, (rec.pi ? 'PI: ' + rec.pi : ''), null, rec);
    persist();
    return rec;
  }

  /* ------------------------------------------------------------------ RACT 存取 */
  function saveRACT(ract, changeSummary) {
    var db = load();
    var existing = ract.id ? db.racts.filter(function (r) { return r.id === ract.id; })[0] : null;
    var u = currentUser();

    if (existing) {
      // 生成版本快照
      existing.versions = existing.versions || [];
      existing.versions.push({
        version: existing.version || 'v1.0',
        ts: existing.updatedAt || existing.createdAt,
        by: existing.updatedBy || existing.createdBy,
        summary: changeSummary || '修订',
        snapshot: { scores: JSON.parse(JSON.stringify(existing.scores)), weights: JSON.parse(JSON.stringify(existing.weights || {})), thresholds: existing.thresholds }
      });
      var nextVer = 'v1.' + (existing.versions.length);
      existing.version = nextVer;
      existing.scores = ract.scores;
      existing.weights = ract.weights;
      existing.thresholds = ract.thresholds;
      existing.updatedAt = nowISO();
      existing.updatedBy = u.name;
      if (ract.status) existing.status = ract.status;
      audit('更新 RACT', 'RACT ' + existing.id, (changeSummary || '修订') + '（版本 ' + nextVer + '）', null, null);
      persist();
      return existing;
    }

    var rec = Object.assign({}, ract, {
      id: uid('RACT'),
      version: 'v1.0',
      versions: [],
      status: ract.status || '草稿',
      createdAt: nowISO(),
      createdBy: u.name,
      updatedAt: nowISO(),
      updatedBy: u.name
    });
    db.racts.push(rec);
    audit('创建 RACT', 'RACT ' + rec.id, '范围：' + (rec.scopeLabel || '') + '；' + (changeSummary || '初始评估'), null, null);
    persist();
    return rec;
  }

  function setRACTStatus(id, status) {
    var db = load();
    var r = db.racts.filter(function (x) { return x.id === id; })[0];
    if (!r) return null;
    var before = r.status;
    r.status = status;
    r.updatedAt = nowISO();
    if (status === '已签署') r.signedBy = currentUser().name, r.signedAt = nowISO();
    if (status === '已发布') r.publishedBy = currentUser().name, r.publishedAt = nowISO();
    audit('状态变更', 'RACT ' + id, before + ' → ' + status, before, status);
    persist();
    return r;
  }

  /* ------------------------------------------------------------------ 台账存取 */
  function saveLedger(entry) {
    var db = load();
    var idx = entry.id ? db.ledger.findIndex(function (x) { return x.id === entry.id; }) : -1;
    if (idx >= 0) {
      var before = JSON.parse(JSON.stringify(db.ledger[idx]));
      db.ledger[idx] = Object.assign(db.ledger[idx], entry, { updatedAt: nowISO(), updatedBy: currentUser().name });
      audit('更新风险条目', '风险 ' + entry.riskId, entry.status || '', before.rpn || before.currentRpn, entry.currentRpn);
      persist();
      return db.ledger[idx];
    }
    var rec = Object.assign({
      id: uid('RISK'),
      riskId: nextRiskId(db),
      createdAt: nowISO(),
      createdBy: currentUser().name,
      updatedAt: nowISO(),
      updatedBy: currentUser().name,
      status: '开放',
      escalate: false
    }, entry);
    db.ledger.push(rec);
    audit('新建风险条目', '风险 ' + rec.riskId, rec.description, null, rec.currentRpn);
    persist();
    return rec;
  }

  function nextRiskId(db) {
    var n = (db.ledger.length + 1);
    return 'RSK-' + String(n).padStart(4, '0');
  }

  function deleteLedger(id) {
    var db = load();
    var rec = db.ledger.filter(function (x) { return x.id === id; })[0];
    db.ledger = db.ledger.filter(function (x) { return x.id !== id; });
    audit('删除风险条目', '风险 ' + (rec ? rec.riskId : id), rec ? rec.description : '', rec, null);
    persist();
  }

  /* ------------------------------------------------------------------ 访视与清单 */
  function saveVisit(visit) {
    var db = load();
    var idx = visit.id ? db.visits.findIndex(function (x) { return x.id === visit.id; }) : -1;
    if (idx >= 0) {
      db.visits[idx] = Object.assign(db.visits[idx], visit, { updatedAt: nowISO() });
      audit('更新访视记录', '访视 ' + db.visits[idx].visitId, db.visits[idx].centerName || '');
      persist();
      return db.visits[idx];
    }
    var rec = Object.assign({
      id: uid('VISIT'),
      visitId: 'VS-' + new Date().getFullYear() + '-' + String(db.visits.length + 1).padStart(3, '0'),
      createdAt: nowISO(), createdBy: currentUser().name, updatedAt: nowISO(),
      signIn: null, photos: [], findings: []
    }, visit);
    db.visits.push(rec);
    audit('创建访视清单', '访视 ' + rec.visitId, (rec.centerName || '') + ' · ' + (rec.checklist ? rec.checklist.length : 0) + ' 项核查');
    persist();
    return rec;
  }

  /* ------------------------------------------------------------------ KRI 取值 */
  function setKRI(projectId, centerId, kriId, value, kriName, threshold) {
    var db = load();
    var exist = db.krValues.filter(function (k) {
      return k.projectId === projectId && k.centerId === centerId && k.kriId === kriId;
    })[0];
    var abnormal = Number(value) >= Number(threshold);
    if (exist) {
      exist.prevValue = exist.value; exist.value = Number(value); exist.abnormal = abnormal;
      exist.ts = nowISO(); exist.by = currentUser().name;
      persist(); return exist;
    }
    var rec = { id: uid('KRI'), projectId: projectId, centerId: centerId, kriId: kriId, kriName: kriName, threshold: threshold, value: Number(value), abnormal: abnormal, ts: nowISO(), by: currentUser().name };
    db.krValues.push(rec);
    persist();
    return rec;
  }

  function kriFor(projectId, centerId) {
    return load().krValues.filter(function (k) { return k.projectId === projectId && k.centerId === centerId; });
  }

  /* ------------------------------------------------------------------ 示例种子 */
  function seed(db) {
    var D = global.RBM_Data;
    var prj = {
      id: uid('PRJ'),
      name: 'XYZ-301 · 某单抗治疗中重度活动性克罗恩病 III 期临床研究',
      shortName: 'XYZ-301',
      protocolVersion: 'V3.0',
      phase: 'III 期',
      indication: '中重度活动性克罗恩病',
      sponsor: '示例申办方',
      totalTarget: 168,
      centerCount: 6,
      sdvPolicy: '关键数据 100% SDV',
      createdAt: nowISO(),
      createdBy: '系统',
      centers: D.DEMO_CENTERS.map(function (c) {
        return Object.assign({ id: uid('S') }, c, {
          createdAt: nowISO(),
          highRiskIssues: D.DEMO_ISSUES[c.id] || []
        });
      })
    };
    db.projects.push(prj);
    db.meta.activeProject = prj.id;

    // 一条示例 RACT（部分已评分）
    var scores = {};
    var demo = {
      'C1-1': [3, 4, 2], 'C1-2': [5, 5, 4], 'C1-3': [4, 4, 3], 'C1-4': [2, 3, 2],
      'C2-2': [4, 5, 3], 'C2-4': [3, 3, 2], 'C2-5': [4, 4, 3],
      'C3-1': [4, 5, 4], 'C3-2': [4, 4, 3], 'C3-5': [5, 4, 4], 'C3-6': [4, 3, 3],
      'C4-2': [3, 5, 4], 'C4-3': [5, 4, 3], 'C4-4': [4, 4, 5],
      'C5-1': [5, 5, 4], 'C5-2': [3, 4, 4], 'C5-3': [4, 4, 5],
      'C6-1': [4, 5, 3], 'C6-2': [3, 4, 2],
      'C7-1': [3, 4, 4], 'C7-2': [2, 4, 3],
      'C8-3': [4, 5, 4], 'C8-4': [3, 4, 3],
      'C9-4': [5, 4, 3], 'C9-5': [4, 4, 3]
    };
    Object.keys(demo).forEach(function (k) {
      scores[k] = { p: demo[k][0], i: demo[k][1], d: demo[k][2] };
    });
    var weights = {};
    D.RISK_CATEGORIES.forEach(function (c) { weights[c.id] = c.weight; });
    weights.C3 = 1.5; weights.C5 = 1.5;

    var ract = {
      id: uid('RACT'),
      projectId: prj.id,
      scope: 'study',
      scopeLabel: '项目级 RACT · ' + prj.shortName,
      title: prj.shortName + ' 项目级风险评估（示范）',
      scores: scores,
      weights: weights,
      thresholds: { high: 60, mid: 30 },
      version: 'v1.0',
      versions: [],
      status: '已发布',
      createdAt: nowISO(),
      createdBy: '系统',
      updatedAt: nowISO(),
      updatedBy: '系统'
    };
    db.racts.push(ract);

    // 示例风险台账
    var demoLedger = [
      { centerId: prj.centers[0].id, centerName: '北京协和医院', category: 'C5', ctq: 'CtQ6', kri: 'KRI-05', sop: 'SAFETY', description: '2 例 SAE 首次报告超过 24 小时时限', discoveredAt: addDays(todayStr(), -32), discoveredBy: '监查员 A', initRpn: 100, currentRpn: 45, action: '对研究团队开展 SAE 报告流程再培训，建立 SAE 24h 时钟提示机制', owner: '张伟（PI）', dueDate: addDays(todayStr(), -5), closedAt: null, escalate: true, escalateTo: 'PM/QA', conclusion: '', status: '整改中' },
      { centerId: prj.centers[0].id, centerName: '北京协和医院', category: 'C4', ctq: 'CtQ9', kri: 'KRI-02', sop: 'DATA', description: 'EDC 首例录入延迟平均 18 天，超方案规定 10 天', discoveredAt: addDays(todayStr(), -25), discoveredBy: '监查员 A', initRpn: 60, currentRpn: 60, action: '要求 CRC 每周清理待录入数据，纳入月度沟通议程', owner: '王敏（CRC）', dueDate: addDays(todayStr(), 6), closedAt: null, escalate: false, escalateTo: '', conclusion: '', status: '开放' },
      { centerId: prj.centers[4].id, centerName: '武汉同济医院', category: 'C3', ctq: 'CtQ2', kri: 'KRI-06', sop: 'PROTOCOL', description: '2 例方案重大违背未按规定在 5 个工作日内上报', discoveredAt: addDays(todayStr(), -40), discoveredBy: '监查员 B', initRpn: 80, currentRpn: 80, action: '暂停新受试者筛选，完成整改与 GCP 复训后方可恢复', owner: '孙鹏（PI）', dueDate: addDays(todayStr(), -2), closedAt: null, escalate: true, escalateTo: 'PM/QA', conclusion: '', status: '已升级' },
      { centerId: prj.centers[4].id, centerName: '武汉同济医院', category: 'C6', ctq: 'CtQ5', kri: 'KRI-08', sop: 'IP', description: '研究药物储存冰箱 2 次超温（2–8℃，实测 11℃），未及时评估', discoveredAt: addDays(todayStr(), -18), discoveredBy: '监查员 B', initRpn: 60, currentRpn: 36, action: '更换冰箱并加装温度报警，超温批次做隔离并送稳定性评估', owner: '孙鹏（PI）', dueDate: addDays(todayStr(), 3), closedAt: null, escalate: true, escalateTo: 'PM', conclusion: '', status: '整改中' },
      { centerId: prj.centers[1].id, centerName: '上海中山医院', category: 'C4', ctq: 'CtQ9', kri: 'KRI-03', sop: 'DATA', description: '未关闭数据查询积压 12 条，平均关闭时长 21 天', discoveredAt: addDays(todayStr(), -12), discoveredBy: '监查员 C', initRpn: 36, currentRpn: 24, action: '按周跟踪查询关闭率，目标 14 天内关闭', owner: '陈静（CRC）', dueDate: addDays(todayStr(), 9), closedAt: null, escalate: false, escalateTo: '', conclusion: '', status: '开放' },
      { centerId: prj.centers[5].id, centerName: '浙江大学附属第一医院', category: 'C1', ctq: 'CtQ8', kri: 'KRI-01', sop: 'PROTOCOL', description: '访视窗口偏差累计 4 例，其中 1 例超窗 12 天', discoveredAt: addDays(todayStr(), -55), discoveredBy: '监查员 C', initRpn: 48, currentRpn: 12, action: '制定访视日历并设置提前 7 天提醒', owner: '郑洁（PI）', dueDate: addDays(todayStr(), -20), closedAt: addDays(todayStr(), -22), escalate: false, escalateTo: '', conclusion: '整改后连续 2 个月无超窗事件，风险已降至可接受水平，条目关闭。', status: '已关闭' },
      { centerId: prj.centers[3].id, centerName: '四川大学华西医院', category: 'C4', ctq: 'CtQ9', kri: 'KRI-09', sop: 'DATA', description: '关键疗效数据缺失 1 例（基线 ESR 未检测）', discoveredAt: addDays(todayStr(), -9), discoveredBy: '监查员 C', initRpn: 30, currentRpn: 12, action: '已完成数据溯源与缺失说明，补充逻辑核查', owner: '周莉（CRC）', dueDate: addDays(todayStr(), 4), closedAt: null, escalate: false, escalateTo: '', conclusion: '', status: '已验证待关闭' }
    ];
    demoLedger.forEach(function (l, i) {
      l.id = uid('RISK');
      l.riskId = 'RSK-' + String(i + 1).padStart(4, '0');
      l.projectId = prj.id;
      l.createdAt = l.discoveredAt + 'T09:00:00.000Z';
      l.createdBy = l.discoveredBy;
      l.updatedAt = nowISO();
      l.updatedBy = l.discoveredBy;
      db.ledger.push(l);
    });

    // 示例 KRI 实值（用于趋势分析）
    ['S001', 'S002', 'S005'].forEach(function (sid) {
      var center = prj.centers.filter(function (c) { return c.id; })[D.DEMO_CENTERS.findIndex(function (d) { return d.id === sid; })];
      if (!center) return;
      [['KRI-01', '访视超窗率', 10, [8, 12, 15, 12, 18, 16]],
       ['KRI-02', '数据录入延迟 > 10 天占比', 15, [10, 14, 20, 22, 18, 16]],
       ['KRI-05', 'SAE 迟报（>24h）例数', 1, [0, 1, 0, 2, 1, 1]]].forEach(function (row) {
        var kriId = row[0], name = row[1], th = row[2], series = row[3];
        series.forEach(function (v, mi) {
          var d = new Date(); d.setMonth(d.getMonth() - (series.length - 1 - mi));
          var ts = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-05T08:00:00.000Z';
          db.krValues.push({
            id: uid('KRI'), projectId: prj.id, centerId: center.id, kriId: kriId, kriName: name,
            threshold: th, value: v, abnormal: v >= th, ts: ts, by: '中央监查系统'
          });
        });
      });
    });

    db.audit.push({
      id: uid('AUD'), ts: nowISO(), user: '系统', role: 'QA', action: '初始化示例数据',
      target: 'RBM Toolkit', detail: '载入 XYZ-301 示范项目、' + prj.centers.length + ' 个中心、' + demoLedger.length + ' 条风险台账', before: null, after: null, device: 'seed'
    });
  }

  /* ------------------------------------------------------------------ 导出 */
  global.RBM_Store = {
    load: load, persist: persist, reset: reset, emptyDB: emptyDB,
    uid: uid, nowISO: nowISO, todayStr: todayStr, addDays: addDays,
    audit: audit, currentUser: currentUser, setUser: setUser, can: can,
    computeItem: computeItem, computeRACT: computeRACT, levelOfRPN: levelOfRPN, levelOfIndex: levelOfIndex,
    suggestActions: suggestActions, overallStrategy: overallStrategy,
    addProject: addProject, getProject: getProject, addCenter: addCenter,
    saveRACT: saveRACT, setRACTStatus: setRACTStatus,
    saveLedger: saveLedger, deleteLedger: deleteLedger,
    saveVisit: saveVisit, setKRI: setKRI, kriFor: kriFor
  };
})(window);
