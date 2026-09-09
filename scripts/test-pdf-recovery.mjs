import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const cssSource = fs.readFileSync(new URL('../src/cyber-home-sections.css', import.meta.url), 'utf8');

assert.match(appSource, /method:\s*'HEAD'/, 'PDF viewer must probe same-origin availability before embedding');
assert.match(appSource, /resume-pdf-reload/, 'PDF viewer must expose a manual reload control');
assert.match(appSource, /getDocument\(\{url/, 'PDF viewer must render with PDF.js instead of relying on a browser PDF plugin');
assert.match(appSource, /setTimeout\(\(\)=>\{[\s\S]*setReloadToken/, 'PDF viewer must retry after a temporary server outage');
assert.doesNotMatch(appSource, /<iframe[^>]+resume-pdf-viewer/, 'PDF viewer must not use the unreliable native browser PDF iframe');
assert.match(cssSource, /\.resume-pdf-recovery/, 'PDF recovery state must have visible styling');
assert.match(cssSource, /\.resume-pdf-pages/, 'PDF.js pages must have visible styling');

console.log(JSON.stringify({ pdf_recovery_ui: 'passed', renderer: 'pdfjs' }));
