import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';

const root = path.resolve(process.env.AURIA_TEST_ROOT || path.join(import.meta.dirname, '..'));
const base = 'http://127.0.0.1:3197';
const password = crypto.randomBytes(24).toString('hex'), salt = crypto.randomBytes(16).toString('hex');
const adminHash = salt + '$' + crypto.scryptSync(password, salt, 64).toString('hex');
const server = spawn(process.execPath, ['server/index.mjs'], {cwd: root, env: {...process.env, PORT: '3197', ADMIN_EMAIL: 'restore-test@example.com', ADMIN_PASSWORD_HASH: adminHash, AURIA_DATA_DIR: path.join(root, 'data'), DIGITAL_AVATAR_API_KEY: '', FEISHU_APP_ID: '', FEISHU_APP_SECRET: '', FEISHU_HOME_CHANNEL: ''}, stdio: ['ignore', 'pipe', 'pipe']});
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {try {if ((await fetch(base + '/api/public/bootstrap')).ok) {ready = true;break;}} catch {} await new Promise(r => setTimeout(r, 100));}
  assert(ready, '恢复服务启动失败');
  const data = await (await fetch(base + '/api/public/bootstrap')).json();
  if (process.env.AURIA_REFERENCE_URL) {
    const original = await (await fetch(process.env.AURIA_REFERENCE_URL + '/api/public/bootstrap')).json();
    assert.deepEqual(data, original);
    console.log('PASS restored public API exactly matches reference website');
  }
  assert.equal((await fetch(base + '/api/admin/bootstrap')).status, 401);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'portable/manifest.json')));
  for (const upload of manifest.uploads) {
    const r = await fetch(base + '/uploads/' + encodeURIComponent(upload.name));
    assert.equal(r.status, 200);
    assert.equal(crypto.createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'), upload.sha256);
  }
  const pdf = await fetch(base + data.resume.pdf_url);
  assert.equal(pdf.status, 200);assert.match(pdf.headers.get('content-type'), /pdf/);
  console.log('PASS every restored attachment served byte-for-byte; public resume PDF available');
  const require = createRequire(import.meta.url);
  const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/win10/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  browser = await chromium.launch({headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH} : {channel: 'chrome'})});
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  const errors = [];page.on('pageerror', e => errors.push(e.message));
  async function revealPage() {
    await page.locator('.xiaoyang-loader.is-visible').waitFor({state: 'hidden'});
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 500) {window.scrollTo({top: y, behavior: 'instant'});await new Promise(r => setTimeout(r, 150));}
      window.scrollTo({top: 0, behavior: 'instant'});
    });
    await page.waitForTimeout(1000);
  }
  for (const route of ['/', '/work', '/work/' + data.works[0].slug, '/open-source', '/writing', '/about', '/contact', '/missing']) {
    await page.goto(base + '/?page=' + encodeURIComponent(route));
    await page.locator('h1').first().waitFor();
    assert(await page.locator('body').innerText().then(x => x.length > 50));
  }
  await page.goto(base);
  await page.locator('#extension-pond').waitFor();
  await revealPage();
  await page.screenshot({path: path.join(root, 'artifacts/restored-home-desktop.png'), fullPage: true});
  await page.locator('#extension-pond').click();
  await page.locator('.pond-dialog iframe').waitFor();
  await page.screenshot({path: path.join(root, 'artifacts/restored-pond.png')});
  await page.getByRole('button', {name: '关闭池塘体验'}).click();
  await page.setViewportSize({width: 390, height: 844});await page.goto(base);
  await page.locator('#extension-pond').waitFor();
  await revealPage();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({path: path.join(root, 'artifacts/restored-home-mobile.png'), fullPage: true});
  assert.deepEqual(errors, []);
  console.log('PASS all public routes, restored pond dialog, desktop/mobile, no page errors');
} finally {
  await browser?.close();
  server.kill();
  if (server.exitCode === null) await new Promise(resolve => server.once('exit', resolve));
}
