/* =============================================================================
 * RBM Toolkit · 领域数据层 (data.js)
 * 9 大风险类别 / CtQ 因子 / KRI 指标 / 监查动作建议 / 访视清单模板 / SOP 类型
 * 数据模型参考 TransCelerate RACT (Risk Assessment Categorization Tool) 与
 * ICH E6(R2/R3) 基于风险的监查质量体系框架。
 * ========================================================================== */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------------
   * 1. 九大风险类别（每类 5–8 个子项）
   *    content 字段用于评分向导的「例题 / 评分锚点」提示
   * ------------------------------------------------------------------------ */
  var RISK_CATEGORIES = [
    {
      id: 'C1',
      code: 'C1',
      name: '方案设计复杂性',
      en: 'Protocol Design Complexity',
      weight: 1.0,
      icon: '◈',
      desc: '方案本身固有的设计复杂度，决定执行偏差的先天概率。',
      items: [
        { id: 'C1-1', name: '入选/排除标准数量与复杂度', anchor: '≤5 条且客观可判定=1；>15 条或含主观判断条款=5' },
        { id: 'C1-2', name: '主要终点客观性', anchor: '硬终点（死亡/事件）=1；主观量表或影像判读=5' },
        { id: 'C1-3', name: '访视流程与窗口期复杂度', anchor: '≤3 次访视且窗口宽=1；密集访视/窄窗口=5' },
        { id: 'C1-4', name: '特殊操作 / 给药途径 / 器械使用', anchor: '口服常规给药=1；鞘内注射/介入操作/植入器械=5' },
        { id: 'C1-5', name: '方案修订频次与影响面', anchor: '无修订=1；≥3 次修订且涉及终点=5' },
        { id: 'C1-6', name: '随机化、分层与盲法设计', anchor: '开放标签、无分层=1；复杂分层+双盲揭盲流程=5' },
        { id: 'C1-7', name: '期中分析与适应性设计', anchor: '无期中分析=1；含成组序贯/样本量再估计=5' }
      ]
    },
    {
      id: 'C2',
      code: 'C2',
      name: '受试者人群与安全性',
      en: 'Subject Population & Safety',
      weight: 1.0,
      icon: '❤',
      desc: '人群特征带来的安全性暴露与依从性风险。',
      items: [
        { id: 'C2-1', name: '疾病严重程度与合并用药复杂度', anchor: '健康志愿者=1；危重症、多药联用=5' },
        { id: 'C2-2', name: '预期 AE / SAE 发生率', anchor: '已知低风险=1；同类药有黑框警告/致死性 AE=5' },
        { id: 'C2-3', name: '特殊人群（老年/儿科/孕期/肝肾功能不全）', anchor: '18–65 岁健康成人=1；儿科或孕产妇=5' },
        { id: 'C2-4', name: '受试者依从性与脱落风险', anchor: '短期住院观察=1；长期门诊+高脱落预期=5' },
        { id: 'C2-5', name: '知情同意复杂度', anchor: '标准同意书=1；需法定代理人/紧急入组后补同意=5' },
        { id: 'C2-6', name: '对照组设置与安慰剂接受度', anchor: '阳性对照=1；有创安慰剂对照或需停药洗脱=5' }
      ]
    },
    {
      id: 'C3',
      code: 'C3',
      name: '中心特征与团队经验',
      en: 'Site Characteristics & Experience',
      weight: 1.0,
      icon: '⚑',
      desc: '中心执行能力与既往质量表现，是差异化监查的核心依据。',
      items: [
        { id: 'C3-1', name: '中心既往 GCP 稽查 / 检查历史', anchor: '无缺陷记录=1；近 3 年有重大缺陷或警告信=5' },
        { id: 'C3-2', name: '研究者团队经验与人员流动率', anchor: '核心团队稳定且≥5 项同类经验=1；首参研+高流动=5' },
        { id: 'C3-3', name: '入组速度与竞争性项目数量', anchor: '独家项目、入组充裕=1；同适应证竞争项目≥3 个=5' },
        { id: 'C3-4', name: '中心 SOP 完备性与人员配置', anchor: '成熟 SOP + 专职 CRC=1；无 SOP、无 CRC=5' },
        { id: 'C3-5', name: '既往方案违背率', anchor: '≤2%=1；>10% 或存在重大违背=5' },
        { id: 'C3-6', name: '既往数据质量（查询数/录入延迟）', anchor: '查询率低、录入及时=1；查询堆积、长期延迟=5' },
        { id: 'C3-7', name: '中心设施与受试者可及性', anchor: '三甲 GCP 中心、受试者来源稳定=1；基层、来源不稳=5' }
      ]
    },
    {
      id: 'C4',
      code: 'C4',
      name: '数据完整性与关键数据',
      en: 'Data Integrity & Critical Data',
      weight: 1.0,
      icon: '▣',
      desc: '关键数据（CtQ 数据）的来源、采集与可溯源性风险。',
      items: [
        { id: 'C4-1', name: '关键数据来源复杂度', anchor: '单一 EDC 直接录入=1；多系统拼接+手工转录=5' },
        { id: 'C4-2', name: '数据录入方式（EDC 直录 vs 纸质转录）', anchor: 'EDC 直录=1；纸质源文件二次转录=5' },
        { id: 'C4-3', name: '数据录入延迟（首次录入时间）', anchor: '≤3 天=1；>10 天或集中补录=5' },
        { id: 'C4-4', name: '源数据可溯源性 / SDV 难度', anchor: '源文件清晰完整=1；源数据散落、无签名=5' },
        { id: 'C4-5', name: '中心实验室与本地实验室一致性', anchor: '统一中心实验室=1；多实验室且单位需换算=5' },
        { id: 'C4-6', name: '数据修改与稽查轨迹完整性', anchor: '系统强制留痕=1；存在后补/无理由修改=5' },
        { id: 'C4-7', name: '缺失数据与逻辑核查复杂度', anchor: '逻辑简单=1；复杂派生变量、多处缺失=5' }
      ]
    },
    {
      id: 'C5',
      code: 'C5',
      name: '安全性报告与药物警戒',
      en: 'Safety Reporting & Pharmacovigilance',
      weight: 1.0,
      icon: '✚',
      desc: 'AE/SAE 识别、编码、报告及时性与合规性风险。',
      items: [
        { id: 'C5-1', name: 'SAE 报告及时性（24 小时时限）', anchor: '无迟报=1；历史上曾出现迟报=5' },
        { id: 'C5-2', name: 'AE 术语编码（MedDRA）准确性', anchor: '编码规范、复核率 100%=1；编码错误频发=5' },
        { id: 'C5-3', name: '特别关注不良事件（AESI）识别', anchor: '无 AESI=1；AESI 需主动问诊且易漏=5' },
        { id: 'C5-4', name: '妊娠 / 超说明书用药 / 用药错误事件', anchor: '不适用=1；高风险人群且流程缺失=5' },
        { id: 'C5-5', name: '盲态安全性数据揭盲流程', anchor: '无揭盲需求=1；紧急揭盲流程复杂且易违规=5' },
        { id: 'C5-6', name: '安全性数据一致性（EDC 与安全库）', anchor: '单一入口=1；双库录入易不一致=5' }
      ]
    },
    {
      id: 'C6',
      code: 'C6',
      name: '试验用药品 / 器械管理',
      en: 'Investigational Product & Device Management',
      weight: 1.0,
      icon: '◉',
      desc: 'IP 供应、储存、发放、回收与盲态保持的执行风险。',
      items: [
        { id: 'C6-1', name: '冷链与储存条件控制', anchor: '常温储存=1；2–8℃ 冷链或 −20℃ 以下=5' },
        { id: 'C6-2', name: '随机化与发药流程（IRT/RTSM）', anchor: '手工简单发药=1；复杂分层随机+调药流程=5' },
        { id: 'C6-3', name: '回收、清点与销毁记录', anchor: '记录完整=1；历史存在账物不符=5' },
        { id: 'C6-4', name: '盲态保持与应急揭盲管理', anchor: '开放标签=1；双盲且曾发生破盲=5' },
        { id: 'C6-5', name: '器械操作培训与使用追溯', anchor: '器械简单、培训到位=1；植入式器械需手术追溯=5' },
        { id: 'C6-6', name: '供应短缺与效期管理', anchor: '供应充足、效期长=1；短效期、易断供=5' }
      ]
    },
    {
      id: 'C7',
      code: 'C7',
      name: '供应商与系统',
      en: 'Vendor & Systems',
      weight: 1.0,
      icon: '⧉',
      desc: '外部供应商与 IT 系统带来的数据与运营风险。',
      items: [
        { id: 'C7-1', name: '中心实验室 / 影像判读中心表现', anchor: '既往表现稳定=1；曾出现样本丢失/判读争议=5' },
        { id: 'C7-2', name: 'IRT / RTSM 系统稳定性', anchor: '系统成熟无故障=1；曾宕机影响发药=5' },
        { id: 'C7-3', name: 'ePRO / eCOA 设备与依从性', anchor: '不涉及=1；老年人群使用电子设备、依从性差=5' },
        { id: 'C7-4', name: '供应商资质与既往表现', anchor: '长期合作、审计合格=1；新供应商、无审计记录=5' },
        { id: 'C7-5', name: '系统集成与数据传输风险', anchor: '单一系统=1；多系统接口、传输需人工干预=5' },
        { id: 'C7-6', name: '数据备份、权限与网络安全', anchor: '合规云端备份=1；本地存储、权限共享=5' }
      ]
    },
    {
      id: 'C8',
      code: 'C8',
      name: '法规与伦理合规环境',
      en: 'Regulatory & Ethical Compliance',
      weight: 1.0,
      icon: '⚖',
      desc: '审批时效、法规差异与合规环境的执行风险。',
      items: [
        { id: 'C8-1', name: '伦理委员会（EC/IRB）审批时效与沟通', anchor: '快速审批、流程顺畅=1；审批周期>3 个月、沟通不畅=5' },
        { id: 'C8-2', name: '国家/地区法规差异', anchor: '单一国家、法规熟悉=1；多国多法规、政策频繁变动=5' },
        { id: 'C8-3', name: '知情同意流程合规性', anchor: '标准流程=1；涉及代理人同意、版本更新频繁=5' },
        { id: 'C8-4', name: '人类遗传资源审批与备案', anchor: '不涉及=1；涉及 HGR 采集且需审批备案=5' },
        { id: 'C8-5', name: '药监核查 / 飞行检查风险', anchor: '低风险类别=1；高风险品种或被列入核查重点=5' },
        { id: 'C8-6', name: '数据隐私与个人信息保护（PIPL/GDPR）', anchor: '无敏感个人信息=1；涉及基因/生物识别数据=5' }
      ]
    },
    {
      id: 'C9',
      code: 'C9',
      name: '监查与运营流程',
      en: 'Monitoring & Operational Process',
      weight: 1.0,
      icon: '⟳',
      desc: '监查体系本身的有效性与闭环能力。',
      items: [
        { id: 'C9-1', name: '监查频率与现场覆盖度', anchor: '季度现场监查=1；仅远程或覆盖不足=5' },
        { id: 'C9-2', name: '监查员经验与团队稳定性', anchor: '资深 CRA 长期负责=1；新人或频繁换人=5' },
        { id: 'C9-3', name: '监查报告质量与审核时效', anchor: '按时提交、质量稳定=1；长期迟交、内容空泛=5' },
        { id: 'C9-4', name: '问题整改闭环率', anchor: '闭环率>95%=1；闭环率<70%=5' },
        { id: 'C9-5', name: '关键风险指标（KRI）触发频率', anchor: '无触发=1；多项 KRI 持续超标=5' },
        { id: 'C9-6', name: '沟通与升级上报机制', anchor: '机制清晰且通畅=1；无明确升级路径=5' },
        { id: 'C9-7', name: '培训覆盖度与记录完整性', anchor: '全员培训+记录完整=1；培训缺失=5' }
      ]
    }
  ];

  /* ---------------------------------------------------------------------------
   * 2. 监查动作建议映射（类别 × 风险等级 → 具体监查策略）
   * ------------------------------------------------------------------------ */
  var MONITORING_ACTIONS = {
    C1: {
      high: ['对方案复杂条款（如主观终点、密集访视）实施 100% 现场核查', '启动前开展方案专项培训并留存考核记录', '关键访视设现场驻点监查或协调员远程陪访'],
      mid: ['首例受试者(HFI)访视执行现场监查', '每季度开展方案依从性远程核查', '建立方案疑问快速响应通道'],
      low: ['常规远程监查 + 年度现场访视', '方案修订后确认中心已签收并培训']
    },
    C2: {
      high: ['安全性数据 100% SDV，SAE 逐例溯源核对', '建立受试者安全随访台账，每月核查', '现场核查知情同意签署与再同意流程'],
      mid: ['SAE 100% 源数据核对，AE 抽样 SDV ≥30%', '每季度核查知情同意书版本一致性'],
      low: ['安全性数据抽样核查', '随访视核查知情同意完整性']
    },
    C3: {
      high: ['提高现场监查频率至每 4–6 周一次', '对中心团队开展 GCP 与方案再培训', '纳入 QA 定向稽查计划'],
      mid: ['每 8–12 周现场监查一次，重点核查既往缺陷项', '建立中心能力提升计划并跟踪'],
      low: ['每季度现场监查 + 远程常规监查', '维持基线监查频率']
    },
    C4: {
      high: ['关键数据（CtQ 数据点）实施 100% SDV', '核查源文件与 EDC 一致性、稽查轨迹完整性', '启动数据录入延迟周报并设置 KRI 告警'],
      mid: ['关键数据 100% SDV，非关键数据抽样 ≥20%', '每月评审查询关闭时效'],
      low: ['关键数据抽样 SDV ≥10%', '依赖中央统计监测（Central Statistical Monitoring）']
    },
    C5: {
      high: ['SAE 报告全流程专项监查，含 24 小时时限核查', '核查 AE/AESI 问诊记录与编码一致性', '联合药物警戒部门开展季度联合审核'],
      mid: ['SAE 100% 核查，AE 抽样核查 MedDRA 编码', '每季度安全性数据一致性核对'],
      low: ['随访视抽查安全性报告记录', '年度安全性数据回顾']
    },
    C6: {
      high: ['IP 储存、温控、发放、回收实施 100% 现场核查', '核查盲态保持与应急揭盲记录', '每季度账物相符清点'],
      mid: ['IP 账目与温度记录 100% 核查，实物抽盘 ≥50%', '核查随机化发药记录准确性'],
      low: ['随访视核查 IP 账目与温度记录', '年度 IP 全面清点']
    },
    C7: {
      high: ['核查供应商数据传输完整性与对账记录', '核查 ePRO/器械数据与 EDC 一致性', '将供应商纳入质量事件上报机制'],
      mid: ['每季度供应商绩效评审', '抽样核对系统间数据传输'],
      low: ['年度供应商绩效回顾', '依赖系统自动校验']
    },
    C8: {
      high: ['核查 EC 批件、年度报告与方案修订备案时效', '核查 HGR / PIPL 合规审批与授权文件', '建立法规变更影响评估机制'],
      mid: ['每季度核查法规文件归档完整性', '跟进伦理年度审查与再同意'],
      low: ['随访视核查合规文件归档', '年度合规自查']
    },
    C9: {
      high: ['提高监查频率并启用双人复核监查报告', '建立问题整改闭环看板，每周跟踪 Due Date', '启动 QA 对监查体系的专项评估'],
      mid: ['优化监查计划并按 KRI 动态调整频率', '每月评审问题闭环率'],
      low: ['维持现有监查计划', '依托中央监查持续监测 KRI']
    }
  };

  /* ---------------------------------------------------------------------------
   * 3. CtQ 因子（Critical to Quality）——用于差异化清单生成
   * ------------------------------------------------------------------------ */
  var CTQ_FACTORS = [
    { id: 'CtQ1', name: '知情同意（ICF）', sop: 'ICF', keywords: ['知情同意', 'ICF', '再同意', '代理人'] },
    { id: 'CtQ2', name: '受试者入选/排除标准', sop: 'ELIGIBILITY', keywords: ['入排', '入选', '排除', '资格'] },
    { id: 'CtQ3', name: '主要疗效终点评估', sop: 'EFFICACY', keywords: ['终点', '疗效', '量表', '评效'] },
    { id: 'CtQ4', name: '随机化与盲态保持', sop: 'RANDOM', keywords: ['随机', '盲态', '破盲', '揭盲'] },
    { id: 'CtQ5', name: '试验用药品/器械管理', sop: 'IP', keywords: ['药品', '药物', '器械', '发药', '温控'] },
    { id: 'CtQ6', name: '安全性事件报告（AE/SAE）', sop: 'SAFETY', keywords: ['SAE', 'AE', '不良事件', '安全性'] },
    { id: 'CtQ7', name: '关键安全性检查（实验室/ECG/影像）', sop: 'SAFETY', keywords: ['实验室', 'ECG', '心电图', '影像', '检查'] },
    { id: 'CtQ8', name: '方案依从性与访视窗口', sop: 'PROTOCOL', keywords: ['方案违背', '访视', '窗口期', '依从'] },
    { id: 'CtQ9', name: '数据录入与源数据一致性', sop: 'DATA', keywords: ['数据', 'EDC', '源文件', 'SDV', '查询'] },
    { id: 'CtQ10', name: '生物样本采集与运输', sop: 'SAMPLE', keywords: ['样本', '标本', '运输', '冷链'] }
  ];

  /* ---------------------------------------------------------------------------
   * 4. KRI 关键风险指标（含建议阈值与单位）
   * ------------------------------------------------------------------------ */
  var KRI_CATALOG = [
    { id: 'KRI-01', name: '访视超窗率', unit: '%', threshold: 10, direction: 'high', sop: 'PROTOCOL' },
    { id: 'KRI-02', name: '数据录入延迟 > 10 天占比', unit: '%', threshold: 15, direction: 'high', sop: 'DATA' },
    { id: 'KRI-03', name: '平均查询关闭时长', unit: '天', threshold: 14, direction: 'high', sop: 'DATA' },
    { id: 'KRI-04', name: '受试者脱落率', unit: '%', threshold: 15, direction: 'high', sop: 'PROTOCOL' },
    { id: 'KRI-05', name: 'SAE 迟报（>24h）例数', unit: '例', threshold: 1, direction: 'high', sop: 'SAFETY' },
    { id: 'KRI-06', name: '方案重大违背例数', unit: '例', threshold: 1, direction: 'high', sop: 'PROTOCOL' },
    { id: 'KRI-07', name: '筛查失败率', unit: '%', threshold: 30, direction: 'high', sop: 'ELIGIBILITY' },
    { id: 'KRI-08', name: 'IP 超温 / 短缺事件', unit: '次', threshold: 1, direction: 'high', sop: 'IP' },
    { id: 'KRI-09', name: '关键数据缺失率', unit: '%', threshold: 5, direction: 'high', sop: 'DATA' },
    { id: 'KRI-10', name: '中心关键人员变动', unit: '人次/季', threshold: 1, direction: 'high', sop: 'PROTOCOL' },
    { id: 'KRI-11', name: '知情同意规范性缺陷', unit: '例', threshold: 1, direction: 'high', sop: 'ICF' },
    { id: 'KRI-12', name: '问题整改逾期未闭环', unit: '项', threshold: 2, direction: 'high', sop: 'PROTOCOL' }
  ];

  /* ---------------------------------------------------------------------------
   * 5. SOP 类型（用于清单模板与台账归类）
   * ------------------------------------------------------------------------ */
  var SOP_TYPES = [
    { id: 'ICF', name: '知情同意' },
    { id: 'ELIGIBILITY', name: '受试者入选与筛选' },
    { id: 'PROTOCOL', name: '方案依从性与访视执行' },
    { id: 'SAFETY', name: '安全性报告与药物警戒' },
    { id: 'IP', name: '试验用药品/器械管理' },
    { id: 'DATA', name: '数据与源文件管理' },
    { id: 'EFFICACY', name: '疗效评估与终点' },
    { id: 'RANDOM', name: '随机化与盲态' },
    { id: 'SAMPLE', name: '生物样本管理' },
    { id: 'REGULATORY', name: '法规与伦理文件' },
    { id: 'DELEGATION', name: '授权与培训' }
  ];

  /* ---------------------------------------------------------------------------
   * 6. 访视核查清单模板库（按 SOP 类型 × 适用角色）
   *    probe 字段为核查提问，guide 为源数据核对指引
   * ------------------------------------------------------------------------ */
  var CHECKLIST_TEMPLATES = [
    {
      sop: 'ICF', role: 'CRA', name: '知情同意核查',
      items: [
        { code: 'ICF-01', probe: 'ICF 版本号与当前伦理批准版本一致？', guide: '核对 ICF 页脚版本号 vs EC 批件版本清单' },
        { code: 'ICF-02', probe: '受试者与研究者签署日期完整且符合逻辑（受试者先签）？', guide: '核对 ICF 签署页日期，与首次筛选访视日期比对' },
        { code: 'ICF-03', probe: '签署前是否充分给予考虑时间（无被迫入组迹象）？', guide: '核对签署日期与知情过程记录' },
        { code: 'ICF-04', probe: 'ICF 修改处由受试者本人签字并注明日期？', guide: '逐页检查修改痕迹' },
        { code: 'ICF-05', probe: '是否留存已签署 ICF 原件副本给受试者？', guide: '询问受试者/查看发放记录' },
        { code: 'ICF-06', probe: '方案修订后是否对在组受试者完成再知情？', guide: '核对再同意记录与方案修订生效日' }
      ]
    },
    {
      sop: 'ELIGIBILITY', role: 'CRA', name: '入选/排除标准核查',
      items: [
        { code: 'ELI-01', probe: '全部入选标准均有源数据支持？', guide: '按 ICF 清单逐条比对检验报告/病史记录' },
        { code: 'ELI-02', probe: '排除标准核查完整，无遗漏项？', guide: '核对筛选期检查结果是否覆盖全部排除条款' },
        { code: 'ELI-03', probe: '筛选期检查在方案规定的时间窗内完成？', guide: '比对检查日期与筛选窗口定义' },
        { code: 'ELI-04', probe: '入组判定由授权研究者签署？', guide: '核对授权表与入组确认记录签名' },
        { code: 'ELI-05', probe: '筛查失败受试者的记录与再筛流程合规？', guide: '核对筛查失败登记表与再筛间隔要求' }
      ]
    },
    {
      sop: 'PROTOCOL', role: 'CRA', name: '方案依从性与访视执行核查',
      items: [
        { code: 'PRO-01', probe: '本周期内所有访视均在方案规定窗口内完成？', guide: '提取访视日期表，逐例计算窗口偏差天数' },
        { code: 'PRO-02', probe: '所有方案规定的检查项目均已完成（无漏项）？', guide: '对照访视流程图核对检查结果报告' },
        { code: 'PRO-03', probe: '所有方案违背均已记录并评估影响？', guide: '核对违背登记表、偏离记录与评估结论' },
        { code: 'PRO-04', probe: '合并用药记录完整且未使用禁用药？', guide: '核对合并用药日志与方案禁用清单' },
        { code: 'PRO-05', probe: '受试者依从性与用药日志记录相符？', guide: '核对发药记录、回收记录与用药日志' },
        { code: 'PRO-06', probe: '访视延迟/超窗事件已按规定上报？', guide: '核对上报记录与 KRI 台账' }
      ]
    },
    {
      sop: 'SAFETY', role: 'CRA', name: '安全性报告核查',
      items: [
        { code: 'SAF-01', probe: '所有 AE/SAE 均已记录，且与源数据一致？', guide: '逐条比对病历、检验单与 EDC AE 页' },
        { code: 'SAF-02', probe: 'SAE 在获知后 24 小时内上报？', guide: '核对 SAE 获知时间与首次报告时间戳' },
        { code: 'SAF-03', probe: 'AE 严重程度、与药物关系判断有研究者依据？', guide: '核对研究者评估记录与判断理由' },
        { code: 'SAF-04', probe: 'AESI 已按方案特别关注清单识别与随访？', guide: '对照 AESI 清单核对问诊记录' },
        { code: 'SAF-05', probe: 'AE 结局已随访至转归或稳定？', guide: '核对随访记录与结局判定' },
        { code: 'SAF-06', probe: '安全性数据在 EDC 与安全数据库一致？', guide: '抽样比对两系统 AE 关键字段' }
      ]
    },
    {
      sop: 'IP', role: 'CRA', name: '试验用药品/器械核查',
      items: [
        { code: 'IP-01', probe: 'IP 接收、储存、发放、回收记录完整且账物相符？', guide: '现场盘点实物数量，与 IP 台账比对' },
        { code: 'IP-02', probe: '温度记录连续完整，无超温未评估事件？', guide: '查阅温度记录仪导出数据与超温评估报告' },
        { code: 'IP-03', probe: 'IP 储存条件符合方案要求（含备用电源）？', guide: '现场查看储存设备、温控与报警装置' },
        { code: 'IP-04', probe: '随机化与发药记录准确，无错发/漏发？', guide: '核对 IRT 记录与发药记录' },
        { code: 'IP-05', probe: '盲态保持良好，无潜在破盲风险？', guide: '检查 IP 包装完整性、储存区域权限' },
        { code: 'IP-06', probe: '剩余/过期 IP 按规定隔离与销毁？', guide: '核对隔离区标识与销毁记录' }
      ]
    },
    {
      sop: 'DATA', role: 'CRA', name: '数据与源文件核查',
      items: [
        { code: 'DAT-01', probe: '源文件完整、清晰、可溯源，符合 ALCOA+ 原则？', guide: '抽取关键数据点，从病历回溯至 EDC' },
        { code: 'DAT-02', probe: 'EDC 录入值与源文件一致（关键数据 100%）？', guide: '按 CtQ 数据点清单逐项比对' },
        { code: 'DAT-03', probe: '所有数据修改均有理由与日期、签名？', guide: '查阅稽查轨迹与修改备注' },
        { code: 'DAT-04', probe: '未关闭查询（Query）已清理并回复？', guide: '导出未关闭查询列表，逐条核对' },
        { code: 'DAT-05', probe: '数据录入及时性符合方案要求？', guide: '计算访视日期至首次录入日期的间隔' },
        { code: 'DAT-06', probe: '源文件存放、保密与权限管理合规？', guide: '查看文件柜锁具、上锁区域与访问授权' }
      ]
    },
    {
      sop: 'EFFICACY', role: 'CRA', name: '疗效评估与终点核查',
      items: [
        { code: 'EFF-01', probe: '主要终点评估由方案指定资质人员完成？', guide: '核对评估者授权表与培训记录' },
        { code: 'EFF-02', probe: '评估工具版本、校准与培训记录齐备？', guide: '查阅量表/设备校准证书与培训档案' },
        { code: 'EFF-03', probe: '评估时间点符合方案规定，无系统性偏移？', guide: '比对评估时间与实际访视时间' },
        { code: 'EFF-04', probe: '影像/中心判读流程与数据上传及时？', guide: '核对上传记录与判读中心反馈' },
        { code: 'EFF-05', probe: '评估结果无后期修改或主观调优迹象？', guide: '查阅稽查轨迹与原始记录' }
      ]
    },
    {
      sop: 'RANDOM', role: 'CRA', name: '随机化与盲态核查',
      items: [
        { code: 'RAN-01', probe: '随机化在确认入组资格后按序执行，无跳号？', guide: '核对筛选号、随机号序列与 IRT 记录' },
        { code: 'RAN-02', probe: '分层因素录入与源数据一致？', guide: '比对分层变量与源文件' },
        { code: 'RAN-03', probe: '应急揭盲记录完整，无违规揭盲？', guide: '核对揭盲申请、审批与原因记录' },
        { code: 'RAN-04', probe: '盲底文件按规定封存管理？', guide: '查看盲底封存与访问记录' }
      ]
    },
    {
      sop: 'SAMPLE', role: 'CRA', name: '生物样本管理核查',
      items: [
        { code: 'SAM-01', probe: '样本采集时间点、量与处理流程符合实验室手册？', guide: '对照 Lab Manual 核对采集记录' },
        { code: 'SAM-02', probe: '样本标识、标签清晰无错标？', guide: '现场抽查样本标签与记录一致性' },
        { code: 'SAM-03', probe: '样本运输温度与交接记录完整？', guide: '查阅运单、温度记录与交接签收' },
        { code: 'SAM-04', probe: '样本储存条件与库存台账相符？', guide: '盘点冻存样本位置与台账' },
        { code: 'SAM-05', probe: 'HGR 采集/出境有合规审批文件？', guide: '核对人类遗传资源审批/备案文件' }
      ]
    },
    {
      sop: 'REGULATORY', role: 'CRA', name: '法规与伦理文件核查',
      items: [
        { code: 'REG-01', probe: '伦理批件在有效期内，覆盖当前方案版本？', guide: '核对批件有效期与方案版本号' },
        { code: 'REG-02', probe: '本周期内方案修订已获伦理批准后执行？', guide: '比对批准日期与实际执行日期' },
        { code: 'REG-03', probe: '年度进展报告按时提交伦理？', guide: '查阅年度报告提交回执' },
        { code: 'REG-04', probe: '研究者授权表与实际执行人员一致？', guide: '比对授权表、签名表与源文件签名' },
        { code: 'REG-05', probe: '团队培训记录完整且覆盖最新方案版本？', guide: '查阅培训签到、考核与方案签收记录' }
      ]
    }
  ];

  /* ---------------------------------------------------------------------------
   * 7. 默认示例数据（用于首次打开时的演示与培训）
   * ------------------------------------------------------------------------ */
  var DEMO_CENTERS = [
    { id: 'S001', name: '北京协和医院', pi: '张伟', enrolled: 24, target: 30, rpn: 78.4, level: '高', openIssues: 5, lastVisit: '2026-09-18', nextVisit: '2026-10-20', krAnomalies: 3, cp: '王敏' },
    { id: 'S002', name: '上海中山医院', pi: '李明', enrolled: 31, target: 30, rpn: 52.1, level: '中', openIssues: 3, lastVisit: '2026-08-30', nextVisit: '2026-11-05', krAnomalies: 1, cp: '陈静' },
    { id: 'S003', name: '广州中山一院', pi: '黄强', enrolled: 18, target: 25, rpn: 41.7, level: '中', openIssues: 2, lastVisit: '2026-09-05', nextVisit: '2026-11-12', krAnomalies: 1, cp: '刘洋' },
    { id: 'S004', name: '四川大学华西医院', pi: '赵芳', enrolled: 27, target: 28, rpn: 26.3, level: '低', openIssues: 1, lastVisit: '2026-09-22', nextVisit: '2026-10-28', krAnomalies: 0, cp: '周莉' },
    { id: 'S005', name: '武汉同济医院', pi: '孙鹏', enrolled: 12, target: 25, rpn: 88.6, level: '高', openIssues: 7, lastVisit: '2026-07-28', nextVisit: '2026-10-16', krAnomalies: 5, cp: '吴涛' },
    { id: 'S006', name: '浙江大学附属第一医院', pi: '郑洁', enrolled: 22, target: 24, rpn: 34.9, level: '中', openIssues: 2, lastVisit: '2026-09-10', nextVisit: '2026-11-20', krAnomalies: 0, cp: '冯磊' }
  ];

  var DEMO_ISSUES = {
    S001: ['ICF 签署日期晚于首次检查日期', 'SAE 报告超 24 小时时限', '访视超窗未记录违背', '源文件修改无签名', 'IP 温度记录缺失 2 天'],
    S002: ['EDC 录入延迟超过 15 天', '合并用药未完整记录', '随机化分层因素录入错误', 'AE 严重程度判断依据不足'],
    S003: ['筛选期检查超出窗口', '受试者用药日志填写不全', '未关闭查询积压 12 条'],
    S004: ['IP 回收记录与实物差 1 支', '培训记录缺少新入职 CRC'],
    S005: ['关键数据缺失率 8%', 'ICF 未对在组受试者完成再同意', '方案重大违背 2 例未上报', '温控 2–8℃ 超温未评估', 'SAE 迟报 3 例', '数据修改无理由', '中心关键人员变动 2 人次'],
    S006: ['访视窗口偏差累积', '影像上传延迟']
  };

  /* ---------------------------------------------------------------------------
   * 8. 角色权限矩阵
   * ------------------------------------------------------------------------ */
  var ROLES = {
    CRA: {
      name: 'CRA 监查员', color: '#0f766e',
      desc: '执行风险评分、录入风险事件、生成访视清单',
      perm: { ractEdit: true, ractApprove: false, ractSign: false, ledgerCreate: true, ledgerEdit: true, ledgerClose: false, ledgerEscalate: true, checklistGen: true, auditView: false, admin: false, delete: false }
    },
    PM: {
      name: 'PM 项目经理', color: '#1d4ed8',
      desc: '审阅发布 RACT、关闭风险、调整监查策略',
      perm: { ractEdit: true, ractApprove: true, ractSign: false, ledgerCreate: true, ledgerEdit: true, ledgerClose: true, ledgerEscalate: true, checklistGen: true, auditView: true, admin: true, delete: true }
    },
    PI: {
      name: 'PI 主要研究者', color: '#7c3aed',
      desc: '确认中心层面风险、签署风险评估结论',
      perm: { ractEdit: false, ractApprove: true, ractSign: true, ledgerCreate: false, ledgerEdit: false, ledgerClose: true, ledgerEscalate: false, checklistGen: true, auditView: true, admin: false, delete: false }
    },
    QA: {
      name: 'QA 质量保证', color: '#b91c1c',
      desc: '全量审计权限、审批风险评估、稽查轨迹追溯',
      perm: { ractEdit: true, ractApprove: true, ractSign: true, ledgerCreate: true, ledgerEdit: true, ledgerClose: true, ledgerEscalate: true, checklistGen: true, auditView: true, admin: true, delete: true }
    }
  };

  /* ---------------------------------------------------------------------------
   * 9. 监查计划字段映射（导出用）
   *    tool 字段 → 监查计划 (Monitoring Plan) 目标字段
   * ------------------------------------------------------------------------ */
  var FIELD_MAPPING = [
    { tool: 'riskId', label: '风险编号', target: 'MP-3.1 风险登记表·编号' },
    { tool: 'category', label: '风险类别', target: 'MP-3.1 风险登记表·类别' },
    { tool: 'itemName', label: '风险条目', target: 'MP-3.1 风险登记表·风险描述' },
    { tool: 'probability', label: '概率 P', target: 'MP-3.1 风险登记表·发生可能性' },
    { tool: 'impact', label: '影响 I', target: 'MP-3.1 风险登记表·影响程度' },
    { tool: 'detectability', label: '可检测度 D', target: 'MP-3.1 风险登记表·可检测性' },
    { tool: 'rpn', label: 'RPN', target: 'MP-3.1 风险登记表·风险优先数' },
    { tool: 'weightedScore', label: '加权得分', target: 'MP-3.1 风险登记表·加权风险值' },
    { tool: 'level', label: '风险等级', target: 'MP-3.2 风险分级·等级' },
    { tool: 'monitoringAction', label: '监查动作建议', target: 'MP-4 监查策略·针对性措施' },
    { tool: 'frequency', label: '监查频率', target: 'MP-4 监查策略·监查频率' },
    { tool: 'sdvRate', label: 'SDV 比例', target: 'MP-4 监查策略·数据核查比例' },
    { tool: 'ctq', label: '关联 CtQ', target: 'MP-5 CtQ 清单·关联项' },
    { tool: 'kri', label: '关联 KRI', target: 'MP-6 KRI 清单·关联指标' }
  ];

  /* ---------------------------------------------------------------------------
   * 10. 评分量表锚点说明（评分向导用）
   * ------------------------------------------------------------------------ */
  var SCALE_GUIDE = {
    P: {
      label: '概率 Probability',
      question: '该风险在贵中心/本项目发生的可能性有多大？',
      anchors: [
        { v: 1, t: '极低 — 几乎不可能发生（<5%）', hint: '行业与既往项目中均极少出现' },
        { v: 2, t: '较低 — 偶尔发生（5–20%）', hint: '有零星案例，本中心暂无迹象' },
        { v: 3, t: '中等 — 有时发生（20–50%）', hint: '同类项目常见，本中心存在隐患' },
        { v: 4, t: '较高 — 经常发生（50–80%）', hint: '本中心既往已出现类似问题' },
        { v: 5, t: '很高 — 几乎必然发生（>80%）', hint: '本中心已发生且未见有效控制' }
      ]
    },
    I: {
      label: '影响 Impact',
      question: '一旦发生，对受试者安全、数据可靠性与法规合规的影响有多大？',
      anchors: [
        { v: 1, t: '可忽略 — 无实质影响', hint: '仅内部记录，不影响数据与安全' },
        { v: 2, t: '轻微 — 局部小影响', hint: '可通过常规流程快速修正' },
        { v: 3, t: '中等 — 影响单个受试者或部分数据', hint: '需要正式整改与追踪' },
        { v: 4, t: '严重 — 影响多个受试者或关键终点', hint: '可能触发方案违背评估或伦理报告' },
        { v: 5, t: '极严重 — 危及受试者安全或导致数据不可用', hint: '涉及 SAE、GCP 重大违背、监管风险' }
      ]
    },
    D: {
      label: '可检测度 Detectability',
      question: '该风险发生后，在现有监查/系统中被及时发现的能力如何？',
      anchors: [
        { v: 1, t: '极易发现 — 系统自动告警/100% 核查', hint: 'EDC 逻辑核查或中央监测即时捕捉' },
        { v: 2, t: '容易发现 — 常规监查可覆盖', hint: '例行访视或数据清理即可识别' },
        { v: 3, t: '一般 — 需主动核查才能发现', hint: '需专项核查设计才能有效暴露' },
        { v: 4, t: '较难发现 — 高度依赖现场核查', hint: '短期访视易漏检，需溯源对比' },
        { v: 5, t: '极难发现 — 无有效检测手段/易被掩盖', hint: '仅能靠受试者反馈或稽查偶然发现' }
      ]
    }
  };

  global.RBM_Data = {
    RISK_CATEGORIES: RISK_CATEGORIES,
    MONITORING_ACTIONS: MONITORING_ACTIONS,
    CTQ_FACTORS: CTQ_FACTORS,
    KRI_CATALOG: KRI_CATALOG,
    SOP_TYPES: SOP_TYPES,
    CHECKLIST_TEMPLATES: CHECKLIST_TEMPLATES,
    DEMO_CENTERS: DEMO_CENTERS,
    DEMO_ISSUES: DEMO_ISSUES,
    ROLES: ROLES,
    FIELD_MAPPING: FIELD_MAPPING,
    SCALE_GUIDE: SCALE_GUIDE
  };
})(window);
