export interface OpenSourceProject {
  slug: string;
  name: string;
  productName: string;
  positioning: string;
  summary: string;
  proof: string[];
  stack: string[];
  coverUrl: string;
  repositoryUrl: string;
  demoUrl: string;
  accent: 'lime' | 'yellow' | 'blue';
}

export interface ShowcaseChapter {
  seconds: number;
  time: string;
  label: string;
  placeholder?: boolean;
}

export interface ShowcaseMetric {
  value: string;
  label: string;
  placeholder?: boolean;
}

export interface WorkShowcaseOverride {
  videoSrc?: string;
  chapters?: ShowcaseChapter[];
  metrics?: ShowcaseMetric[];
  demoUrl?: string;
  demoLabel?: string;
  accessCode?: string;
  note?: string;
}

export const workShowcaseOverrides: Record<string, WorkShowcaseOverride> = {
  'kolpilot-ai-creator-decision': {
    videoSrc: '/kolpilot-product-demo.mp4',
    chapters: [
      { seconds: 0, time: '00:00', label: '产品定位' },
      { seconds: 25, time: '00:25', label: '创建 Campaign' },
      { seconds: 70, time: '01:10', label: '可解释匹配' },
      { seconds: 120, time: '02:00', label: 'Shortlist 决策' },
      { seconds: 155, time: '02:35', label: '建联审批' },
      { seconds: 190, time: '03:10', label: '效果反馈' },
      { seconds: 215, time: '03:35', label: '总结' },
    ],
    metrics: [
      { value: '13 项', label: '端到端验收' },
      { value: 'Human', label: '关键节点确认' },
      { value: '可解释', label: '匹配证据链' },
    ],
    demoLabel: '站内完整案例',
    accessCode: '无需体验码',
    note: '本项目使用演示数据与 Mock AI，未声称真实客户商业业绩。',
  },
};

export const placeholderChapters: ShowcaseChapter[] = [
  { seconds: 0, time: '--:--', label: '章节 01 待补', placeholder: true },
  { seconds: 0, time: '--:--', label: '章节 02 待补', placeholder: true },
  { seconds: 0, time: '--:--', label: '章节 03 待补', placeholder: true },
  { seconds: 0, time: '--:--', label: '章节 04 待补', placeholder: true },
  { seconds: 0, time: '--:--', label: '章节 05 待补', placeholder: true },
];

export const placeholderMetrics: ShowcaseMetric[] = [
  { value: '待补充', label: '核心结果指标', placeholder: true },
  { value: '待补充', label: '效率或质量指标', placeholder: true },
  { value: '待补充', label: '用户或业务指标', placeholder: true },
];

export const capabilities = [
  { icon: 'panels', title: '产品设计', copy: '需求分析、功能拆解、原型设计、PRD 撰写' },
  { icon: 'search', title: 'RAG', copy: '文档分块、Query 改写、混合检索、融合与重排' },
  { icon: 'network', title: 'AGENT', copy: '多智能体编排、Workflow 搭建、工具调用、状态管理与记忆' },
  { icon: 'code', title: 'Prompt 工程', copy: '角色设定、任务拆解、Few-shot、输出约束与评测' },
  { icon: 'brain', title: 'LLM 认知', copy: '模型能力边界、上下文工程、SFT 与人机协作机制' },
  { icon: 'boxes', title: '全栈开发', copy: 'MVP 前后端开发、系统设计、部署与持续迭代' },
  { icon: 'workflow', title: '数据准备与评测', copy: '数据标注、测试集设计、失败分类与版本对比' },
  { icon: 'chart', title: '数据分析', copy: '数据清洗、统计分析、指标设计与结果可视化' },
] as const;

export const highlights = [
  { lead: '完成 KOLPilot 可点击 MVP 与 ', emphasis: '13 项', tail: '端到端验收，保留完整人机决策边界', placeholder: false },
  { lead: '已公开并部署 ', emphasis: '3 个', tail: 'AI 产品作品，独立放在开源项目页面持续迭代', placeholder: false },
  { lead: '代表性真实经历与量化成果：', emphasis: '待补充', tail: '（已预留展示位置）', placeholder: true },
  { lead: '行业奖项、证书或公开认可：', emphasis: '待补充', tail: '（已预留展示位置）', placeholder: true },
  { lead: '论文、文章或公开分享：', emphasis: '待补充', tail: '（已预留展示位置）', placeholder: true },
] as const;

export const openSourceProjects: OpenSourceProject[] = [
  {
    slug: 'roleproof',
    name: 'RoleProof',
    productName: 'AI 求职证据工作台',
    positioning: '把岗位要求、个人经历与可验证证据组织成一条可审查的求职决策链。',
    summary: '重点不是自动生成一份漂亮简历，而是让每条能力判断都能回到经历证据，并把最终表达留给用户确认。',
    proof: ['可运行 GitHub Pages Demo', '证据驱动的岗位匹配', '人工确认最终叙事'],
    stack: ['React', 'TypeScript', 'Evidence UX'],
    coverUrl: 'https://raw.githubusercontent.com/2392772541/roleproof/main/docs/roleproof-overview.png',
    repositoryUrl: 'https://github.com/2392772541/roleproof',
    demoUrl: 'https://2392772541.github.io/roleproof/',
    accent: 'lime',
  },
  {
    slug: 'flowerops-ai',
    name: 'FlowerOps',
    productName: 'AI 花店运营工作台',
    positioning: '将花店的订单、库存、客户沟通和运营判断收拢到同一套可执行工作流。',
    summary: '用合成数据验证日常运营路径，明确 AI 建议与人工经营判断的边界，不声称真实门店商业业绩。',
    proof: ['可运行 GitHub Pages Demo', '完整运营工作流', '合成数据与边界标注'],
    stack: ['React', 'Operations', 'Human-in-the-loop'],
    coverUrl: 'https://raw.githubusercontent.com/2392772541/flowerops-ai/main/docs/images/dashboard.png',
    repositoryUrl: 'https://github.com/2392772541/flowerops-ai',
    demoUrl: 'https://2392772541.github.io/flowerops-ai/',
    accent: 'yellow',
  },
  {
    slug: 'signaldesk',
    name: 'SignalDesk',
    productName: 'AI 情报研判工作台',
    positioning: '把分散信号、证据强度与人工研判组织成可追踪的情报决策界面。',
    summary: '展示从信息收集到判断输出的完整链路，避免把模型置信度包装成事实，让关键结论保留来源与责任人。',
    proof: ['可运行 GitHub Pages Demo', '来源与证据强度可追踪', '关键结论人工复核'],
    stack: ['React', 'Intelligence UX', 'Traceability'],
    coverUrl: 'https://raw.githubusercontent.com/2392772541/signaldesk-ai-intelligence-workbench/main/docs/screenshots/command-center-desktop.png',
    repositoryUrl: 'https://github.com/2392772541/signaldesk-ai-intelligence-workbench',
    demoUrl: 'https://2392772541.github.io/signaldesk-ai-intelligence-workbench/',
    accent: 'blue',
  },
];
