import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'App.tsx'), 'utf8');
const heroCss = fs.readFileSync(path.join(root, 'src', 'xiaoyang-hero.css'), 'utf8');

assert.match(source, /appendUser\s*=\s*true/, 'send must support retrying without appending the user question');
assert.match(source, /send\([^)]*,\s*false\)/, 'retry must reuse the existing conversation without duplicating the question');
assert.match(source, /friendlyAvatarError\(/, 'avatar errors must pass through a friendly error mapper');
assert.doesNotMatch(source, /ONLINE/, 'avatar status must not claim a fixed online state');
assert.match(source, /aria-label="\u5411\u6570\u5b57\u5206\u8eab\u63d0\u95ee"/, 'avatar input must have an accessible name');
assert.match(source, /aria-label="\u6e05\u7a7a\u5bf9\u8bdd"/, 'clear conversation button must have an accessible name');
assert.match(source, /assistantMessageRef/, 'new assistant answers must expose a scroll target');
assert.doesNotMatch(source, /assistantMessageRef\.current\?\.scrollIntoView/, 'answer positioning must not scroll the whole page behind the fixed navigation');
assert.match(source, /listRef\.current\?\.scrollTo\(\{top:/, 'new assistant answers must scroll to their beginning inside the message panel');
assert.doesNotMatch(source, /useEffect\(\(\)=>\{listRef\.current\?\.scrollTo/, 'message changes must not unconditionally force the reader to the bottom');
assert.match(
  heroCss,
  /\.xiaoyang-intro:has\(\.digital-avatar\.is-open\)\s*\{\s*z-index:\s*4\s*;?\s*\}/,
  'an open avatar must raise its parent stacking context above the work rail',
);

console.log('avatar UI regression contracts: passed');
