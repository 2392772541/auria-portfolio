interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: { fetch(request: Request): Promise<Response> };
  DIGITAL_AVATAR_API_KEY?: string;
  DIGITAL_AVATAR_BASE_URL?: string;
  DIGITAL_AVATAR_MODEL?: string;
  DIGITAL_AVATAR_REASONING_EFFORT?: string;
  DIGITAL_AVATAR_TIMEOUT_MS?: string;
}

const VIDEO_URL = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260806_134653_2b70d062-3521-429b-a824-8d9f98de488a.mp4';
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/(^-|-$)/g, '') || `item-${Date.now()}`;
const parse = <T>(value: unknown, fallback: T): T => { try { return JSON.parse(String(value)) as T; } catch { return fallback; } };
const avatarAttempts = new Map<string, { count: number; resetAt: number }>();

type AvatarChatConfig = {
  enabled: boolean;
  welcome: string;
  suggestions: string[];
  system_prompt: string;
  knowledge: string;
  presets: Array<{ question: string; answer: string }>;
  max_output_tokens: number;
};

async function requestAvatarReply(env: Env, config: AvatarChatConfig, messages: Array<{ role: string; content: string }>, compatible = false) {
  const timeoutMs = Math.min(45_000, Math.max(1_000, Number(env.DIGITAL_AVATAR_TIMEOUT_MS || 15_000)));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), compatible ? Math.min(timeoutMs, 10_000) : timeoutMs);
  const startedAt = Date.now();
  try {
    const body: Record<string, unknown> = {
      model: String(env.DIGITAL_AVATAR_MODEL || 'gpt-5.6-sol'),
      max_tokens: compatible ? Math.min(config.max_output_tokens, 400) : config.max_output_tokens,
      messages: [
        { role: 'system', content: `${config.system_prompt}\n\n可用个人资料：\n${config.knowledge}`.trim() },
        ...messages,
      ],
    };
    const reasoningEffort = String(env.DIGITAL_AVATAR_REASONING_EFFORT || 'medium').trim();
    if (!compatible && reasoningEffort) body.reasoning_effort = reasoningEffort;
    const baseUrl = String(env.DIGITAL_AVATAR_BASE_URL || 'https://ai.nbcodex.com/v1').replace(/\/+$/, '');
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${String(env.DIGITAL_AVATAR_API_KEY || '').trim()}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      return {
        ok: false as const,
        status: response.status,
        retryable: response.status === 400 || response.status === 408 || response.status === 409 || response.status === 425 || response.status === 429 || response.status >= 500,
        durationMs: Date.now() - startedAt,
      };
    }
    const result = await response.json<Record<string, any>>();
    const reply = String(result?.choices?.[0]?.message?.content || '').trim();
    return reply
      ? { ok: true as const, reply, durationMs: Date.now() - startedAt }
      : { ok: false as const, status: 502, retryable: true, durationMs: Date.now() - startedAt };
  } catch (cause) {
    return {
      ok: false as const,
      status: cause instanceof Error && cause.name === 'AbortError' ? 504 : 502,
      retryable: true,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

function fallbackAvatarReply(config: AvatarChatConfig) {
  const suggestions = config.suggestions.slice(0, 3).filter(Boolean);
  const prompt = suggestions.length ? `你也可以先问：${suggestions.join('、')}。` : '你可以稍后再问我作品、能力或合作方式。';
  return `AI 服务刚刚有点忙，先由本地资料接待你。${config.welcome} ${prompt}`;
}

async function localizeExistingDefaults(db: D1Database) {
  await db.batch([
    db.prepare(`UPDATE works SET title=?,kicker=?,summary=?,problem=?,solution=?,result=?,stack_json=?,updated_at=? WHERE slug='agent-operations-system' AND title='Agent Operations System'`).bind('智能体运营控制系统','AI 智能体 / 运营系统','一套让多智能体任务可见、可恢复、可安全交付的生产级控制系统。','团队可以演示智能体，却无法信任长时间运行的任务，也无法快速解释失败原因。','设计了包含任务续跑、结构化审批、证据日志与故障恢复的人机协作流程。','任务中断率降低 62%，每一次关键决策都能追溯。',JSON.stringify(['智能体系统','工作流设计','TypeScript']),now()),
    db.prepare(`UPDATE works SET title=?,kicker=?,summary=?,problem=?,solution=?,result=?,stack_json=?,updated_at=? WHERE slug='knowledge-synthesis-engine' AND title='Knowledge Synthesis Engine'`).bind('知识合成引擎','RAG / 知识系统','把分散资料转化为可直接支持决策的研究引擎。','研究信息散落在视频、文档、消息与收藏中，缺少可靠的整合层。','构建具备来源追踪、引用、置信度标记与人工审阅的采集和检索系统。','将研究初稿从数天缩短到数小时，同时保留完整证据链。',JSON.stringify(['RAG','信息架构','效果评估']),now()),
    db.prepare(`UPDATE works SET title=?,kicker=?,summary=?,problem=?,solution=?,result=?,stack_json=?,updated_at=? WHERE slug='content-intelligence-workflow' AND title='Content Intelligence Workflow'`).bind('内容智能生产系统','自动化 / 内容系统','把专家知识稳定转化为多平台内容的端到端工作流。','大量高价值观点长期沉睡在录音和零散笔记中，无法形成持续输出。','梳理完整编辑流程，自动完成提取与多平台重组，并将人工判断保留在关键审核节点。','内容发布效率提升 3 倍，同时保持统一表达与可复用知识库。',JSON.stringify(['流程自动化','内容系统','大模型编排']),now()),
    db.prepare(`UPDATE posts SET title=?,category=?,excerpt=?,body=? WHERE slug='evidence-not-theatre' AND title='AI products need evidence, not theatre'`).bind('AI 产品需要证据，而不是表演','产品思考','一套判断 AI 功能是否真正有用的实战框架。','最有说服力的 AI 产品，不是动画最多、演示最炫的产品，而是能让不确定性被看见、在演示前定义成功、并在每次运行后保留证据的产品。\n\n先明确用户真正要做的决策，再设计最小但可观察的流程，帮助他把决策做得更好。衡量任务完成率、纠错成本和故障恢复能力，而不只是模型输出是否漂亮。'),
    db.prepare(`UPDATE posts SET title=?,category=?,excerpt=?,body=? WHERE slug='reliable-agents' AND title='What makes an AI agent reliable?'`).bind('什么让 AI 智能体真正可靠？','智能体系统','可靠性从“顺利演示”结束的地方开始。','可靠的智能体需要清晰边界、记忆、状态，以及把控制权交还给人的明确机制。每个长任务都应该可以续跑，每个高风险动作都应该可以审阅，每次失败都要留下足够证据用于诊断和继续。'),
    db.prepare(`UPDATE posts SET title=?,category=?,excerpt=?,body=? WHERE slug='rag-with-a-point-of-view' AND title='RAG needs a point of view'`).bind('RAG 需要自己的判断力','知识系统','检索只是基础设施，有价值的合成才是产品决策。','有用的知识产品不只是找出相似文本。它需要选择可靠来源、揭示观点冲突、尊重信息时效，并根据读者下一步要做的决策组织答案。这种编辑判断，才是知识产品真正的价值。'),
    db.prepare(`UPDATE resume SET profile=?,availability=?,location=?,experience_json=?,education_json=?,skills_json=?,updated_at=? WHERE id=1 AND profile LIKE 'I design and ship AI products%'`).bind('我擅长把模糊的 AI 需求转化为稳定可用的产品系统，能够连接产品判断、交互设计与实际落地，在复杂问题中快速找到最值得解决的部分。','期待 AI 产品、智能体系统与自动化方向的高价值机会。','中国 · 支持远程协作',JSON.stringify([{period:'2024 — 至今',role:'独立 AI 产品构建者',company:'精选客户项目与自主产品',detail:'从需求发现到产品上线，设计并交付智能体工作流、研究系统和内容自动化产品。'},{period:'2021 — 2024',role:'产品与自动化负责人',company:'数字产品团队',detail:'把运营痛点转化为可衡量的产品系统与可重复执行的工作流。'}]),JSON.stringify([{period:'持续学习',title:'应用 AI、产品系统与人机交互',place:'独立研究与实践'}]),JSON.stringify(['AI 产品策略','智能体系统','RAG 与知识系统','流程自动化','快速原型','产品叙事']),now()),
    db.prepare(`UPDATE site_settings SET name=?,role=?,hero_prefix=?,hero_emphasis=?,hero_suffix=?,hero_description=?,location=?,updated_at=? WHERE id=1 AND name='KAI / AI'`).bind('AI / PORTFOLIO','AI 产品构建者','把 AI 变成','真正可用的产品','而不只是一场演示。','专注智能体、自动化与知识系统，把模糊想法推进成可衡量、可交付、可持续迭代的产品。','中国 · 支持远程协作',now()),
  ]);
}

async function init(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS works (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL, kicker TEXT DEFAULT '', summary TEXT DEFAULT '', problem TEXT DEFAULT '', solution TEXT DEFAULT '', result TEXT DEFAULT '', stack_json TEXT DEFAULT '[]', cover_url TEXT DEFAULT '', showcase_url TEXT DEFAULT '', showcase_type TEXT DEFAULT 'image', showcase_layout TEXT DEFAULT 'standard', showcase_highlight TEXT DEFAULT '', showcase_cta TEXT DEFAULT '查看项目', status TEXT DEFAULT 'draft', featured INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL, category TEXT DEFAULT 'Notes', excerpt TEXT DEFAULT '', body TEXT DEFAULT '', cover_url TEXT DEFAULT '', content_type TEXT DEFAULT 'article', video_url TEXT DEFAULT '', status TEXT DEFAULT 'draft', published_at TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS resume (id INTEGER PRIMARY KEY CHECK(id=1), profile TEXT DEFAULT '', availability TEXT DEFAULT '', location TEXT DEFAULT '', email TEXT DEFAULT '', experience_json TEXT DEFAULT '[]', education_json TEXT DEFAULT '[]', skills_json TEXT DEFAULT '[]', updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS site_settings (id INTEGER PRIMARY KEY CHECK(id=1), name TEXT DEFAULT '', role TEXT DEFAULT '', hero_prefix TEXT DEFAULT '', hero_emphasis TEXT DEFAULT '', hero_suffix TEXT DEFAULT '', hero_description TEXT DEFAULT '', hero_video_url TEXT DEFAULT '', email TEXT DEFAULT '', location TEXT DEFAULT '', updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, object_key TEXT UNIQUE NOT NULL, name TEXT NOT NULL, content_type TEXT NOT NULL, size INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS avatar_settings (id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 1, name TEXT NOT NULL DEFAULT '小羊数字分身', subtitle TEXT NOT NULL DEFAULT 'AI PORTFOLIO GUIDE', welcome TEXT NOT NULL DEFAULT '你好，我是小羊的数字分身。你可以问我作品、能力或合作方式。', placeholder TEXT NOT NULL DEFAULT '问问我的作品、能力或合作方式…', suggestions_json TEXT NOT NULL DEFAULT '[]', system_prompt TEXT NOT NULL DEFAULT '', knowledge TEXT NOT NULL DEFAULT '', presets_json TEXT NOT NULL DEFAULT '[]', max_output_tokens INTEGER NOT NULL DEFAULT 700, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`),
  ]);
  await db.prepare(`INSERT OR IGNORE INTO avatar_settings (id,enabled,name,subtitle,welcome,placeholder,suggestions_json,system_prompt,knowledge,presets_json,max_output_tokens) VALUES (1,1,?,?,?,?,?,?,?,?,?)`).bind(
    '小羊数字分身','AI PORTFOLIO GUIDE','你好，我是小羊的数字分身。你可以问我作品、能力或合作方式。','问问我的作品、能力或合作方式…',JSON.stringify(['你最擅长什么？','介绍一个代表作品','怎么和你合作？']),'你是小羊的个人网站数字分身。用第一人称、自然简洁的中文回答；只根据提供的个人资料回答，不编造经历、客户、数据或承诺。资料不足时明确说不知道，并引导访客通过网站联系。','小羊专注视觉系统、品牌内容与 AI 工作流，擅长把模糊需求整理成可执行、可交付的产品和内容系统。',JSON.stringify([{question:'你最擅长什么？',answer:'我擅长把视觉系统、品牌内容和 AI 工作流结合起来，让内容生产更快、更准，也更有辨识度。'},{question:'介绍一个代表作品',answer:'你可以先看首页的精选作品。每个案例都包含问题、解决方案与最终结果，我也可以根据你关注的方向继续介绍。'},{question:'怎么和你合作？',answer:'可以通过网站底部的联系方式告诉我你的目标、时间和当前卡点。我会先判断最值得解决的部分，再给出清晰的合作路径。'}]),700,
  ).run();
  const postColumns = await db.prepare('PRAGMA table_info(posts)').all<{ name: string }>();
  const postColumnNames = new Set(postColumns.results.map(column => column.name));
  const upgrades: D1PreparedStatement[] = [];
  if (!postColumnNames.has('content_type')) upgrades.push(db.prepare(`ALTER TABLE posts ADD COLUMN content_type TEXT NOT NULL DEFAULT 'article'`));
  if (!postColumnNames.has('video_url')) upgrades.push(db.prepare(`ALTER TABLE posts ADD COLUMN video_url TEXT NOT NULL DEFAULT ''`));
  const workColumns = await db.prepare('PRAGMA table_info(works)').all<{ name: string }>();
  const workColumnNames = new Set(workColumns.results.map(column => column.name));
  const needsShowcaseLayoutBackfill = !workColumnNames.has('showcase_layout');
  if (!workColumnNames.has('showcase_url')) upgrades.push(db.prepare(`ALTER TABLE works ADD COLUMN showcase_url TEXT NOT NULL DEFAULT ''`));
  if (!workColumnNames.has('showcase_type')) upgrades.push(db.prepare(`ALTER TABLE works ADD COLUMN showcase_type TEXT NOT NULL DEFAULT 'image'`));
  if (!workColumnNames.has('showcase_layout')) upgrades.push(db.prepare(`ALTER TABLE works ADD COLUMN showcase_layout TEXT NOT NULL DEFAULT 'standard'`));
  if (!workColumnNames.has('showcase_highlight')) upgrades.push(db.prepare(`ALTER TABLE works ADD COLUMN showcase_highlight TEXT NOT NULL DEFAULT ''`));
  if (!workColumnNames.has('showcase_cta')) upgrades.push(db.prepare(`ALTER TABLE works ADD COLUMN showcase_cta TEXT NOT NULL DEFAULT '查看项目'`));
  if (upgrades.length) await db.batch(upgrades);
  if (needsShowcaseLayoutBackfill) {
    await db.prepare(`UPDATE works SET showcase_layout='portrait' WHERE slug='agent-operations-system'`).run();
  }
  const count = await db.prepare('SELECT COUNT(*) AS n FROM works').first<{ n: number }>();
  await localizeExistingDefaults(db);
  const hasExistingWorks = Number(count?.n) > 0;
  const postCount = await db.prepare('SELECT COUNT(*) AS n FROM posts').first<{ n: number }>();
  const hasExistingPosts = Number(postCount?.n) > 0;
  const works = [
    ['agent-operations-system','智能体运营控制系统','AI 智能体 / 运营系统','一套让多智能体任务可见、可恢复、可安全交付的生产级控制系统。','团队可以演示智能体，却无法信任长时间运行的任务，也无法快速解释失败原因。','设计了包含任务续跑、结构化审批、证据日志与故障恢复的人机协作流程。','任务中断率降低 62%，每一次关键决策都能追溯。','["智能体系统","工作流设计","TypeScript"]','https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1800&q=85'],
    ['knowledge-synthesis-engine','知识合成引擎','RAG / 知识系统','把分散资料转化为可直接支持决策的研究引擎。','研究信息散落在视频、文档、消息与收藏中，缺少可靠的整合层。','构建具备来源追踪、引用、置信度标记与人工审阅的采集和检索系统。','将研究初稿从数天缩短到数小时，同时保留完整证据链。','["RAG","信息架构","效果评估"]','https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1800&q=85'],
    ['content-intelligence-workflow','内容智能生产系统','自动化 / 内容系统','把专家知识稳定转化为多平台内容的端到端工作流。','大量高价值观点长期沉睡在录音和零散笔记中，无法形成持续输出。','梳理完整编辑流程，自动完成提取与多平台重组，并将人工判断保留在关键审核节点。','内容发布效率提升 3 倍，同时保持统一表达与可复用知识库。','["流程自动化","内容系统","大模型编排"]','https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1800&q=85'],
    ['visual-language-system','品牌视觉语言系统','品牌 / 视觉系统','把品牌策略转译成可持续使用的视觉规则。','团队在多平台发布时视觉表达不一致。','建立色彩、字体、构图和组件规范，并交付可复用模板。','跨渠道制作时间降低 45%。','["品牌策略","视觉系统","组件设计"]','https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=1800&q=85'],
    ['research-dashboard','研究决策仪表盘','研究 / 数据产品','让研究进度、证据和结论在一个界面里清晰可见。','研究资料多而分散，关键结论难以复核。','构建来源、置信度、冲突观点和行动建议的可视化工作台。','决策会议准备时间缩短 60%。','["研究设计","数据可视化","信息架构"]','https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1800&q=85'],
    ['creator-workbench','创作者工作台','内容 / 工作流','为个人创作者搭建从灵感到发布的连续工作流。','灵感、素材和成稿分散在多个工具中。','整合采集、提纲、编辑、审核和发布状态，减少重复搬运。','每周稳定产出提升 2.5 倍。','["内容策略","自动化","产品原型"]','https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1800&q=85'],
    ['service-blueprint','AI 服务蓝图','服务设计 / AI','把复杂 AI 服务拆成可理解、可交付的体验路径。','用户只看到模型能力，看不到服务边界和责任分工。','用服务蓝图标注触点、状态、人工介入和失败恢复。','上线后的支持请求减少 38%。','["服务设计","用户体验","AI 产品"]','https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1800&q=85'],
    ['knowledge-ops-kit','知识运营工具箱','知识运营 / 系统','把团队知识沉淀为可检索、可维护的日常工具。','知识更新依赖个人记忆，内容容易过期。','设计采集、审核、版本和归档流程，让知识持续新鲜。','知识复用率提升 3 倍。','["知识管理","流程设计","RAG"]','https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&w=1800&q=85'],
  ];
  const statements: D1PreparedStatement[] = works.slice(hasExistingWorks ? 3 : 0).map((w, i) => {
    const absoluteIndex = (hasExistingWorks ? 3 : 0) + i;
    return db.prepare(`INSERT OR IGNORE INTO works (id,slug,title,kicker,summary,problem,solution,result,stack_json,cover_url,showcase_layout,status,featured,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,'published',?,?)`).bind(uid(), ...w, absoluteIndex === 0 ? 'portrait' : 'standard', i < 2 && !hasExistingWorks ? 1 : 0, absoluteIndex);
  });
  const posts = [
    ['evidence-not-theatre','AI 产品需要证据，而不是表演','产品思考','一套判断 AI 功能是否真正有用的实战框架。','最有说服力的 AI 产品，不是动画最多、演示最炫的产品，而是能让不确定性被看见、在演示前定义成功、并在每次运行后保留证据的产品。\n\n先明确用户真正要做的决策，再设计最小但可观察的流程，帮助他把决策做得更好。衡量任务完成率、纠错成本和故障恢复能力，而不只是模型输出是否漂亮。'],
    ['reliable-agents','什么让 AI 智能体真正可靠？','智能体系统','可靠性从“顺利演示”结束的地方开始。','可靠的智能体需要清晰边界、记忆、状态，以及把控制权交还给人的明确机制。每个长任务都应该可以续跑，每个高风险动作都应该可以审阅，每次失败都要留下足够证据用于诊断和继续。'],
    ['rag-with-a-point-of-view','RAG 需要自己的判断力','知识系统','检索只是基础设施，有价值的合成才是产品决策。','有用的知识产品不只是找出相似文本。它需要选择可靠来源、揭示观点冲突、尊重信息时效，并根据读者下一步要做的决策组织答案。这种编辑判断，才是知识产品真正的价值。'],
    ['designing-for-recovery','为失败设计恢复路径','产品方法','真正可靠的产品，要让失败可见、可解释、可继续。','把失败当作流程的一部分来设计，用户才知道下一步该做什么。'],
    ['the-interface-is-a-contract','界面是一份可执行的契约','交互设计','好的界面会明确状态、边界和责任，而不只是看起来漂亮。','当界面把系统状态说清楚，用户就能更快判断、修正和交接。'],
    ['small-systems-big-leverage','小系统也能产生大杠杆','工作流','持续复用的小工具，往往比一次性的复杂方案更有价值。','从一个真实重复动作开始，建立可观察、可迭代、可维护的最小系统。'],
  ];
  posts.slice(hasExistingPosts ? 3 : 0).forEach((p, i) => statements.push(db.prepare(`INSERT OR IGNORE INTO posts (id,slug,title,category,excerpt,body,status,published_at) VALUES (?,?,?,?,?,?,'published',?)`).bind(uid(), ...p, new Date(Date.now() - ((hasExistingPosts ? 3 : 0) + i) * 86400000).toISOString())));
  const experience = JSON.stringify([
    {period:'2024 — 至今',role:'独立 AI 产品构建者',company:'精选客户项目与自主产品',detail:'从需求发现到产品上线，设计并交付智能体工作流、研究系统和内容自动化产品。'},
    {period:'2021 — 2024',role:'产品与自动化负责人',company:'数字产品团队',detail:'把运营痛点转化为可衡量的产品系统与可重复执行的工作流。'},
  ]);
  const education = JSON.stringify([{period:'持续学习',title:'应用 AI、产品系统与人机交互',place:'独立研究与实践'}]);
  const skills = JSON.stringify(['AI 产品策略','智能体系统','RAG 与知识系统','流程自动化','快速原型','产品叙事']);
  if (!hasExistingWorks) {
    statements.push(db.prepare(`INSERT INTO resume (id,profile,availability,location,email,experience_json,education_json,skills_json) VALUES (1,?,?,?,?,?,?,?)`).bind('我擅长把模糊的 AI 需求转化为稳定可用的产品系统，能够连接产品判断、交互设计与实际落地，在复杂问题中快速找到最值得解决的部分。','期待 AI 产品、智能体系统与自动化方向的高价值机会。','中国 · 支持远程协作','hello@example.com',experience,education,skills));
    statements.push(db.prepare(`INSERT INTO site_settings (id,name,role,hero_prefix,hero_emphasis,hero_suffix,hero_description,hero_video_url,email,location) VALUES (1,?,?,?,?,?,?,?,?,?)`).bind('AI / PORTFOLIO','AI 产品构建者','把 AI 变成','真正可用的产品','而不只是一场演示。','专注智能体、自动化与知识系统，把模糊想法推进成可衡量、可交付、可持续迭代的产品。',VIDEO_URL,'hello@example.com','中国 · 支持远程协作'));
  }
  statements.push(db.prepare(`INSERT INTO works (id,slug,title,kicker,summary,problem,solution,result,stack_json,cover_url,showcase_url,showcase_type,showcase_layout,showcase_highlight,showcase_cta,status,featured,sort_order,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'published',1,-10,?)
    ON CONFLICT(slug) DO UPDATE SET title=excluded.title,kicker=excluded.kicker,summary=excluded.summary,problem=excluded.problem,solution=excluded.solution,result=excluded.result,stack_json=excluded.stack_json,cover_url=excluded.cover_url,showcase_url=excluded.showcase_url,showcase_type=excluded.showcase_type,showcase_layout=excluded.showcase_layout,showcase_highlight=excluded.showcase_highlight,showcase_cta=excluded.showcase_cta,status='published',featured=1,sort_order=-10,updated_at=excluded.updated_at`).bind(
      uid(),'kolpilot-ai-creator-decision','KOLPilot｜AI 达人合作决策工作台','AI Product / Workflow',
      '面向中国中小品牌，将 Brief、候选发现、可解释匹配、Shortlist、建联审批和效果反馈放入同一 Campaign。',
      '达人合作的信息分散在 Brief、表格、聊天和多个平台中；AI 推荐又常只给黑箱分数，运营无法判断依据、时效和风险。',
      '以 Campaign 为上下文根节点，串联 AI Brief 结构化、受控候选发现、证据化匹配、Shortlist 人工决策、建联草稿审批、效果反馈和审计日志。预算、合作对象和外部发送必须人工批准。',
      '完成可点击 MVP、13 项端到端验收、完整人机边界设计，以及调研、指标、失败案例和正式数据接入方案。',
      JSON.stringify(['AI 产品设计','Human-in-the-loop','可解释推荐','React']),'/kolpilot-project-panorama.png','/kolpilot-project-panorama.png','image','wide','完成可点击 MVP、13 项端到端验收、完整人机边界设计。','查看项目',now()));
  await db.batch(statements);
}

const work = (row: Record<string, unknown>) => ({
  ...row,
  stack: parse(row.stack_json, [] as string[]),
  showcase_url: String(row.showcase_url || ''),
  showcase_type: row.showcase_type === 'video' ? 'video' : 'image',
  showcase_layout: ['wide','portrait','standard'].includes(String(row.showcase_layout)) ? row.showcase_layout : 'standard',
  showcase_highlight: String(row.showcase_highlight || ''),
  showcase_cta: String(row.showcase_cta || '查看项目'),
  featured: Number(row.featured),
  sort_order: Number(row.sort_order),
  stack_json: undefined,
});
const post = (row: Record<string, unknown>) => ({ ...row, content_type: row.content_type || 'article', video_url: row.video_url || '' });
const avatarValue = (row: Record<string, unknown> | null, admin = false) => { const v=row??{}; const shared={enabled:Boolean(v.enabled??1),name:String(v.name||'小羊数字分身'),subtitle:String(v.subtitle||'AI PORTFOLIO GUIDE'),welcome:String(v.welcome||'你好，我是小羊的数字分身。你可以问我作品、能力或合作方式。'),placeholder:String(v.placeholder||'问问我的作品、能力或合作方式…'),suggestions:parse(v.suggestions_json,[] as string[])}; return admin?{...shared,system_prompt:String(v.system_prompt||''),knowledge:String(v.knowledge||''),presets:parse(v.presets_json,[] as Array<{question:string;answer:string}>),max_output_tokens:Math.max(100,Math.min(2000,Number(v.max_output_tokens)||700))}:shared; };

async function bootstrap(db: D1Database, admin = false) {
  const condition = admin ? '' : `WHERE status='published'`;
  const [works, posts, resume, settings, avatar, media] = await Promise.all([
    db.prepare(`SELECT * FROM works ${condition} ORDER BY featured DESC, sort_order ASC`).all(),
    db.prepare(`SELECT * FROM posts ${condition} ORDER BY published_at DESC, created_at DESC`).all(),
    db.prepare('SELECT * FROM resume WHERE id=1').first<Record<string, unknown>>(),
    db.prepare('SELECT * FROM site_settings WHERE id=1').first<Record<string, unknown>>(),
    db.prepare('SELECT * FROM avatar_settings WHERE id=1').first<Record<string, unknown>>(),
    admin ? db.prepare('SELECT * FROM media ORDER BY created_at DESC').all() : Promise.resolve({ results: [] }),
  ]);
  const r = resume ?? {};
  return { works: works.results.map(x => work(x as Record<string, unknown>)), posts: posts.results.map(x => post(x as Record<string, unknown>)), resume: { profile:r.profile ?? '', availability:r.availability ?? '', location:r.location ?? '', email:r.email ?? '', experience:parse(r.experience_json, []), education:parse(r.education_json, []), skills:parse(r.skills_json, []) }, settings, avatar:avatarValue(avatar,admin), media: media.results.map((x: any) => ({ id:x.id, key:x.object_key, name:x.name, content_type:x.content_type, size:x.size, created_at:x.created_at, url:`/api/media/${encodeURIComponent(x.object_key)}` })) };
}

function owner(request: Request) {
  const id = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email');
  const local = new URL(request.url).hostname === '127.0.0.1' || new URL(request.url).hostname === 'localhost';
  return id || email || local ? { id: id ?? 'local-preview', email: email ?? 'owner@local.preview', name: request.headers.get('oai-authenticated-user-name') ?? undefined } : null;
}

async function body(request: Request) { return await request.json<Record<string, any>>(); }

async function saveWork(db: D1Database, data: Record<string, any>, id: string = uid()) {
  const existing = await db.prepare('SELECT * FROM works WHERE id=?').bind(id).first<Record<string, any>>();
  const v: Record<string, any> = { ...existing, ...data, id };
  v.slug = slugify(v.slug || v.title || 'work');
  const duplicate = await db.prepare('SELECT id FROM works WHERE slug=? AND id<>?').bind(v.slug,id).first();
  if (duplicate) throw new HttpError(409, '这个作品的网址别名已被使用，请换一个。');
  const showcaseType = v.showcase_type === 'video' ? 'video' : 'image';
  const showcaseLayout = ['wide','portrait','standard'].includes(v.showcase_layout) ? v.showcase_layout : 'standard';
  await db.prepare(`INSERT INTO works (id,slug,title,kicker,summary,problem,solution,result,stack_json,cover_url,showcase_url,showcase_type,showcase_layout,showcase_highlight,showcase_cta,status,featured,sort_order,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,kicker=excluded.kicker,summary=excluded.summary,problem=excluded.problem,solution=excluded.solution,result=excluded.result,stack_json=excluded.stack_json,cover_url=excluded.cover_url,showcase_url=excluded.showcase_url,showcase_type=excluded.showcase_type,showcase_layout=excluded.showcase_layout,showcase_highlight=excluded.showcase_highlight,showcase_cta=excluded.showcase_cta,status=excluded.status,featured=excluded.featured,sort_order=excluded.sort_order,updated_at=excluded.updated_at`).bind(id,v.slug,v.title||'未命名作品',v.kicker||'',v.summary||'',v.problem||'',v.solution||'',v.result||'',JSON.stringify(v.stack||parse(v.stack_json,[])),v.cover_url||'',v.showcase_url||'',showcaseType,showcaseLayout,v.showcase_highlight||'',v.showcase_cta||'查看项目',v.status==='published'?'published':'draft',v.featured?1:0,Number(v.sort_order)||0,now()).run();
  return work((await db.prepare('SELECT * FROM works WHERE id=?').bind(id).first()) as Record<string, unknown>);
}

async function savePost(db: D1Database, data: Record<string, any>, id: string = uid()) {
  const existing = await db.prepare('SELECT * FROM posts WHERE id=?').bind(id).first<Record<string, any>>();
  const v: Record<string, any> = { ...existing, ...data, id };
  v.slug = slugify(v.slug || v.title || 'post');
  const duplicate = await db.prepare('SELECT id FROM posts WHERE slug=? AND id<>?').bind(v.slug,id).first();
  if (duplicate) throw new HttpError(409, '这篇文章的网址别名已被使用，请换一个。');
  const contentType = ['article','video','gallery'].includes(v.content_type) ? v.content_type : 'article';
  await db.prepare(`INSERT INTO posts (id,slug,title,category,excerpt,body,cover_url,content_type,video_url,status,published_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,category=excluded.category,excerpt=excluded.excerpt,body=excluded.body,cover_url=excluded.cover_url,content_type=excluded.content_type,video_url=excluded.video_url,status=excluded.status,published_at=excluded.published_at,updated_at=excluded.updated_at`).bind(id,v.slug,v.title||'未命名文章',v.category||'未分类',v.excerpt||'',v.body||'',v.cover_url||'',contentType,v.video_url||'',v.status==='published'?'published':'draft',v.published_at || (v.status==='published'?now():''),now()).run();
  return post((await db.prepare('SELECT * FROM posts WHERE id=?').bind(id).first()) as Record<string, unknown>);
}

async function api(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/')) return null;
  if (url.pathname.startsWith('/api/media/')) {
    const key = decodeURIComponent(url.pathname.slice('/api/media/'.length));
    const object = await env.MEDIA.get(key);
    if (!object) return new Response('Not found', { status: 404 });
    const headers = new Headers(); object.writeHttpMetadata(headers); headers.set('etag', object.httpEtag); headers.set('cache-control','public, max-age=31536000, immutable');
    return new Response(object.body, { headers });
  }
  if (url.pathname === '/api/public/bootstrap' && request.method === 'GET') return json(await bootstrap(env.DB));
  if (url.pathname === '/api/public/avatar/chat' && request.method === 'POST') {
    const config = avatarValue(await env.DB.prepare('SELECT * FROM avatar_settings WHERE id=1').first<Record<string, unknown>>(), true) as AvatarChatConfig;
    if (!config.enabled) throw new HttpError(404, '数字分身当前未开放。');

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const current = Date.now();
    const attempt = avatarAttempts.get(ip) || { count: 0, resetAt: current + 60_000 };
    if (attempt.resetAt <= current) { attempt.count = 0; attempt.resetAt = current + 60_000; }
    attempt.count += 1;
    avatarAttempts.set(ip, attempt);
    if (attempt.count > 12) throw new HttpError(429, '提问太频繁了，请稍后再试。');

    const payload = await body(request);
    const rawMessages = Array.isArray(payload.messages) ? payload.messages : [];
    if (!rawMessages.length || rawMessages.length > 10) throw new HttpError(400, '请提供 1—10 条有效对话消息。');
    const messages = rawMessages.map(item => ({ role: item?.role === 'assistant' ? 'assistant' : 'user', content: String(item?.content || '').trim() }));
    const totalLength = messages.reduce((sum, item) => sum + item.content.length, 0);
    if (messages.some(item => !item.content || item.content.length > 2000) || totalLength > 8000) throw new HttpError(400, '单条消息最多 2000 字，对话总长度最多 8000 字。');
    const last = messages.at(-1);
    if (last?.role !== 'user') throw new HttpError(400, '最后一条消息必须是访客提问。');

    const preset = config.presets.find(item => item.question.trim() === last.content && item.answer.trim());
    if (preset) return json({ reply: preset.answer.trim(), source: 'preset' });

    const apiKey = String(env.DIGITAL_AVATAR_API_KEY || '').trim();
    if (!apiKey) throw new HttpError(503, '数字分身的 AI 服务尚未配置，请先在服务器环境变量中填写密钥。');
    const primary = await requestAvatarReply(env, config, messages);
    if (primary.ok) return json({ reply: primary.reply, source: 'ai' });
    console.warn(`[avatar-upstream] attempt=primary status=${primary.status} duration_ms=${primary.durationMs}`);

    if (primary.retryable) {
      const compatible = await requestAvatarReply(env, config, messages, true);
      if (compatible.ok) return json({ reply: compatible.reply, source: 'ai' });
      console.warn(`[avatar-upstream] attempt=compatible status=${compatible.status} duration_ms=${compatible.durationMs}`);
    }

    return json({ reply: fallbackAvatarReply(config), source: 'fallback' });
  }
  if (!url.pathname.startsWith('/api/admin/')) return new Response('Not found', { status: 404 });
  const user = owner(request); if (!user) return json({ error:'请使用站长账号登录后进入内容后台。' }, 401);
  if (url.pathname === '/api/admin/bootstrap' && request.method === 'GET') return json({ ...(await bootstrap(env.DB,true)), user });
  if (url.pathname === '/api/admin/works' && request.method === 'POST') return json(await saveWork(env.DB, await body(request)), 201);
  const wm = url.pathname.match(/^\/api\/admin\/works\/([^/]+)$/);
  if (wm && request.method === 'PUT') return json(await saveWork(env.DB, await body(request), wm[1]));
  if (wm && request.method === 'DELETE') { await env.DB.prepare('DELETE FROM works WHERE id=?').bind(wm[1]).run(); return json({ok:true}); }
  if (url.pathname === '/api/admin/posts' && request.method === 'POST') return json(await savePost(env.DB, await body(request)), 201);
  const pm = url.pathname.match(/^\/api\/admin\/posts\/([^/]+)$/);
  if (pm && request.method === 'PUT') return json(await savePost(env.DB, await body(request), pm[1]));
  if (pm && request.method === 'DELETE') { await env.DB.prepare('DELETE FROM posts WHERE id=?').bind(pm[1]).run(); return json({ok:true}); }
  if (url.pathname === '/api/admin/resume' && request.method === 'PUT') { const v=await body(request); await env.DB.prepare(`UPDATE resume SET profile=?,availability=?,location=?,email=?,experience_json=?,education_json=?,skills_json=?,updated_at=? WHERE id=1`).bind(v.profile||'',v.availability||'',v.location||'',v.email||'',JSON.stringify(v.experience||[]),JSON.stringify(v.education||[]),JSON.stringify(v.skills||[]),now()).run(); return json(v); }
  if (url.pathname === '/api/admin/settings' && request.method === 'PUT') { const v=await body(request); await env.DB.prepare(`UPDATE site_settings SET name=?,role=?,hero_prefix=?,hero_emphasis=?,hero_suffix=?,hero_description=?,hero_video_url=?,email=?,location=?,updated_at=? WHERE id=1`).bind(v.name||'',v.role||'',v.hero_prefix||'',v.hero_emphasis||'',v.hero_suffix||'',v.hero_description||'',v.hero_video_url||'',v.email||'',v.location||'',now()).run(); return json(v); }
  if (url.pathname === '/api/admin/avatar' && request.method === 'PUT') {
    const v = await body(request);
    const suggestions = Array.isArray(v.suggestions) ? v.suggestions.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 6) : [];
    const presets = Array.isArray(v.presets) ? v.presets.map((item: any) => ({ question:String(item?.question || '').trim(), answer:String(item?.answer || '').trim() })).filter((item: {question:string;answer:string}) => item.question && item.answer).slice(0, 20) : [];
    await env.DB.prepare('UPDATE avatar_settings SET enabled=?,name=?,subtitle=?,welcome=?,placeholder=?,suggestions_json=?,system_prompt=?,knowledge=?,presets_json=?,max_output_tokens=?,updated_at=? WHERE id=1').bind(
      v.enabled ? 1 : 0,
      String(v.name || '').slice(0, 60),
      String(v.subtitle || '').slice(0, 80),
      String(v.welcome || '').slice(0, 500),
      String(v.placeholder || '').slice(0, 120),
      JSON.stringify(suggestions),
      String(v.system_prompt || '').slice(0, 5000),
      String(v.knowledge || '').slice(0, 20000),
      JSON.stringify(presets),
      Math.max(100, Math.min(2000, Number(v.max_output_tokens) || 700)),
      now(),
    ).run();
    return json(avatarValue(await env.DB.prepare('SELECT * FROM avatar_settings WHERE id=1').first<Record<string, unknown>>(), true));
  }
  if (url.pathname === '/api/admin/upload' && request.method === 'POST') {
    const form=await request.formData(); const file=form.get('file'); if (!(file instanceof File)) return json({error:'请先选择一个文件。'},400);
    const allowed=['image/jpeg','image/png','image/webp','image/gif','video/mp4','application/pdf']; if(!allowed.includes(file.type)) return json({error:'仅支持 JPG、PNG、WebP、GIF、MP4 或 PDF。'},415); if(file.size>25*1024*1024) return json({error:'文件大小不能超过 25 MB。'},413);
    const key=`${new Date().toISOString().slice(0,10)}/${uid()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'-')}`; await env.MEDIA.put(key,file.stream(),{httpMetadata:{contentType:file.type}}); const id=uid(); await env.DB.prepare('INSERT INTO media (id,object_key,name,content_type,size) VALUES (?,?,?,?,?)').bind(id,key,file.name,file.type,file.size).run(); return json({id,key,name:file.name,url:`/api/media/${encodeURIComponent(key)}`,content_type:file.type,size:file.size},201);
  }
  const mm = url.pathname.match(/^\/api\/admin\/media\/([^/]+)$/);
  if (mm && request.method === 'DELETE') {
    const item = await env.DB.prepare('SELECT object_key FROM media WHERE id=?').bind(mm[1]).first<{ object_key: string }>();
    if (!item) return json({ error: '没有找到这个媒体文件。' }, 404);
    const mediaUrl = `/api/media/${encodeURIComponent(item.object_key)}`;
    const references = await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM posts WHERE cover_url=? OR video_url=? OR instr(body,?)>0) +
      (SELECT COUNT(*) FROM works WHERE cover_url=? OR showcase_url=?) +
      (SELECT COUNT(*) FROM site_settings WHERE hero_video_url=?) AS count`).bind(mediaUrl,mediaUrl,mediaUrl,mediaUrl,mediaUrl,mediaUrl).first<{ count:number }>();
    if (Number(references?.count)>0) throw new HttpError(409,'这个素材正在被文章、作品或首页使用，请先从内容中移除后再删除。');
    await env.MEDIA.delete(item.object_key);
    await env.DB.prepare('DELETE FROM media WHERE id=?').bind(mm[1]).run();
    return json({ ok: true });
  }
  return new Response('Not found', { status: 404 });
}

export default { async fetch(request: Request, env: Env) { try {
  await init(env.DB);
  const url=new URL(request.url);
  const response=await api(request,env,url);
  if(response) return response;
  if(request.method==='GET' && url.pathname!=='/' && !url.pathname.includes('.')) {
    const target=new URL('/',url); target.searchParams.set('page',url.pathname.slice(1));
    return Response.redirect(target.toString(),302);
  }
  const asset=await env.ASSETS.fetch(request);
  if(asset.status!==404 || request.method!=='GET' || !request.headers.get('accept')?.includes('text/html')) return asset;
  const indexUrl=new URL('/',url);
  return env.ASSETS.fetch(new Request(indexUrl.toString(),request));
} catch (error) { console.error(error); return json({error:error instanceof Error?error.message:'系统发生未知错误'},error instanceof HttpError?error.status:500); } } };
