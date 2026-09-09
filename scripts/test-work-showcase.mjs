import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const mainSource = fs.readFileSync(path.join(root, 'src/main.tsx'), 'utf8');
const portfolioSource = fs.readFileSync(path.join(root, 'src/pages/PortfolioPages.tsx'), 'utf8');
const showcaseDataSource = fs.readFileSync(path.join(root, 'src/data/showcaseProjects.ts'), 'utf8');
const showcaseCss = fs.readFileSync(path.join(root, 'src/portfolio-showcase.css'), 'utf8');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auria-work-showcase-test-'));
const password = 'work-showcase-test-password';
const email = 'work-showcase-test@example.com';
const salt = crypto.randomBytes(16).toString('hex');
const passwordHash = `${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

function assertReferenceStructure() {
  const navigation = ['个人简介', 'Demo展示', '能力矩阵', '其他亮点'];
  const sectionIds = ['showcase-about', 'showcase-demos', 'showcase-capabilities', 'showcase-highlights'];
  navigation.forEach(label => assert.ok(portfolioSource.includes(`'${label}'`), `navigation should retain ${label}`));
  sectionIds.forEach(id => assert.ok(portfolioSource.includes(`id="${id}"`), `section should retain ${id}`));

  assert.ok(portfolioSource.includes('works.map'), 'all published work projects should render in the project selector');
  assert.ok(portfolioSource.includes('className="jade-project-browser"'), 'Demo showcase should use a compact master-detail browser');
  assert.ok(portfolioSource.includes('aria-label="选择 Demo 项目"'), 'project selector should have an accessible label');
  assert.ok(portfolioSource.includes('aria-selected={selectedIndex===index}'), 'project selector should expose its active item');
  assert.ok(portfolioSource.includes('key={selectedWork.id}'), 'the selected project panel should remount for its transition');
  assert.ok(portfolioSource.includes('id={`showcase-project-${work.slug}`}'), 'every project should expose a stable showcase anchor');
  assert.ok(portfolioSource.includes('return <WorkPage data={data} focusSlug={work.slug}/>'), 'legacy detail routes should reuse the complete showcase instead of the old case-study layout');
  assert.ok(portfolioSource.includes("getElementById('showcase-demos')?.scrollIntoView"), 'legacy detail routes should focus the compact Demo browser');
  assert.ok(portfolioSource.includes("work.summary||'项目定位与目标待补充'"), 'first project description slot should be retained');
  assert.ok(portfolioSource.includes("work.solution||'项目实现方式与完整工作流待补充'"), 'second project description slot should be retained');
  assert.ok(portfolioSource.includes('ShowcaseMetrics metrics={metrics}'), 'three-metric area should be retained');
  assert.ok(portfolioSource.includes('ShowcaseProjectMedia work={work}'), 'video and chapter area should be retained');
  assert.ok(portfolioSource.includes('demo链接：'), 'demo link row should match the reference structure');
  assert.ok(portfolioSource.includes('Demo 地址待补充'), 'missing demo links should retain an explicit placeholder instead of inventing an internal link');
  assert.ok(portfolioSource.includes('体验码：'), 'access-code row should match the reference structure');
  assert.ok(portfolioSource.includes('navigator.clipboard.writeText'), 'access-code copy interaction should be retained');
  assert.ok(portfolioSource.includes("target=\"_blank\" rel=\"noreferrer\""), 'demo links should open like the reference');
  assert.ok(portfolioSource.includes("scrollTo('showcase-about')"), 'brand should scroll back to the profile section');
  assert.ok(portfolioSource.includes("document.querySelectorAll('.jade-reveal')"), 'scroll reveal interaction should be retained');
  assert.ok(showcaseCss.includes('@keyframes jade-reveal-in'), 'reference reveal animation should have matching CSS behavior');
  assert.ok(showcaseCss.includes('@keyframes jade-project-swap-in'), 'selected project changes should have a restrained transition');
  assert.ok(showcaseCss.includes('.jade-project-selector{display:flex;overflow-x:auto'), 'mobile should convert the left selector into horizontal tabs');
  assert.ok(showcaseCss.includes('scrollbar-width:none'), 'mobile tabs should hide the native scrollbar without disabling horizontal scrolling');
  assert.ok(showcaseCss.includes('.jade-project-selector::-webkit-scrollbar{display:none'), 'WebKit browsers should not expose the native horizontal scrollbar');
  assert.ok(portfolioSource.includes("activeButton.scrollIntoView"), 'the active tab should smoothly stay in view after selection');

  assert.equal((showcaseDataSource.match(/label: '章节 \d\d 待补'/g) || []).length, 5, 'missing videos should retain five chapter placeholders');
  assert.equal((showcaseDataSource.match(/label: '.*指标', placeholder: true/g) || []).length, 3, 'missing results should retain three metric placeholders');
  assert.equal((showcaseDataSource.match(/\{ icon: '/g) || []).length, 8, 'capability matrix should retain eight cells');
  assert.equal((showcaseDataSource.match(/tail: .*placeholder:/g) || []).length, 5, 'highlights should retain five rows');
  assert.ok(portfolioSource.includes('export function OpenSourcePage'), 'open-source projects should remain on a separate page');
  assert.ok(portfolioSource.includes('export function ShowcaseContentSections'), 'the three showcase sections should be exported as one shared component');
  assert.ok(portfolioSource.includes('<ShowcaseContentSections data={data} initialSlug={focusSlug}/>'), 'the work page should render the shared showcase component with deep-link selection');
  assert.ok(appSource.includes('<ShowcaseContentSections data={data}/>'), 'the homepage should render the same shared showcase component');
  assert.ok(appSource.includes('id="selected" className="home-showcase-shell jade-showcase-page"'), 'the replacement should retain the homepage selected anchor and Jade styling scope');
  assert.ok(!appSource.includes('function SelectedWorkShowcase'), 'the replaced Selected Works implementation should be removed');
  assert.ok(!appSource.includes('<SelectedWorkShowcase'), 'the homepage should no longer render the legacy Selected Works block');
  assert.ok(appSource.includes('const workShowcaseHref='), 'home-page work links should target the shared showcase module');
  assert.ok(!appSource.includes('page=work%2F${work.slug}'), 'active home-page work links should no longer target the old case-study route');
  assert.ok(mainSource.includes("routePath.startsWith('/work/')\n  ? pageTitles['/work']"), 'legacy work URLs should use the selected-work title because they now render the shared showcase');
}

assertReferenceStructure();

async function freePort() {
  const socket = net.createServer();
  await new Promise((resolve, reject) => socket.listen(0, '127.0.0.1', resolve).once('error', reject));
  const address = socket.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise(resolve => socket.close(resolve));
  return port;
}

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server/index.mjs'], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(port),
    AURIA_DATA_DIR: dataDir,
    ADMIN_EMAIL: email,
    ADMIN_PASSWORD_HASH: passwordHash,
    DIGITAL_AVATAR_API_KEY: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stderr = '';
server.stderr.on('data', chunk => { stderr += chunk; });

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/public/bootstrap`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`测试服务器启动失败：${stderr}`);
}

