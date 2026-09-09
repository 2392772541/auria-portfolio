import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auria-avatar-upstream-test-'));
const appPort = 3198;
const upstreamPort = 3199;
const appBase = `http://127.0.0.1:${appPort}`;
const upstreamRequests = [];

const upstream = http.createServer((req, res) => {
  let raw = '';
  req.setEncoding('utf8');
  req.on('data', chunk => { raw += chunk; });
  req.on('end', () => {
    const payload = JSON.parse(raw || '{}');
    upstreamRequests.push(payload);
    res.setHeader('content-type', 'application/json');
    if (payload.messages?.at(-1)?.content === '始终失败的问题') {
      res.statusCode = 503;
      res.end(JSON.stringify({ error: { message: 'upstream unavailable' } }));
      return;
    }
    if (upstreamRequests.length === 1) {
      res.statusCode = 504;
      res.end(JSON.stringify({ error: { message: 'temporary upstream timeout' } }));
      return;
    }
    res.end(JSON.stringify({ choices: [{ message: { content: '兼容重试已经恢复回答。' } }] }));
  });
});

await new Promise((resolve, reject) => {
  upstream.once('error', reject);
  upstream.listen(upstreamPort, '127.0.0.1', resolve);
});

const server = spawn(process.execPath, ['server/index.mjs'], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(appPort),
    AURIA_DATA_DIR: dataDir,
    DIGITAL_AVATAR_API_KEY: 'test-key',
    DIGITAL_AVATAR_BASE_URL: `http://127.0.0.1:${upstreamPort}`,
    DIGITAL_AVATAR_MODEL: 'test-model',
    DIGITAL_AVATAR_REASONING_EFFORT: 'medium',
    DIGITAL_AVATAR_TIMEOUT_MS: '250',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stderr = '';
server.stderr.on('data', chunk => { stderr += chunk; });

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${appBase}/api/public/bootstrap`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`测试服务器启动失败：${stderr}`);
}

try {
  await waitForServer();
  const startedAt = Date.now();
  const response = await fetch(`${appBase}/api/public/avatar/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: '这是一个真实 AI 分支的问题' }] }),
  });
  const result = await response.json();

  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(result.source, 'ai');
  assert.equal(result.reply, '兼容重试已经恢复回答。');
  assert.equal(upstreamRequests.length, 2);
  assert.equal(upstreamRequests[0].reasoning_effort, 'medium');
  assert.equal('reasoning_effort' in upstreamRequests[1], false);
  assert.ok(Date.now() - startedAt < 1500, 'recovery should complete quickly');

  const fallbackResponse = await fetch(`${appBase}/api/public/avatar/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: '始终失败的问题' }] }),
  });
  const fallback = await fallbackResponse.json();
  assert.equal(fallbackResponse.status, 200);
  assert.equal(fallback.source, 'fallback');
  assert.match(fallback.reply, /AI 服务刚刚有点忙/);

  console.log('avatar upstream recovery test: passed');
} finally {
  server.kill('SIGTERM');
  upstream.close();
  if (server.exitCode === null) {
    await Promise.race([
      new Promise(resolve => server.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 2000)),
    ]);
  }
  fs.rmSync(dataDir, { recursive: true, force: true });
}
