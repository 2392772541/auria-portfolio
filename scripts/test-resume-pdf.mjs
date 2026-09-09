import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new Database(path.join(root, 'data', 'auria.sqlite'));
const baseUrl = process.env.AURIA_TEST_URL || 'http://127.0.0.1:3101';
const token = crypto.randomBytes(32).toString('base64url');
const csrf = crypto.randomBytes(32).toString('base64url');
const idHash = crypto.createHash('sha256').update(token).digest('hex');
const cookie = `auria_session=${token}`;
let uploaded = null;

const pdf = Buffer.from(
  '%PDF-1.4\n' +
  '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
  '2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n' +
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n' +
  '4 0 obj<</Length 52>>stream\nBT /F1 18 Tf 72 720 Td (Auria resume PDF QA) Tj ET\nendstream endobj\n' +
  '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n' +
  'xref\n0 6\n0000000000 65535 f \n' +
  'trailer<</Size 6/Root 1 0 R>>\nstartxref\n0\n%%EOF\n',
  'ascii',
);

async function request(url, options = {}) {
  return fetch(`${baseUrl}${url}`, {
    ...options,
    headers: { cookie, 'x-csrf-token': csrf, ...(options.headers || {}) },
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  db.prepare('INSERT INTO sessions (id_hash,csrf_token,email,expires_at,created_at) VALUES (?,?,?,?,?)')
    .run(idHash, csrf, 'qa-resume-pdf', Date.now() + 5 * 60 * 1000, new Date().toISOString());

  const publicBefore = await fetch(`${baseUrl}/api/public/bootstrap`).then(response => response.json());
  const adminBeforeResponse = await request('/api/admin/bootstrap');
  assert(adminBeforeResponse.status === 200, 'admin bootstrap failed');
  const adminBefore = await adminBeforeResponse.json();
  const original = adminBefore.resume;

  const form = new FormData();
  form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'auria-resume-qa.pdf');
  const uploadResponse = await request('/api/admin/upload', { method: 'POST', body: form });
  assert(uploadResponse.status === 201, `upload failed: ${uploadResponse.status}`);
  uploaded = await uploadResponse.json();
  assert(uploaded.content_type === 'application/pdf', 'uploaded media type is not PDF');

  const changed = { ...original, pdf_enabled: true, pdf_title: 'RESUME QA', pdf_url: uploaded.url, pdf_file_name: 'auria-resume-qa.pdf' };
  const saveResponse = await request('/api/admin/resume', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(changed),
  });
  assert(saveResponse.status === 200, `resume save failed: ${saveResponse.status}`);
  const saved = await saveResponse.json();
  assert(saved.pdf_url === uploaded.url && saved.pdf_title === 'RESUME QA', 'saved resume did not round-trip');

  const publicChanged = await fetch(`${baseUrl}/api/public/bootstrap`).then(response => response.json());
  assert(publicChanged.resume.pdf_url === uploaded.url, 'public bootstrap did not expose saved PDF');

  const protectedDelete = await request(`/api/admin/media/${uploaded.id}`, { method: 'DELETE' });
  assert(protectedDelete.status === 409, `referenced PDF deletion should return 409, got ${protectedDelete.status}`);

  const restoreResponse = await request('/api/admin/resume', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(original),
  });
  assert(restoreResponse.status === 200, 'resume restore failed');

  const deleteResponse = await request(`/api/admin/media/${uploaded.id}`, { method: 'DELETE' });
  assert(deleteResponse.status === 200, `unreferenced PDF deletion failed: ${deleteResponse.status}`);

  const publicAfter = await fetch(`${baseUrl}/api/public/bootstrap`).then(response => response.json());
  assert(JSON.stringify(publicAfter.resume) === JSON.stringify(publicBefore.resume), 'resume data was not fully restored');

  console.log(JSON.stringify({
    admin_bootstrap: 'passed',
    pdf_upload: 'passed',
    resume_save_roundtrip: 'passed',
    public_api_roundtrip: 'passed',
    referenced_media_delete: 'blocked_409',
    restore_and_cleanup: 'passed',
  }, null, 2));
} finally {
  db.prepare('DELETE FROM sessions WHERE id_hash=?').run(idHash);
  if (uploaded) {
    const row = db.prepare('SELECT object_key FROM media WHERE id=?').get(uploaded.id);
    if (row) {
      db.prepare('DELETE FROM media WHERE id=?').run(uploaded.id);
      fs.rmSync(path.join(root, 'data', 'uploads', row.object_key), { force: true });
    }
  }
  db.close();
}