async function request(url, options = {}) {
  const response = await fetch(`${base}${url}`, options);
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  return { response, payload };
}

try {
  await waitForServer();

  const seeded = await request('/api/public/bootstrap');
  assert.equal(seeded.response.status, 200);
  const kolPilot = seeded.payload.works.find(work => work.slug === 'kolpilot-ai-creator-decision');
  assert.ok(kolPilot, 'KOLPilot seed should exist');
  assert.equal(kolPilot.showcase_layout, 'wide');
  assert.equal(kolPilot.showcase_type, 'image');
  assert.equal(kolPilot.showcase_url, '/kolpilot-project-panorama.png');

  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.response.status, 200);
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  const csrf = login.payload.csrfToken;
  assert.ok(cookie && csrf, 'login should return session cookie and CSRF token');

  const authHeaders = { cookie, 'x-csrf-token': csrf };
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'showcase-test.png');
  const upload = await request('/api/admin/upload', { method: 'POST', headers: authHeaders, body: form });
  assert.equal(upload.response.status, 201);
  assert.equal(upload.payload.content_type, 'image/png');

  const create = await request('/api/admin/works', {
    method: 'POST',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      slug: 'showcase-regression-test',
      title: '展示模块回归测试',
      kicker: 'Integration Test',
      summary: '验证首页展示字段完整往返。',
      problem: '旧字段无法覆盖新的展示模块。',
      solution: '保存媒体、版式、成果条和行动文字。',
      result: '后台与前台数据一致。',
      stack: ['Node.js', 'SQLite'],
      cover_url: '',
      showcase_url: upload.payload.url,
      showcase_type: 'image',
      showcase_layout: 'portrait',
      showcase_highlight: '展示字段已通过端到端验证。',
      showcase_cta: '查看验证',
      status: 'published',
      featured: 1,
      sort_order: 7,
    }),
  });
  assert.equal(create.response.status, 201);
  assert.equal(create.payload.showcase_url, upload.payload.url);
  assert.equal(create.payload.showcase_layout, 'portrait');
  assert.equal(create.payload.showcase_highlight, '展示字段已通过端到端验证。');
  assert.equal(create.payload.showcase_cta, '查看验证');

  const publicRoundTrip = await request('/api/public/bootstrap');
  const publicWork = publicRoundTrip.payload.works.find(work => work.id === create.payload.id);
  assert.ok(publicWork, 'published work should appear in public bootstrap');
  assert.equal(publicWork.showcase_url, upload.payload.url);
  assert.equal(publicWork.showcase_type, 'image');
  assert.equal(publicWork.showcase_layout, 'portrait');

  const adminRoundTrip = await request('/api/admin/bootstrap', { headers: { cookie } });
  const adminWork = adminRoundTrip.payload.works.find(work => work.id === create.payload.id);
  assert.ok(adminWork, 'work should appear in admin bootstrap');
  assert.equal(adminWork.showcase_cta, '查看验证');

  const protectedDelete = await request(`/api/admin/media/${upload.payload.id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  assert.equal(protectedDelete.response.status, 409, 'referenced showcase media should be protected');

  const clearReference = await request(`/api/admin/works/${create.payload.id}`, {
    method: 'PUT',
    headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ showcase_url: '' }),
  });
  assert.equal(clearReference.response.status, 200);
  assert.equal(clearReference.payload.showcase_url, '');

  const deleteMedia = await request(`/api/admin/media/${upload.payload.id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  assert.equal(deleteMedia.response.status, 200);

  const deleteWork = await request(`/api/admin/works/${create.payload.id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  assert.equal(deleteWork.response.status, 200);

  console.log(JSON.stringify({
    reference_structure: 'passed',
    missing_content_placeholders: 'passed',
    showcase_seed: 'passed',
    media_upload: 'passed',
    work_showcase_roundtrip: 'passed',
    public_and_admin_bootstrap: 'passed',
    referenced_media_delete: 'blocked_409',
    cleanup: 'passed',
  }, null, 2));
} finally {
  server.kill('SIGTERM');
  if (server.exitCode === null) {
    await Promise.race([
      new Promise(resolve => server.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 2000)),
    ]);
  }
  fs.rmSync(dataDir, { recursive: true, force: true });
}
