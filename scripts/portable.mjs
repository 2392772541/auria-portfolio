import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';

const root = path.resolve(import.meta.dirname, '..');
const tables = ['works', 'posts', 'resume', 'site_settings', 'media', 'avatar_settings', 'page_content'];
const command = process.argv[2];
const target = path.resolve(process.argv[3] || (command === 'export' ? path.join(root, 'portable') : process.env.AURIA_DATA_DIR || path.join(root, 'data')));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const quote = name => `"${name.replaceAll('"', '""')}"`;
function files(dir, prefix = '') {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    if (entry.isSymbolicLink()) throw new Error('迁移附件不允许符号链接');
    const name = prefix + entry.name;
    return entry.isDirectory() ? files(path.join(dir, entry.name), name + '/') : entry.name === '.gitkeep' ? [] : [name];
  }).sort();
}
function safe(base, name) {
  if (typeof name !== 'string' || name.includes('\\') || name.split('/').some(p => !p || p === '.' || p === '..') || path.isAbsolute(name)) throw new Error('无效附件路径');
  const result = path.resolve(base, name);
  if (!result.startsWith(path.resolve(base) + path.sep)) throw new Error('附件越界');
  return result;
}

if (!['export', 'restore'].includes(command)) throw new Error('用法: node scripts/portable.mjs export [新快照目录] | restore [新数据目录]');
// Never overwrite a live database or an earlier snapshot, including partial restores.
const isEmptySkeleton = () => fs.statSync(target).isDirectory() && fs.readdirSync(target).every(name => name === 'uploads') && (!fs.existsSync(path.join(target, 'uploads')) || (fs.lstatSync(path.join(target, 'uploads')).isDirectory() && fs.readdirSync(path.join(target, 'uploads')).every(name => name === '.gitkeep' && fs.lstatSync(path.join(target, 'uploads', name)).isFile() && fs.statSync(path.join(target, 'uploads', name)).size === 0)));
if (fs.existsSync(target) && (command !== 'restore' || fs.lstatSync(target).isSymbolicLink() || !isEmptySkeleton())) throw new Error(`目标已存在，拒绝覆盖。请选择新目录: ${target}`);
fs.mkdirSync(path.dirname(target), {recursive: true});
const staging = fs.mkdtempSync(path.join(path.dirname(target), '.auria-restore-'));
try {
  if (command === 'export') {
    const sourceDir = path.resolve(process.env.AURIA_DATA_DIR || path.join(root, 'data'));
    const db = new Database(path.join(sourceDir, 'auria.sqlite'), {readonly: true});
    let snapshot;
    try {
      snapshot = db.transaction(() => {
        if (db.pragma('integrity_check', {simple: true}) !== 'ok') throw new Error('数据库校验失败');
        return {version: 1, createdAt: new Date().toISOString(), tables: Object.fromEntries(tables.map(name => [name, {
          schema: db.prepare('SELECT sql FROM sqlite_master WHERE type=? AND name=?').get('table', name).sql,
          rows: db.prepare(`SELECT * FROM ${quote(name)} ORDER BY id`).all(),
        }]))};
      })();
    } finally { db.close(); }
    // Only owner-authored site content. No sessions, contacts, environment or credentials.
    const serialized = JSON.stringify(snapshot, null, 2) + '\n';
    if (/(?:\bsk-[A-Za-z0-9_-]{20,}|-----BEGIN .*PRIVATE KEY-----|ADMIN_PASSWORD_HASH|FEISHU_APP_SECRET)/.test(serialized)) throw new Error('内容包含疑似凭据，停止导出');
    const uploads = files(path.join(sourceDir, 'uploads')).map(name => {
      const data = fs.readFileSync(safe(path.join(sourceDir, 'uploads'), name));
      const dest = safe(path.join(staging, 'uploads'), name);
      fs.mkdirSync(path.dirname(dest), {recursive: true});
      fs.writeFileSync(dest, data);
      return {name, size: data.length, sha256: sha(data)};
    });
    fs.writeFileSync(path.join(staging, 'content.json'), serialized);
    fs.writeFileSync(path.join(staging, 'manifest.json'), JSON.stringify({version: 1, contentSha256: sha(serialized), uploads, excluded: ['sessions', 'contacts', '.env', 'credentials', 'logs']}, null, 2) + '\n');
    console.log(`内容表 ${tables.length}，附件 ${uploads.length}；不含登录会话、访客消息或环境凭据。`);
  } else {
    const source = path.join(root, 'portable');
    const serialized = fs.readFileSync(path.join(source, 'content.json'));
    const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
    if (manifest.version !== 1 || sha(serialized) !== manifest.contentSha256) throw new Error('内容快照校验失败');
    const snapshot = JSON.parse(serialized);
    if (snapshot.version !== 1 || JSON.stringify(Object.keys(snapshot.tables).sort()) !== JSON.stringify([...tables].sort())) throw new Error('快照表范围不匹配');
    fs.mkdirSync(path.join(staging, 'uploads'));
    for (const entry of manifest.uploads) {
      const data = fs.readFileSync(safe(path.join(source, 'uploads'), entry.name));
      if (sha(data) !== entry.sha256 || data.length !== entry.size) throw new Error(`附件损坏: ${entry.name}`);
      const dest = safe(path.join(staging, 'uploads'), entry.name);
      fs.mkdirSync(path.dirname(dest), {recursive: true});
      fs.writeFileSync(dest, data);
    }
    const db = new Database(path.join(staging, 'auria.sqlite'));
    try {
      db.transaction(() => {
        for (const name of tables) {
          const {schema, rows} = snapshot.tables[name];
          if (!schema.startsWith(`CREATE TABLE ${name} (`) || schema.includes(';')) throw new Error('无效表结构');
          db.exec(schema);
          for (const row of rows) {
            const columns = Object.keys(row);
            db.prepare(`INSERT INTO ${quote(name)} (${columns.map(quote)}) VALUES (${columns.map(() => '?')})`).run(...columns.map(c => row[c]));
          }
        }
      })();
      if (db.pragma('integrity_check', {simple: true}) !== 'ok') throw new Error('恢复数据库校验失败');
    } finally { db.close(); }
    console.log('内容和附件 SHA256 校验通过，数据库 integrity_check=ok。');
  }
  if (fs.existsSync(target)) {
    if (!isEmptySkeleton()) throw new Error('恢复期间目标目录发生变更，拒绝覆盖');
    const uploads = path.join(target, 'uploads');
    const keep = path.join(uploads, '.gitkeep');
    if (fs.existsSync(keep)) fs.unlinkSync(keep);
    if (fs.existsSync(uploads)) fs.rmdirSync(uploads);
    fs.rmdirSync(target);
  }
  fs.renameSync(staging, target);
  console.log(`完成: ${target}`);
} catch (error) {
  // staging is an exclusively owned mkdtemp sibling, never user data.
  fs.rmSync(staging, {recursive: true, force: true});
  throw error;
}
