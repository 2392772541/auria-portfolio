import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auria-avatar-test-'));
const port = 3197;
const password = 'avatar-test-password';
const salt = crypto.randomBytes(16).toString('hex');
const passwordHash = `${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
const base = `http://127.0.0.1:${port}`;

const server = spawn(process.execPath, ['server/index.mjs'], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(port),
    AURIA_DATA_DIR: dataDir,
    ADMIN_EMAIL: 'avatar-test@example.com',
    ADMIN_PASSWORD_HASH: passwordHash,
    DIGITAL_AVATAR_API_KEY: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stderr = '';
server.stderr.on('data', chunk => { stderr += chunk; });

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
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
  const payload = await response.json();
  return { response, payload };
}

try {
  await waitForServer();

  const publicBootstrap = await request('/api/public/bootstrap');
  assert.equal(publicBootstrap.response.status, 200);
  assert.equal(publicBootstrap.payload.avatar.enabled, true);
  assert.equal('system_prompt' in publicBootstrap.payload.avatar, false);
  assert.equal('knowledge' in publicBootstrap.payload.avatar, false);
  assert.equal('presets' in publicBootstrap.payload.avatar, false);

  const preset = await request('/api/public/avatar/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: '你最擅长什么？' }] }),
  });
  assert.equal(preset.response.status, 200);
  assert.equal(preset.payload.source, 'preset');
  assert.ok(preset.payload.reply.length > 0);

  const empty = await request('/api/public/avatar/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [] }),
  });
  assert.equal(empty.response.status, 400);

  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'avatar-test@example.com', password }),
  });
  assert.equal(login.response.status, 200);
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  assert.ok(login.payload.csrfToken);

  const adminBootstrap = await request('/api/admin/bootstrap', { headers: { cookie } });
  assert.equal(adminBootstrap.response.status, 200);
  assert.ok(adminBootstrap.payload.avatar.system_prompt);
  assert.ok(Array.isArray(adminBootstrap.payload.avatar.presets));

  const disabledConfig = { ...adminBootstrap.payload.avatar, enabled: false };
  const disable = await request('/api/admin/avatar', {
    method: 'PUT',
    headers: { cookie, 'x-csrf-token': login.payload.csrfToken, 'content-type': 'application/json' },
    body: JSON.stringify(disabledConfig),
  });
  assert.equal(disable.response.status, 200);
  assert.equal(disable.payload.enabled, false);

  const disabledChat = await request('/api/public/avatar/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: '你最擅长什么？' }] }),
  });
  assert.equal(disabledChat.response.status, 404);

  console.log('digital avatar tests: passed');
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
