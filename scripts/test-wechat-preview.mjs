import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const latest = path.join(root, 'wechat', 'latest', 'index.html');
const archive = path.join(root, 'wechat', 'archive', '2026-08-26', 'index.html');
const pageCases = [
  {
    page: latest,
    copyHandler: 'copyArticle',
    expectedImages: [
      'hero-ai-pm-evals-v2.jpg',
      'editorial-busy-loop-ai.jpg',
      'feedback-to-eval.png',
      'prd-vs-eval.png',
      'editorial-eval-loop-ai.jpg',
    ],
  },
  {
    page: archive,
    copyHandler: 'copyWechatArticle',
    expectedImages: [
      'hero-blindsight.jpg',
      'intelligence-vs-consciousness.png',
      'rorschach-language-flow.png',
      'next-page-verdict.png',
    ],
  },
];

assert.equal(fs.existsSync(latest), true, 'latest page must exist');
assert.equal(fs.existsSync(archive), true, 'dated archive page must exist');

for (const { page, copyHandler, expectedImages } of pageCases) {
  const html = fs.readFileSync(page, 'utf8');
  assert.match(html, /复制全文到公众号/, `${page} must expose a copy control`);
  assert.match(html, /id=["']wechat-article["']/, `${page} must expose the copyable article`);
  assert.match(
    html,
    new RegExp(`onclick=["'][^"']*\\b${copyHandler}\\s*\\(`),
    `${page} copy control must call ${copyHandler}`,
  );
  assert.match(
    html,
    new RegExp(`function\\s+${copyHandler}\\s*\\(`),
    `${page} must define ${copyHandler}`,
  );
  assert.doesNotMatch(html, /data:image\//, `${page} must not use data URI images`);
  assert.doesNotMatch(html, /src=["']assets\//, `${page} must not use local relative assets`);
  for (const image of expectedImages) {
    assert.match(html, new RegExp(`/wechat/assets/${image.replaceAll('.', '\\.')}`), `${page} must use public image ${image}`);
    const imagePath = path.join(root, 'wechat', 'assets', image);
    assert.equal(fs.existsSync(imagePath), true, `${image} must exist in public assets`);
    assert.ok(fs.statSync(imagePath).size > 1000, `${image} must be non-empty`);
  }
}

console.log('wechat preview artifact checks passed');
