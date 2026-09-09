import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = await mkdtemp(join(tmpdir(), 'auria-hero-ribbon-'));
const child = spawn(chrome, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
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

  const created = await fetch(`http://127.0.0.1:${port}/json/new?http://127.0.0.1:3101/?verify=hero-ribbon-v1`, { method: 'PUT' }).then((response) => response.json());
  socket = new WebSocket(created.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const consoleErrors = [];
  const pageErrors = [];
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
      return;
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      consoleErrors.push(message.params.args.map((arg) => arg.value || arg.description || '').join(' '));
    }
    if (message.method === 'Runtime.exceptionThrown') pageErrors.push(message.params.exceptionDetails.text);
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
  const navigate = async () => {
    await send('Page.navigate', { url: 'http://127.0.0.1:3101/?verify=hero-ribbon-v1' });
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await evaluate('document.readyState === "complete"')) break;
      await wait(50);
    }
    await wait(2200);
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate();

  const before = await evaluate(`(() => {
    const track = document.querySelector('.xiaoyang-strip');
    const firstSet = document.querySelector('.xiaoyang-strip-set');
    const duplicate = document.querySelectorAll('.xiaoyang-strip-set')[1];
    const card = Array.from(document.querySelectorAll('.xiaoyang-strip-set:first-child .xiaoyang-card')).find((node) => {
      const rect = node.getBoundingClientRect();
      return rect.left > 20 && rect.right < innerWidth - 20;
    });
    const rect = card?.getBoundingClientRect();
    return {
      transform: getComputedStyle(track).transform,
      animationPlayState: getComputedStyle(track).animationPlayState,
      cardCount: document.querySelectorAll('.xiaoyang-card').length,
      firstSetCards: firstSet?.querySelectorAll('.xiaoyang-card').length || 0,
      duplicateHidden: duplicate?.getAttribute('aria-hidden'),
      duplicateTabStops: duplicate ? Array.from(duplicate.querySelectorAll('a')).filter((node) => node.tabIndex >= 0).length : -1,
      cardCenter: rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  })()`);
  await wait(450);
  const moving = before.transform !== await evaluate(`getComputedStyle(document.querySelector('.xiaoyang-strip')).transform`);

  if (before.cardCenter) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: before.cardCenter.x, y: before.cardCenter.y, pointerType: 'mouse' });
    await wait(420);
  }
  const hover = await evaluate(`(() => {
    const card = document.querySelector('.xiaoyang-card:hover');
    const track = document.querySelector('.xiaoyang-strip');
    return {
      hovered: Boolean(card),
      lit: card?.classList.contains('is-lit') || false,
      animationPlayState: getComputedStyle(track).animationPlayState,
      translate: card ? getComputedStyle(card).translate : null,
      scale: card ? getComputedStyle(card).scale : null,
      copyOpacity: card ? getComputedStyle(card.querySelector('.xiaoyang-card-copy')).opacity : null,
      spotOpacity: card ? getComputedStyle(card.querySelector('.surface-light-spot')).opacity : null,
    };
  })()`);

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate();
  const mobile = await evaluate(`(() => ({
    innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    cardWidth: Math.round(document.querySelector('.xiaoyang-card').getBoundingClientRect().width),
    windowHeight: Math.round(document.querySelector('.xiaoyang-strip-window').getBoundingClientRect().height),
  }))()`);

  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await wait(150);
  const reducedMotion = await evaluate(`(() => ({
    animationName: getComputedStyle(document.querySelector('.xiaoyang-strip')).animationName,
    overflowX: getComputedStyle(document.querySelector('.xiaoyang-strip-window')).overflowX,
    duplicateDisplay: getComputedStyle(document.querySelectorAll('.xiaoyang-strip-set')[1]).display,
  }))()`);

  const passed = moving
    && before.animationPlayState === 'running'
    && before.cardCount === 16
    && before.firstSetCards === 8
    && before.duplicateHidden === 'true'
    && before.duplicateTabStops === 0
    && !before.horizontalOverflow
    && hover.hovered
    && hover.lit
    && hover.animationPlayState === 'paused'
    && hover.copyOpacity === '1'
    && hover.spotOpacity === '1'
    && !mobile.horizontalOverflow
    && reducedMotion.animationName === 'none'
    && reducedMotion.overflowX === 'auto'
    && reducedMotion.duplicateDisplay === 'none'
    && consoleErrors.length === 0
    && pageErrors.length === 0;

  console.log(JSON.stringify({ passed, moving, before, hover, mobile, reducedMotion, consoleErrors, pageErrors }, null, 2));
  if (!passed) process.exitCode = 1;
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  child.kill();
  await wait(300);
  try { await rm(profile, { recursive: true, force: true }); } catch {}
}
