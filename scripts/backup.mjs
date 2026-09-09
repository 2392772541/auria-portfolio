import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';

const root = path.resolve(import.meta.dirname, '..');
const dataDir = path.resolve(process.env.AURIA_DATA_DIR || path.join(root, 'data'));
const backupRoot = path.resolve(process.env.AURIA_BACKUP_DIR || path.join(root, 'backups'));
const target = path.join(backupRoot, new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(target, {recursive: true, mode: 0o700});
const db = new Database(path.join(dataDir, 'auria.sqlite'), {readonly: true});
try {
  if (db.pragma('integrity_check', {simple: true}) !== 'ok') throw new Error('数据库校验失败');
  await db.backup(path.join(target, 'auria.sqlite'));
} finally { db.close(); }
function copy(source, dest) {
  fs.mkdirSync(dest, {recursive: true, mode: 0o700});
  for (const entry of fs.readdirSync(source, {withFileTypes: true})) {
    if (entry.isSymbolicLink()) throw new Error('备份附件不允许符号链接');
    if (entry.isDirectory()) copy(path.join(source, entry.name), path.join(dest, entry.name));
    else fs.writeFileSync(path.join(dest, entry.name), fs.readFileSync(path.join(source, entry.name)), {mode: 0o600});
  }
}
copy(path.join(dataDir, 'uploads'), path.join(target, 'uploads'));
const check = new Database(path.join(target, 'auria.sqlite'), {readonly: true});
const integrity = check.pragma('integrity_check', {simple: true});
check.close();
if (integrity !== 'ok') throw new Error('备份校验失败');
fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify({createdAt: new Date().toISOString(), integrity, databaseSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(target, 'auria.sqlite'))).digest('hex')}, null, 2) + '\n', {mode: 0o600});
console.log('BACKUP_DIR=' + target + '\nDATABASE_INTEGRITY=' + integrity);
