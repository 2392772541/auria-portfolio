import Database from 'better-sqlite3';
import { request } from 'node:http';
import { request as requestTls } from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.AURIA_AUDIT_BASE || 'https://gz.grzdt.com';
const url = new URL(base);
const http = url.protocol === 'https:' ? requestTls : request;
const get = path => new Promise((resolve, reject) => {
  const req = http(new URL(path, base), { rejectUnauthorized: true, timeout: 10000 }, res => {
    let body = ''; res.setEncoding('utf8'); res.on('data', chunk => { body += chunk; });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  req.on('timeout', () => req.destroy(new Error('timeout'))); req.on('error', reject); req.end();
});
const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail });
for (const path of ['/','/?page=work','/?page=writing','/?page=about','/?page=contact','/not-found']) {
  const result = await get(path); check(`GET ${path}`, result.status === 200, `status=${result.status}`);
}
const bootstrap = await get('/api/public/bootstrap');
let data;
try { data = JSON.parse(bootstrap.body); } catch { data = null; }
check('public bootstrap', bootstrap.status === 200 && data, `status=${bootstrap.status}`);
check('seeded works', data?.works?.length >= 8, `count=${data?.works?.length ?? 0}`);
check('seeded posts', data?.posts?.length >= 6, `count=${data?.posts?.length ?? 0}`);
check('hero video configurable', Boolean(data?.settings?.hero_video_url), 'site_settings.hero_video_url present');
for (const work of data?.works ?? []) {
  const result = await get(`/?page=work%2F${encodeURIComponent(work.slug)}`);
  check(`work detail ${work.slug}`, result.status === 200, `status=${result.status}`);
}
for (const post of data?.posts ?? []) {
  const result = await get(`/?page=writing%2F${encodeURIComponent(post.slug)}`);
  check(`post detail ${post.slug}`, result.status === 200, `status=${result.status}`);
}
const admin = await get('/api/admin/bootstrap'); check('admin auth gate', admin.status === 401, `status=${admin.status}`);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = process.env.AURIA_DB || path.join(root, 'data', 'auria.sqlite');
try {
  const db = new Database(dbPath, { readonly: true });
  check('sqlite integrity', db.pragma('integrity_check', { simple: true }) === 'ok', 'pragma integrity_check');
  check('contacts table', db.prepare("select name from sqlite_master where type='table' and name='contacts'").get(), 'contacts table exists');
  db.close();
} catch (error) {
  check('sqlite readable', false, `${dbPath}: ${error.name}`);
  check('contacts table', false, 'database unavailable');
}
const failed = checks.filter(item => !item.ok);
console.log(JSON.stringify({ base, passed: checks.length - failed.length, total: checks.length, failed }, null, 2));
process.exitCode = failed.length ? 1 : 0;
