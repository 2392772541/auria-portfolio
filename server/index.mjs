import compression from 'compression';
import express from 'express';
import {validateContent, defaults as contentDefaults} from '../shared/site-content.mjs';
import multer from 'multer';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataDir = path.resolve(process.env.AURIA_DATA_DIR || path.join(root, 'data'));
const uploadDir = path.join(dataDir, 'uploads');
const port = Number(process.env.PORT || 3000);
const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const adminPasswordHash = String(process.env.ADMIN_PASSWORD_HASH || '');
const sessionTtlMs = Math.max(15 * 60 * 1000, Number(process.env.SESSION_TTL_MS || 12 * 60 * 60 * 1000));
const isProduction = process.env.NODE_ENV === 'production';
const avatarApiKey = String(process.env.DIGITAL_AVATAR_API_KEY || '').trim();
const avatarBaseUrl = String(process.env.DIGITAL_AVATAR_BASE_URL || 'https://ai.nbcodex.com/v1').replace(/\/+$/, '');
const avatarModel = String(process.env.DIGITAL_AVATAR_MODEL || 'gpt-5.6-sol').trim();
const avatarReasoningEffort = String(process.env.DIGITAL_AVATAR_REASONING_EFFORT || 'medium').trim();
const avatarTimeoutMs = Math.min(45_000, Math.max(1_000, Number(process.env.DIGITAL_AVATAR_TIMEOUT_MS || 15_000)));
fs.mkdirSync(uploadDir, { recursive: true });

