import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = await mkdtemp(join(tmpdir(), 'auria-cdp-'));
const child = spawn(chrome, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--remote-debugging-port=0',
  '--remote-allow-origins=*',
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore' });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket;

try {
  let port;
  let browserPath;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      [port, browserPath] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/);
      break;
    } catch {
      await wait(100);
    }
  }
  if (!port || !browserPath) throw new Error('Chrome DevTools endpoint did not start');

  const created = await fetch(`http://127.0.0.1:${port}/json/new?http://127.0.0.1:3101/`, { method: 'PUT' }).then((response) => response.json());
  socket = new WebSocket(created.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
      return;
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      consoleErrors.push(message.params.args.map((arg) => arg.value || arg.description || '').join(' '));
    }
    if (message.method === 'Runtime.exceptionThrown') pageErrors.push(message.params.exceptionDetails.text);
    if (message.method === 'Network.loadingFailed' && !message.params.canceled) failedRequests.push(message.params.errorText);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return result.result.value;
  };
  const navigate = async (url) => {
    await send('Page.navigate', { url });
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await evaluate('document.readyState === "complete"')) break;
      await wait(50);
    }
    await wait(1200);
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');

  let homeLinks = [];
  const homeAudits = [];
  for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
    await send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.name === 'mobile' });
    await navigate('http://127.0.0.1:3101/');
    if (viewport.name === 'desktop') homeLinks = await evaluate(`Array.from(document.querySelectorAll('a[href*="showcase-project-"]')).map(a => a.getAttribute('href'))`);
    homeAudits.push(await evaluate(`(() => {
      const shell = document.getElementById('selected');
      const bodyWidth = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth);
      return {
        viewport: ${JSON.stringify(viewport.name)},
        innerWidth: window.innerWidth,
        scrollWidth: bodyWidth,
        shellVisible: Boolean(shell),
        sectionTitles: Array.from(shell?.querySelectorAll('.jade-section-heading h2') || []).map(node => node.textContent.trim()),
        projectCount: shell?.querySelectorAll('.jade-project-card').length || 0,
        selectorCount: shell?.querySelectorAll('.jade-project-selector button').length || 0,
        activeProject: shell?.querySelector('.jade-project-card')?.getAttribute('data-project-slug') || null,
        legacySelectedWorks: document.body.textContent.includes('SELECTED WORKS'),
        horizontalOverflow: bodyWidth > window.innerWidth + 1,
      };
    })()`));
  }

  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate('http://127.0.0.1:3101/');
  const selectorInteraction = await evaluate(`(async () => {
    const buttons = Array.from(document.querySelectorAll('#selected .jade-project-selector button'));
    const before = document.querySelector('#selected .jade-project-card')?.getAttribute('data-project-slug') || null;
    buttons[buttons.length - 1]?.click();
    await new Promise(resolve => setTimeout(resolve, 350));
    const after = document.querySelector('#selected .jade-project-card')?.getAttribute('data-project-slug') || null;
    return { before, after, buttonCount: buttons.length, activeCount: buttons.filter(button => button.getAttribute('aria-selected') === 'true').length };
  })()`);

  const audits = [];
  for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
    await send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.name === 'mobile' });
    await navigate('http://127.0.0.1:3101/?page=work%2Fworkflow-orchestrator');
    audits.push(await evaluate(`(() => {
      const target = document.getElementById('showcase-project-workflow-orchestrator');
      const videoSlot = target?.querySelector('.jade-video-placeholder, video');
      const chapters = target?.querySelectorAll('.jade-chapter-button, [aria-label="项目演示视频章节"] button').length || 0;
      const bodyWidth = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth);
      return {
        viewport: ${JSON.stringify(viewport.name)},
        innerWidth: window.innerWidth,
        scrollWidth: bodyWidth,
        horizontalOverflow: bodyWidth > window.innerWidth + 1,
        targetTop: target ? Math.round(target.getBoundingClientRect().top) : null,
        targetVisible: Boolean(target),
        demoPlaceholder: target?.textContent.includes('Demo 地址待补充') || false,
        metricPlaceholders: target ? target.querySelectorAll('.jade-metrics > .is-placeholder').length : 0,
        accessCodePlaceholder: target?.textContent.includes('体验码：待补充') || target?.textContent.includes('体验码： 待补充') || false,
        videoAspectRatio: videoSlot ? getComputedStyle(videoSlot).aspectRatio : null,
        chapters,
        pageTitle: document.title,
      };
    })()`));
  }

  console.log(JSON.stringify({ homeLinks, homeAudits, selectorInteraction, audits, consoleErrors, pageErrors, failedRequests }, null, 2));
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  child.kill();
  await wait(500);
  try { await rm(profile, { recursive: true, force: true }); } catch {}
}