const db = new Database(path.join(dataDir, 'auria.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS works (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL, kicker TEXT DEFAULT '', summary TEXT DEFAULT '', problem TEXT DEFAULT '', solution TEXT DEFAULT '', result TEXT DEFAULT '', stack_json TEXT DEFAULT '[]', cover_url TEXT DEFAULT '', showcase_url TEXT DEFAULT '', showcase_type TEXT DEFAULT 'image', showcase_layout TEXT DEFAULT 'standard', showcase_highlight TEXT DEFAULT '', showcase_cta TEXT DEFAULT '查看项目', status TEXT DEFAULT 'draft', featured INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL, category TEXT DEFAULT 'Notes', excerpt TEXT DEFAULT '', body TEXT DEFAULT '', cover_url TEXT DEFAULT '', content_type TEXT DEFAULT 'article', video_url TEXT DEFAULT '', status TEXT DEFAULT 'draft', published_at TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS page_content (id INTEGER PRIMARY KEY CHECK(id=1), content_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS resume (id INTEGER PRIMARY KEY CHECK(id=1), profile TEXT DEFAULT '', availability TEXT DEFAULT '', location TEXT DEFAULT '', email TEXT DEFAULT '', experience_json TEXT DEFAULT '[]', education_json TEXT DEFAULT '[]', skills_json TEXT DEFAULT '[]', updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS site_settings (id INTEGER PRIMARY KEY CHECK(id=1), name TEXT DEFAULT '', role TEXT DEFAULT '', hero_prefix TEXT DEFAULT '', hero_emphasis TEXT DEFAULT '', hero_suffix TEXT DEFAULT '', hero_description TEXT DEFAULT '', hero_video_url TEXT DEFAULT '', email TEXT DEFAULT '', location TEXT DEFAULT '', updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, object_key TEXT UNIQUE NOT NULL, name TEXT NOT NULL, content_type TEXT NOT NULL, size INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS sessions (id_hash TEXT PRIMARY KEY, csrf_token TEXT NOT NULL, email TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, name TEXT NOT NULL, contact TEXT DEFAULT '', email TEXT DEFAULT '', message TEXT DEFAULT '', created_at TEXT NOT NULL, status TEXT DEFAULT 'new');
  CREATE TABLE IF NOT EXISTS avatar_settings (id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 1, name TEXT NOT NULL DEFAULT '小羊数字分身', subtitle TEXT NOT NULL DEFAULT 'AI PORTFOLIO GUIDE', welcome TEXT NOT NULL DEFAULT '你好，我是小羊的数字分身。你可以问我作品、能力或合作方式。', placeholder TEXT NOT NULL DEFAULT '问问我的作品、能力或合作方式…', suggestions_json TEXT NOT NULL DEFAULT '[]', system_prompt TEXT NOT NULL DEFAULT '', knowledge TEXT NOT NULL DEFAULT '', presets_json TEXT NOT NULL DEFAULT '[]', max_output_tokens INTEGER NOT NULL DEFAULT 700, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
const columns = db.prepare('PRAGMA table_info(posts)').all().map(row => row.name);
if (!columns.includes('content_type')) db.exec("ALTER TABLE posts ADD COLUMN content_type TEXT NOT NULL DEFAULT 'article'");
if (!columns.includes('video_url')) db.exec("ALTER TABLE posts ADD COLUMN video_url TEXT NOT NULL DEFAULT ''");
const workColumns = db.prepare('PRAGMA table_info(works)').all().map(row => row.name);
const needsShowcaseLayoutBackfill = !workColumns.includes('showcase_layout');
const workMigrations = [
  ['showcase_url', "TEXT NOT NULL DEFAULT ''"],
  ['showcase_type', "TEXT NOT NULL DEFAULT 'image'"],
  ['showcase_layout', "TEXT NOT NULL DEFAULT 'standard'"],
  ['showcase_highlight', "TEXT NOT NULL DEFAULT ''"],
  ['showcase_cta', "TEXT NOT NULL DEFAULT '查看项目'"],
];
for (const [name, definition] of workMigrations) {
  if (!workColumns.includes(name)) db.exec(`ALTER TABLE works ADD COLUMN ${name} ${definition}`);
}
if (needsShowcaseLayoutBackfill) {
  db.prepare(`UPDATE works SET showcase_layout='portrait' WHERE slug='agent-operations-system'`).run();
}
const resumeColumns = db.prepare('PRAGMA table_info(resume)').all().map(row => row.name);
const resumeMigrations = [
  ['pdf_enabled', "INTEGER NOT NULL DEFAULT 1"],
  ['pdf_kicker', "TEXT NOT NULL DEFAULT '完整简历'"],
  ['pdf_title', "TEXT NOT NULL DEFAULT 'RESUME'"],
  ['pdf_description', "TEXT NOT NULL DEFAULT '在下方窗口查看完整简历，也可以新窗口打开或下载 PDF。'"],
  ['pdf_url', "TEXT NOT NULL DEFAULT ''"],
  ['pdf_file_name', "TEXT NOT NULL DEFAULT 'XiaoYang-Resume.pdf'"],
  ['pdf_show_open', "INTEGER NOT NULL DEFAULT 1"],
  ['pdf_show_download', "INTEGER NOT NULL DEFAULT 1"],
];
for (const [name, definition] of resumeMigrations) {
  if (!resumeColumns.includes(name)) db.exec(`ALTER TABLE resume ADD COLUMN ${name} ${definition}`);
}

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const parse = (value, fallback) => { try { return JSON.parse(String(value)); } catch { return fallback; } };
const slugify = (value) => String(value || '').toLowerCase().trim().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/(^-|-$)/g, '') || `item-${Date.now()}`;
const json = (res, value, status = 200) => res.status(status).json(value);
const cleanFileName = (name) => path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '-');
const error = (status, message) => Object.assign(new Error(message), { status });
const hashToken = (value) => crypto.createHash('sha256').update(value).digest('hex');
const cookieOptions = `Path=/; HttpOnly; SameSite=Lax${isProduction ? '; Secure' : ''}`;
const cookieValue = (header, name) => header?.split(';').map(x => x.trim()).find(x => x.startsWith(`${name}=`))?.slice(name.length + 1) || '';
const passwordMatches = (password, encoded) => {
  const [salt, expected] = String(encoded).split('$');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
};
const loginAttempts = new Map();
const avatarAttempts = new Map();
async function requestAvatarReply(config, messages, compatible = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), compatible ? Math.min(avatarTimeoutMs, 10_000) : avatarTimeoutMs);
  const startedAt = Date.now();
  try {
    const body = {
      model: avatarModel,
      max_tokens: compatible ? Math.min(config.max_output_tokens, 400) : config.max_output_tokens,
      messages: [
        { role: 'system', content: `${config.system_prompt}\n\n可用个人资料：\n${config.knowledge}`.trim() },
        ...messages,
      ],
    };
    if (!compatible && avatarReasoningEffort) body.reasoning_effort = avatarReasoningEffort;
    const response = await fetch(`${avatarBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${avatarApiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        retryable: response.status === 400 || response.status === 408 || response.status === 409 || response.status === 425 || response.status === 429 || response.status >= 500,
        durationMs: Date.now() - startedAt,
      };
    }
    const payload = await response.json();
    const reply = String(payload?.choices?.[0]?.message?.content || '').trim();
    return reply
      ? { ok: true, reply, durationMs: Date.now() - startedAt }
      : { ok: false, status: 502, retryable: true, durationMs: Date.now() - startedAt };
  } catch (cause) {
    return {
      ok: false,
      status: cause?.name === 'AbortError' ? 504 : 502,
      retryable: true,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

function fallbackAvatarReply(config) {
  const suggestions = config.suggestions.slice(0, 3).filter(Boolean);
  const prompt = suggestions.length ? `你也可以先问：${suggestions.join('、')}。` : '你可以稍后再问我作品、能力或合作方式。';
  return `AI 服务刚刚有点忙，先由本地资料接待你。${config.welcome} ${prompt}`;
}
function adminConfigError() { return !adminEmail || !adminPasswordHash ? error(503, '管理后台尚未配置管理员凭据。') : null; }
function sessionFrom(req) {
  const token = cookieValue(req.headers.cookie || '', 'auria_session');
  if (!token) return null;
  const row = db.prepare('SELECT * FROM sessions WHERE id_hash=? AND expires_at>?').get(hashToken(token), Date.now());
  if (!row) return null;
  return { ...row, token };
}
function requireAdmin(req, res, next) {
  const configured = adminConfigError();
  if (configured) return next(configured);
  const session = sessionFrom(req);
  if (!session) return json(res, { error: '请先登录站长后台。' }, 401);
  req.adminSession = session;
  return next();
}
function requireCsrf(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  if (req.path === '/login') return next();
  if (!req.adminSession || req.headers['x-csrf-token'] !== req.adminSession.csrf_token) return json(res, { error: 'CSRF校验失败，请刷新后台后重试。' }, 403);
  return next();
}

function work(row) {
  return {
    ...row,
    stack: parse(row.stack_json, []),
    showcase_url: String(row.showcase_url || ''),
    showcase_type: row.showcase_type === 'video' ? 'video' : 'image',
    showcase_layout: ['wide','portrait','standard'].includes(row.showcase_layout) ? row.showcase_layout : 'standard',
    showcase_highlight: String(row.showcase_highlight || ''),
    showcase_cta: String(row.showcase_cta || '查看项目'),
    featured: Number(row.featured),
    sort_order: Number(row.sort_order),
    stack_json: undefined,
  };
}
function post(row) { return { ...row, content_type: row.content_type || 'article', video_url: row.video_url || '' }; }
function pageContent(){const row=db.prepare('SELECT content_json FROM page_content WHERE id=1').get();return row?validateContent(parse(row.content_json,{})):structuredClone(contentDefaults)}
function settings() { return db.prepare('SELECT * FROM site_settings WHERE id=1').get() || {}; }
function avatar(admin = false) {
  const row = db.prepare('SELECT * FROM avatar_settings WHERE id=1').get() || {};
  const shared = { enabled: Boolean(row.enabled ?? 1), name: row.name || '小羊数字分身', subtitle: row.subtitle || 'AI PORTFOLIO GUIDE', welcome: row.welcome || '你好，我是小羊的数字分身。你可以问我作品、能力或合作方式。', placeholder: row.placeholder || '问问我的作品、能力或合作方式…', suggestions: parse(row.suggestions_json, []) };
  return admin ? { ...shared, system_prompt: row.system_prompt || '', knowledge: row.knowledge || '', presets: parse(row.presets_json, []), max_output_tokens: Math.max(100, Math.min(2000, Number(row.max_output_tokens) || 700)) } : shared;
}
function resume() { const row = db.prepare('SELECT * FROM resume WHERE id=1').get() || {}; return { profile: row.profile || '', availability: row.availability || '', location: row.location || '', email: row.email || '', pdf_enabled: Boolean(row.pdf_enabled ?? 1), pdf_kicker: row.pdf_kicker || '完整简历', pdf_title: row.pdf_title || 'RESUME', pdf_description: row.pdf_description || '在下方窗口查看完整简历，也可以新窗口打开或下载 PDF。', pdf_url: row.pdf_url || '', pdf_file_name: row.pdf_file_name || 'XiaoYang-Resume.pdf', pdf_show_open: Boolean(row.pdf_show_open ?? 1), pdf_show_download: Boolean(row.pdf_show_download ?? 1), experience: parse(row.experience_json, []), education: parse(row.education_json, []), skills: parse(row.skills_json, []) }; }
function mediaRows() { return db.prepare('SELECT id, object_key AS key, name, content_type, size, created_at FROM media ORDER BY created_at DESC').all().map(item => ({ ...item, url: `/uploads/${encodeURIComponent(item.key)}` })); }
function contactRows() { return db.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all(); }
function bootstrap(admin = false) {
  const where = admin ? '' : "WHERE status='published'";
  const works=db.prepare(`SELECT * FROM works ${where} ORDER BY featured DESC, sort_order ASC`).all().map(work);
  const content=pageContent();
  if(!admin){const ids=new Set(works.map(w=>w.id)),slugs=new Set(works.map(w=>w.slug));content.projects=content.projects.filter(x=>x.workId?ids.has(x.workId):slugs.has(x.slug));content.hero.cards=content.hero.cards.filter(x=>!x.workId||ids.has(x.workId));content.extension.items=content.extension.items.filter(x=>x.enabled&&(!x.workId||ids.has(x.workId)));content.openSource.items=content.openSource.items.filter(x=>x.enabled)}
  return {
    works,
    posts: db.prepare(`SELECT * FROM posts ${where} ORDER BY published_at DESC, created_at DESC`).all().map(post),
    resume: resume(),
    settings: settings(),
    content,
    avatar: avatar(admin),
    ...(admin ? { media: mediaRows(), contacts: contactRows(), user: { id: 'server-owner', email: process.env.ADMIN_EMAIL || 'owner@server.local', name: '站长' } } : {}),
  };
}

db.prepare(`INSERT OR IGNORE INTO avatar_settings (id,enabled,name,subtitle,welcome,placeholder,suggestions_json,system_prompt,knowledge,presets_json,max_output_tokens) VALUES (1,1,?,?,?,?,?,?,?,?,?)`).run(
  '小羊数字分身',
  'AI PORTFOLIO GUIDE',
  '你好，我是小羊的数字分身。你可以问我作品、能力或合作方式。',
  '问问我的作品、能力或合作方式…',
  JSON.stringify(['你最擅长什么？','介绍一个代表作品','怎么和你合作？']),
  '你是小羊的个人网站数字分身。用第一人称、自然简洁的中文回答；只根据提供的个人资料回答，不编造经历、客户、数据或承诺。资料不足时明确说不知道，并引导访客通过网站联系。',
  '小羊专注视觉系统、品牌内容与 AI 工作流，擅长把模糊需求整理成可执行、可交付的产品和内容系统。',
  JSON.stringify([
    { question:'你最擅长什么？', answer:'我擅长把视觉系统、品牌内容和 AI 工作流结合起来，让内容生产更快、更准，也更有辨识度。' },
    { question:'介绍一个代表作品', answer:'你可以先看首页的精选作品。每个案例都包含问题、解决方案与最终结果，我也可以根据你关注的方向继续介绍。' },
    { question:'怎么和你合作？', answer:'可以通过网站底部的联系方式告诉我你的目标、时间和当前卡点。我会先判断最值得解决的部分，再给出清晰的合作路径。' }
  ]),
  700,
);

function ensureKolPilotProject() {
  db.prepare(`INSERT INTO works (id,slug,title,kicker,summary,problem,solution,result,stack_json,cover_url,showcase_url,showcase_type,showcase_layout,showcase_highlight,showcase_cta,status,featured,sort_order,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'published',1,-10,?)
    ON CONFLICT(slug) DO NOTHING`).run(
      uid(),'kolpilot-ai-creator-decision','KOLPilot｜AI 达人合作决策工作台','AI Product / Workflow',
      '面向中国中小品牌，将 Brief、候选发现、可解释匹配、Shortlist、建联审批和效果反馈放入同一 Campaign。',
      '达人合作的信息分散在 Brief、表格、聊天和多个平台中；AI 推荐又常只给黑箱分数，运营无法判断依据、时效和风险。',
      '以 Campaign 为上下文根节点，串联 AI Brief 结构化、受控候选发现、证据化匹配、Shortlist 人工决策、建联草稿审批、效果反馈和审计日志。预算、合作对象和外部发送必须人工批准。',
      '完成可点击 MVP、13 项端到端验收、完整人机边界设计，以及调研、指标、失败案例和正式数据接入方案。',
      JSON.stringify(['AI 产品设计','Human-in-the-loop','可解释推荐','React']),'/kolpilot-project-panorama.png','/kolpilot-project-panorama.png','image','wide','完成可点击 MVP、13 项端到端验收、完整人机边界设计。','查看项目',now());
}

function seed() {
  if (db.prepare('SELECT COUNT(*) AS count FROM works').get().count) return;
  const works = [
    ['agent-operations-system','智能体运营控制系统','AI 智能体 / 运营系统','一套让多智能体任务可见、可恢复、可安全交付的生产级控制系统。','团队可以演示智能体，却无法信任长时间运行的任务，也无法快速解释失败原因。','设计了包含任务续跑、结构化审批、证据日志与故障恢复的人机协作流程。','任务中断率降低 62%，每一次关键决策都能追溯。',['智能体系统','工作流设计','TypeScript'],'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1800&q=85'],
    ['knowledge-synthesis-engine','知识合成引擎','RAG / 知识系统','把分散资料转化为可直接支持决策的研究引擎。','研究信息散落在视频、文档、消息与收藏中，缺少可靠的整合层。','构建具备来源追踪、引用、置信度标记与人工审阅的采集和检索系统。','将研究初稿从数天缩短到数小时，同时保留完整证据链。',['RAG','信息架构','效果评估'],'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1800&q=85'],
    ['content-intelligence-workflow','内容智能生产系统','自动化 / 内容系统','把专家知识稳定转化为多平台内容的端到端工作流。','大量高价值观点长期沉睡在录音和零散笔记中，无法形成持续输出。','梳理完整编辑流程，自动完成提取与多平台重组，并将人工判断保留在关键审核节点。','内容发布效率提升 3 倍，同时保持统一表达与可复用知识库。',['流程自动化','内容系统','大模型编排'],'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1800&q=85'],
  ];
  const insertWork = db.prepare("INSERT INTO works (id,slug,title,kicker,summary,problem,solution,result,stack_json,cover_url,showcase_layout,status,featured,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,'published',?,?)");
  works.forEach((item, index) => insertWork.run(uid(), item[0], item[1], item[2], item[3], item[4], item[5], item[6], JSON.stringify(item[7]), item[8], index === 0 ? 'portrait' : 'standard', index < 2 ? 1 : 0, index));
  const insertPost = db.prepare("INSERT INTO posts (id,slug,title,category,excerpt,body,status,published_at) VALUES (?,?,?,?,?,?,'published',?)");
  const posts = [
    ['evidence-not-theatre','AI 产品需要证据，而不是表演','产品思考','一套判断 AI 功能是否真正有用的实战框架。','最有说服力的 AI 产品，不是动画最多、演示最炫的产品，而是能让不确定性被看见、在演示前定义成功、并在每次运行后保留证据的产品。\n\n先明确用户真正要做的决策，再设计最小但可观察的流程，帮助他把决策做得更好。'],
    ['reliable-agents','什么让 AI 智能体真正可靠？','智能体系统','可靠性从“顺利演示”结束的地方开始。','可靠的智能体需要清晰边界、记忆、状态，以及把控制权交还给人的明确机制。每个长任务都应该可以续跑，每个高风险动作都应该可以审阅，每次失败都要留下足够证据用于诊断和继续。'],
    ['rag-with-a-point-of-view','RAG 需要自己的判断力','知识系统','检索只是基础设施，有价值的合成才是产品决策。','有用的知识产品不只是找出相似文本。它需要选择可靠来源、揭示观点冲突、尊重信息时效，并根据读者下一步要做的决策组织答案。'],
  ];
  posts.forEach((item, index) => insertPost.run(uid(), ...item, new Date(Date.now() - index * 86400000).toISOString()));
  db.prepare('INSERT INTO resume (id,profile,availability,location,email,experience_json,education_json,skills_json) VALUES (1,?,?,?,?,?,?,?)').run('我擅长把模糊的 AI 需求转化为稳定可用的产品系统，连接产品判断、交互设计与实际落地。','期待 AI 产品、智能体系统与自动化方向的高价值机会。','中国 · 支持远程协作','hello@example.com',JSON.stringify([{period:'2024 — 至今',role:'独立 AI 产品构建者',company:'精选客户项目与自主产品',detail:'从需求发现到产品上线，设计并交付智能体工作流、研究系统和内容自动化产品。'}]),JSON.stringify([{period:'持续学习',title:'应用 AI、产品系统与人机交互',place:'独立研究与实践'}]),JSON.stringify(['AI 产品策略','智能体系统','RAG 与知识系统','流程自动化']));
  db.prepare('INSERT INTO site_settings (id,name,role,hero_prefix,hero_emphasis,hero_suffix,hero_description,hero_video_url,email,location) VALUES (1,?,?,?,?,?,?,?,?,?)').run('AI / PORTFOLIO','AI 产品构建者','把 AI 变成','真正可用的产品','而不只是一场演示。','专注智能体、自动化与知识系统，把模糊想法推进成可衡量、可交付、可持续迭代的产品。','', 'hello@example.com','中国 · 支持远程协作');
}
function ensureContentDepth() {
  const workCount = Number(db.prepare('SELECT COUNT(*) AS count FROM works').get().count);
  if (workCount < 8) {
    const extras = [
      ['visual-language-system','品牌视觉语言系统','品牌 / 视觉系统','把品牌策略转译成可持续使用的视觉规则。','团队在多平台发布时视觉表达不一致。','建立色彩、字体、构图和组件规范，并交付可复用模板。','跨渠道制作时间降低 45%。',['品牌策略','视觉系统','组件设计'],'https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=1800&q=85'],
      ['research-dashboard','研究决策仪表盘','研究 / 数据产品','让研究进度、证据和结论在一个界面里清晰可见。','研究资料多而分散，关键结论难以复核。','构建来源、置信度、冲突观点和行动建议的可视化工作台。','决策会议准备时间缩短 60%。',['研究设计','数据可视化','信息架构'],'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1800&q=85'],
      ['creator-workbench','创作者工作台','内容 / 工作流','为个人创作者搭建从灵感到发布的连续工作流。','灵感、素材和成稿分散在多个工具中。','整合采集、提纲、编辑、审核和发布状态，减少重复搬运。','每周稳定产出提升 2.5 倍。',['内容策略','自动化','产品原型'],'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1800&q=85'],
      ['service-blueprint','AI 服务蓝图','服务设计 / AI','把复杂 AI 服务拆成可理解、可交付的体验路径。','用户只看到模型能力，看不到服务边界和责任分工。','用服务蓝图标注触点、状态、人工介入和失败恢复。','上线后的支持请求减少 38%。',['服务设计','用户体验','AI 产品'],'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1800&q=85'],
      ['knowledge-ops-kit','知识运营工具箱','知识运营 / 系统','把团队知识沉淀为可检索、可维护的日常工具。','知识更新依赖个人记忆，内容容易过期。','设计采集、审核、版本和归档流程，让知识持续新鲜。','知识复用率提升 3 倍。',['知识管理','流程设计','RAG'],'https://images.unsplash.com/photo-1456324504439-367cee3b3c32?auto=format&fit=crop&w=1800&q=85']
    ];
    const insert = db.prepare("INSERT OR IGNORE INTO works (id,slug,title,kicker,summary,problem,solution,result,stack_json,cover_url,status,featured,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,'published',0,?)");
    extras.forEach((item, index) => insert.run(uid(), ...item.slice(0, 7), JSON.stringify(item[7]), item[8], workCount + index));
  }
  const postCount = Number(db.prepare('SELECT COUNT(*) AS count FROM posts').get().count);
  if (postCount < 6) {
    const extras = [
      ['designing-for-recovery','为失败设计恢复路径','产品方法','真正可靠的产品，要让失败可见、可解释、可继续。','把失败当作流程的一部分来设计，用户才知道下一步该做什么。'],
      ['the-interface-is-a-contract','界面是一份可执行的契约','交互设计','好的界面会明确状态、边界和责任，而不只是看起来漂亮。','当界面把系统状态说清楚，用户就能更快判断、修正和交接。'],
      ['small-systems-big-leverage','小系统也能产生大杠杆','工作流','持续复用的小工具，往往比一次性的复杂方案更有价值。','从一个真实重复动作开始，建立可观察、可迭代、可维护的最小系统。']
    ];
    const insert = db.prepare("INSERT OR IGNORE INTO posts (id,slug,title,category,excerpt,body,status,published_at) VALUES (?,?,?,?,?,?,'published',?)");
    extras.forEach((item,index)=>insert.run(uid(),...item,new Date(Date.now()-(postCount+index)*86400000).toISOString()));
  }
}
// Seed examples only for a new installation, never after an owner's edits or deletions.
if(!db.prepare('SELECT id FROM site_settings WHERE id=1').get()){seed();ensureContentDepth();ensureKolPilotProject()}
// Bind migrated display slots to stable work IDs once; later sorting cannot retarget them.
if(!db.prepare('SELECT id FROM page_content WHERE id=1').get()){
  const content=structuredClone(contentDefaults);
  const works=db.prepare("SELECT id,slug FROM works WHERE status='published' ORDER BY featured DESC,sort_order ASC").all();
  content.hero.cards.forEach((card,i)=>{card.workId=works[i]?.id||''});
  let index=0;content.extension.items.forEach(item=>{if(item.kind==='work'){item.workId=works[index++]?.id||''}});
  content.projects.forEach(item=>{item.workId=works.find(w=>w.slug===item.slug)?.id||''});
  db.prepare('INSERT INTO page_content(id,content_json) VALUES(1,?)').run(JSON.stringify(content));
}


const app = express();
app.disable('x-powered-by');
// Compress text responses; leave already-compressed media and streaming responses alone.
app.use(compression({threshold:1024}));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(express.json({ limit: '4mb' }));
// Public uploads include the resume PDF shown inside a same-origin iframe.
// Keep clickjacking protection on application pages, but allow these static
// assets to be embedded by removing the global DENY header for this route.
app.use('/uploads', (_req, res, next) => {
  res.removeHeader('X-Frame-Options');
  next();
}, express.static(uploadDir, { maxAge: '365d', immutable: true }));
const wechatDir = path.join(root, 'wechat');
app.use('/wechat', express.static(wechatDir, { extensions: ['html'], index: 'index.html' }));
const upload = multer({ storage: multer.diskStorage({ destination: uploadDir, filename: (_req, file, cb) => cb(null, `${Date.now()}-${uid()}-${cleanFileName(file.originalname)}`) }), limits: { fileSize: 25 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, ['image/jpeg','image/png','image/webp','image/gif','video/mp4','application/pdf'].includes(file.mimetype)) });

app.get('/api/public/bootstrap', (_req, res) => json(res, bootstrap()));
app.post('/api/public/avatar/chat', async (req, res, next) => {
  try {
    const config = avatar(true);
    if (!config.enabled) throw error(404, '数字分身当前未开放。');
    const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
    const current = Date.now();
    const attempt = avatarAttempts.get(ip) || { count: 0, resetAt: current + 60_000 };
    if (attempt.resetAt <= current) { attempt.count = 0; attempt.resetAt = current + 60_000; }
    attempt.count += 1;
    avatarAttempts.set(ip, attempt);
    if (attempt.count > 12) throw error(429, '提问太频繁了，请稍后再试。');

    const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    if (!rawMessages.length || rawMessages.length > 10) throw error(400, '请提供 1—10 条有效对话消息。');
    const messages = rawMessages.map(item => ({ role: item?.role === 'assistant' ? 'assistant' : 'user', content: String(item?.content || '').trim() }));
    if (messages.some(item => !item.content || item.content.length > 2000) || messages.reduce((sum,item)=>sum+item.content.length,0)>8000) throw error(400, '单条消息最多 2000 字，对话总长度最多 8000 字。');
    if (messages.at(-1)?.role !== 'user') throw error(400, '最后一条消息必须是访客提问。');
    const question = messages.at(-1).content;
    const preset = config.presets.find(item => String(item?.question || '').trim() === question && String(item?.answer || '').trim());
    if (preset) return json(res, { reply: String(preset.answer).trim(), source: 'preset' });
    if (!avatarApiKey) throw error(503, '数字分身的 AI 服务尚未配置，请先在服务器环境变量中填写密钥。');

    const primary = await requestAvatarReply(config, messages);
    if (primary.ok) return json(res, { reply: primary.reply, source: 'ai' });
    console.warn(`[avatar-upstream] attempt=primary status=${primary.status} duration_ms=${primary.durationMs}`);

    if (primary.retryable) {
      const compatible = await requestAvatarReply(config, messages, true);
      if (compatible.ok) return json(res, { reply: compatible.reply, source: 'ai' });
      console.warn(`[avatar-upstream] attempt=compatible status=${compatible.status} duration_ms=${compatible.durationMs}`);
    }

    return json(res, { reply: fallbackAvatarReply(config), source: 'fallback' });
  } catch (e) {
    return next(e);
  }
});
app.post('/api/public/contact', async (req, res, next) => {
  try {
    const name=String(req.body?.name||'').trim(); const contact=String(req.body?.contact||'').trim(); const email=String(req.body?.email||'').trim(); const message=String(req.body?.message||'').trim();
    if(!name || (!contact && !email) || !message) return json(res,{error:'请填写姓名、联系方式或邮箱，以及需求内容。'},400);
    const id=uid(); const created=now(); db.prepare('INSERT INTO contacts (id,name,contact,email,message,created_at) VALUES (?,?,?,?,?,?)').run(id,name,contact,email,message,created);
    let feishu='not_configured';
    const {FEISHU_APP_ID:appId,FEISHU_APP_SECRET:appSecret,FEISHU_HOME_CHANNEL:receiveId}=process.env;
    if(appId&&appSecret&&receiveId){
      try {
        const tokenResponse=await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({app_id:appId,app_secret:appSecret})});
        const tokenData=await tokenResponse.json(); const token=tokenData.tenant_access_token;
        if(!token) throw new Error('token_missing');
        const text=`网站新联系：\\n姓名：${name}\\n联系方式：${contact||'未填写'}\\n邮箱：${email||'未填写'}\\n需求：${message}\\n提交时间：${created}`;
        const sendResponse=await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id',{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({receive_id:receiveId,msg_type:'text',content:JSON.stringify({text})})});
        if(!sendResponse.ok) throw new Error('send_failed');
        feishu='sent';
      } catch { feishu='failed'; }
    }
    return json(res,{ok:true,id,feishu},201);
  } catch(e){ return next(e); }
});
app.post('/api/auth/login', (req, res, next) => {
  try {
    const configured = adminConfigError();
    if (configured) return next(configured);
    const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
    const attempt = loginAttempts.get(ip) || { count: 0, until: 0 };
    if (attempt.until > Date.now()) return json(res, { error: '登录尝试过于频繁，请稍后再试。' }, 429);
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const valid = email === adminEmail && passwordMatches(password, adminPasswordHash);
    if (!valid) {
      attempt.count += 1;
      if (attempt.count >= 5) { attempt.count = 0; attempt.until = Date.now() + 5 * 60 * 1000; }
      loginAttempts.set(ip, attempt);
      return json(res, { error: '邮箱或密码不正确。' }, 401);
    }
    loginAttempts.delete(ip);
    const token = crypto.randomBytes(32).toString('base64url');
    const csrf = crypto.randomBytes(32).toString('base64url');
    db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
    db.prepare('INSERT INTO sessions (id_hash,csrf_token,email,expires_at,created_at) VALUES (?,?,?,?,?)').run(hashToken(token), csrf, adminEmail, Date.now() + sessionTtlMs, now());
    res.setHeader('Set-Cookie', `auria_session=${token}; ${cookieOptions}; Max-Age=${Math.floor(sessionTtlMs / 1000)}`);
    return json(res, { user: { id: 'server-owner', email: adminEmail, name: '站长' }, csrfToken: csrf });
  } catch (e) { return next(e); }
});
app.post('/api/auth/logout', (req, res) => {
  const token = cookieValue(req.headers.cookie || '', 'auria_session');
  if (token) db.prepare('DELETE FROM sessions WHERE id_hash=?').run(hashToken(token));
  res.setHeader('Set-Cookie', `auria_session=; ${cookieOptions}; Max-Age=0`);
  return json(res, { ok: true });
});
app.get('/api/auth/me', requireAdmin, (req, res) => json(res, { user: { id: 'server-owner', email: req.adminSession.email, name: '站长' }, csrfToken: req.adminSession.csrf_token }));
app.use('/api/admin', requireAdmin, requireCsrf);
app.get('/api/admin/bootstrap', (_req, res) => json(res, bootstrap(true)));

function saveWork(data, id = uid()) {
  const old = db.prepare('SELECT * FROM works WHERE id=?').get(id) || {};
  const value = { ...old, ...data, id, slug: slugify(data.slug || old.slug || data.title || old.title || 'work') };
  const duplicate = db.prepare('SELECT id FROM works WHERE slug=? AND id<>?').get(value.slug, id);
  if (duplicate) throw error(409, '这个作品的网址别名已被使用，请换一个。');
  const showcaseType = value.showcase_type === 'video' ? 'video' : 'image';
  const showcaseLayout = ['wide','portrait','standard'].includes(value.showcase_layout) ? value.showcase_layout : 'standard';
  db.prepare(`INSERT INTO works (id,slug,title,kicker,summary,problem,solution,result,stack_json,cover_url,showcase_url,showcase_type,showcase_layout,showcase_highlight,showcase_cta,status,featured,sort_order,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,kicker=excluded.kicker,summary=excluded.summary,problem=excluded.problem,solution=excluded.solution,result=excluded.result,stack_json=excluded.stack_json,cover_url=excluded.cover_url,showcase_url=excluded.showcase_url,showcase_type=excluded.showcase_type,showcase_layout=excluded.showcase_layout,showcase_highlight=excluded.showcase_highlight,showcase_cta=excluded.showcase_cta,status=excluded.status,featured=excluded.featured,sort_order=excluded.sort_order,updated_at=excluded.updated_at`).run(id,value.slug,value.title||'未命名作品',value.kicker||'',value.summary||'',value.problem||'',value.solution||'',value.result||'',JSON.stringify(value.stack || parse(value.stack_json, [])),value.cover_url||'',value.showcase_url||'',showcaseType,showcaseLayout,value.showcase_highlight||'',value.showcase_cta||'查看项目',value.status==='published'?'published':'draft',value.featured?1:0,Number(value.sort_order)||0,now());
  return work(db.prepare('SELECT * FROM works WHERE id=?').get(id));
}
function savePost(data, id = uid()) {
  const old = db.prepare('SELECT * FROM posts WHERE id=?').get(id) || {};
  const value = { ...old, ...data, id, slug: slugify(data.slug || old.slug || data.title || old.title || 'post') };
  if (db.prepare('SELECT id FROM posts WHERE slug=? AND id<>?').get(value.slug, id)) throw error(409, '这篇文章的网址别名已被使用，请换一个。');
  const type = ['article','video','gallery'].includes(value.content_type) ? value.content_type : 'article';
  db.prepare(`INSERT INTO posts (id,slug,title,category,excerpt,body,cover_url,content_type,video_url,status,published_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,category=excluded.category,excerpt=excluded.excerpt,body=excluded.body,cover_url=excluded.cover_url,content_type=excluded.content_type,video_url=excluded.video_url,status=excluded.status,published_at=excluded.published_at,updated_at=excluded.updated_at`).run(id,value.slug,value.title||'未命名文章',value.category||'未分类',value.excerpt||'',value.body||'',value.cover_url||'',type,value.video_url||'',value.status==='published'?'published':'draft',value.published_at || (value.status==='published'?now():''),now());
  return post(db.prepare('SELECT * FROM posts WHERE id=?').get(id));
}

app.post('/api/admin/works', (req, res, next) => { try { json(res, saveWork(req.body), 201); } catch (e) { next(e); } });
app.put('/api/admin/works/:id', (req, res, next) => { try { json(res, saveWork(req.body, req.params.id)); } catch (e) { next(e); } });
app.delete('/api/admin/works/:id', (req, res) => { db.transaction(()=>{const content=pageContent();content.hero.cards=content.hero.cards.filter(x=>x.workId!==req.params.id);content.extension.items=content.extension.items.filter(x=>x.workId!==req.params.id);content.projects=content.projects.filter(x=>x.workId!==req.params.id);db.prepare('UPDATE page_content SET content_json=?,updated_at=? WHERE id=1').run(JSON.stringify(content),now());db.prepare('DELETE FROM works WHERE id=?').run(req.params.id)})();json(res,{ok:true}); });
app.post('/api/admin/posts', (req, res, next) => { try { json(res, savePost(req.body), 201); } catch (e) { next(e); } });
app.put('/api/admin/posts/:id', (req, res, next) => { try { json(res, savePost(req.body, req.params.id)); } catch (e) { next(e); } });
app.delete('/api/admin/posts/:id', (req, res) => { db.prepare('DELETE FROM posts WHERE id=?').run(req.params.id); json(res, { ok: true }); });
app.put('/api/admin/resume', (req, res) => { const v=req.body; db.prepare('UPDATE resume SET profile=?,availability=?,location=?,email=?,pdf_enabled=?,pdf_kicker=?,pdf_title=?,pdf_description=?,pdf_url=?,pdf_file_name=?,pdf_show_open=?,pdf_show_download=?,experience_json=?,education_json=?,skills_json=?,updated_at=? WHERE id=1').run(v.profile||'',v.availability||'',v.location||'',v.email||'',v.pdf_enabled?1:0,v.pdf_kicker||'',v.pdf_title||'',v.pdf_description||'',v.pdf_url||'',v.pdf_file_name||'',v.pdf_show_open?1:0,v.pdf_show_download?1:0,JSON.stringify(v.experience||[]),JSON.stringify(v.education||[]),JSON.stringify(v.skills||[]),now()); json(res,resume()); });
app.put('/api/admin/content', (req,res,next)=>{try{const value=validateContent(req.body);const ids=new Set(db.prepare('SELECT id FROM works').all().map(w=>w.id));for(const item of [...value.hero.cards,...value.extension.items,...value.projects])if(item.workId&&!ids.has(item.workId))throw error(400,'关联作品已删除，请重新选择或移除对应条目');db.prepare('INSERT INTO page_content(id,content_json,updated_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET content_json=excluded.content_json,updated_at=excluded.updated_at').run(JSON.stringify(value),now());json(res,value)}catch(e){next(e)}});
app.put('/api/admin/settings', (req, res) => { const v=req.body; db.prepare('UPDATE site_settings SET name=?,role=?,hero_prefix=?,hero_emphasis=?,hero_suffix=?,hero_description=?,hero_video_url=?,email=?,location=?,updated_at=? WHERE id=1').run(v.name||'',v.role||'',v.hero_prefix||'',v.hero_emphasis||'',v.hero_suffix||'',v.hero_description||'',v.hero_video_url||'',v.email||'',v.location||'',now()); json(res,v); });
app.put('/api/admin/avatar', (req, res, next) => { try {
  const v=req.body||{};
  const suggestions=Array.isArray(v.suggestions)?v.suggestions.map(x=>String(x).trim()).filter(Boolean).slice(0,6):[];
  const presets=Array.isArray(v.presets)?v.presets.map(x=>({question:String(x?.question||'').trim(),answer:String(x?.answer||'').trim()})).filter(x=>x.question&&x.answer).slice(0,20):[];
  db.prepare('UPDATE avatar_settings SET enabled=?,name=?,subtitle=?,welcome=?,placeholder=?,suggestions_json=?,system_prompt=?,knowledge=?,presets_json=?,max_output_tokens=?,updated_at=? WHERE id=1').run(v.enabled?1:0,String(v.name||'').slice(0,60),String(v.subtitle||'').slice(0,80),String(v.welcome||'').slice(0,500),String(v.placeholder||'').slice(0,120),JSON.stringify(suggestions),String(v.system_prompt||'').slice(0,5000),String(v.knowledge||'').slice(0,20000),JSON.stringify(presets),Math.max(100,Math.min(2000,Number(v.max_output_tokens)||700)),now());
  json(res,avatar(true));
} catch(e){ next(e); } });
app.post('/api/admin/upload', upload.single('file'), (req, res, next) => { try { if (!req.file) throw error(400, '请上传 JPG、PNG、WebP、GIF、MP4 或 PDF 文件。'); const key=path.basename(req.file.filename); db.prepare('INSERT INTO media (id,object_key,name,content_type,size) VALUES (?,?,?,?,?)').run(uid(),key,req.file.originalname,req.file.mimetype,req.file.size); json(res,{id:db.prepare('SELECT id FROM media WHERE object_key=?').get(key).id,key,name:req.file.originalname,url:`/uploads/${encodeURIComponent(key)}`,content_type:req.file.mimetype,size:req.file.size},201); } catch(e) { if(req.file) fs.rmSync(req.file.path,{force:true}); next(e); } });
app.delete('/api/admin/media/:id', (req, res, next) => { try { const item=db.prepare('SELECT * FROM media WHERE id=?').get(req.params.id); if(!item) throw error(404,'没有找到这个媒体文件。'); const mediaUrl=`/uploads/${encodeURIComponent(item.object_key)}`; const refs=db.prepare(`SELECT (SELECT COUNT(*) FROM posts WHERE cover_url=? OR video_url=? OR instr(body,?)>0)+(SELECT COUNT(*) FROM works WHERE cover_url=? OR showcase_url=?)+(SELECT COUNT(*) FROM site_settings WHERE hero_video_url=?)+(SELECT COUNT(*) FROM resume WHERE pdf_url=?) AS count`).get(mediaUrl,mediaUrl,mediaUrl,mediaUrl,mediaUrl,mediaUrl,mediaUrl); if(Number(refs.count)>0 || JSON.stringify(pageContent()).includes(mediaUrl)) throw error(409,'这个素材正在被文章、作品、简历或首页使用，请先从内容中移除后再删除。'); fs.rmSync(path.join(uploadDir,item.object_key),{force:true}); db.prepare('DELETE FROM media WHERE id=?').run(req.params.id); json(res,{ok:true}); } catch(e) { next(e); } });
app.delete('/api/admin/contacts/:id', (req, res, next) => { try { const result=db.prepare('DELETE FROM contacts WHERE id=?').run(req.params.id); if(!result.changes) throw error(404,'没有找到这条联系记录。'); json(res,{ok:true}); } catch(e){ next(e); } });

const clientDir = path.join(root, 'dist', 'client');
app.use('/pond', (req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
  next();
}, express.static(path.join(clientDir, 'pond')));
app.use('/assets', express.static(path.join(clientDir,'assets'), {maxAge:'365d',immutable:true}));
app.use(express.static(clientDir, { index: 'index.html', maxAge:0 }));
app.use((req, res, next) => req.path.startsWith('/api/') ? next() : res.sendFile(path.join(clientDir, 'index.html')));
app.use((err, _req, res, _next) => { const status=err.status || (err instanceof multer.MulterError ? 413 : 500); res.status(status).json({ error: err.message || '系统发生未知错误' }); });

app.listen(port, '127.0.0.1', () => console.log(`Auria server listening on http://127.0.0.1:${port}`));
