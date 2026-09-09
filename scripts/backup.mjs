import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.resolve(process.env.AURIA_DATA_DIR || path.join(root, 'data'));
const backupRoot = path.resolve(process.env.AURIA_BACKUP_DIR || path.join(root, 'backups'));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = path.join(backupRoot, stamp);
const dbPath = path.join(dataDir, 'auria.sqlite');
const uploads = path.join(dataDir, 'uploads');

if (!fs.existsSync(dbPath)) throw new Error(`数据库不存在: ${dbPath}`);
fs.mkdirSync(target, { recursive: true, mode: 0o700 });
const sqliteBin = process.env.SQLITE3_BIN || 'sqlite3';
const integrity = execFileSync(sqliteBin, [dbPath, 'PRAGMA integrity_check;'], { encoding: 'utf8' }).trim();
if (integrity !== 'ok') throw new Error(`SQLite integrity_check failed: ${integrity}`);
const snapshot = path.join(target, 'auria.sqlite');
const sqliteSnapshot = snapshot.replaceAll('\\', '/').replaceAll("'", "''");
execFileSync(sqliteBin, [dbPath, `.backup '${sqliteSnapshot}'`], { stdio: 'pipe' });
const snapshotIntegrity = execFileSync(sqliteBin, [snapshot, 'PRAGMA integrity_check;'], { encoding: 'utf8' }).trim();
if (snapshotIntegrity !== 'ok') throw new Error(`Backup integrity_check failed: ${snapshotIntegrity}`);
if (fs.existsSync(uploads)) {
  const uploadBackup = path.join(target, 'uploads');
  if (process.platform === 'win32') {
    const copy = spawnSync('robocopy', [uploads, uploadBackup, '/E', '/COPY:DAT', '/R:2', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS', '/NP'], { stdio: 'pipe' });
    if (copy.error || copy.status === null || copy.status > 7) {
      throw copy.error || new Error(`robocopy failed with exit code ${copy.status}: ${copy.stderr?.toString() || ''}`);
    }
  } else {
    fs.cpSync(uploads, uploadBackup, { recursive: true });
    for (const entry of fs.readdirSync(uploadBackup, { recursive: true })) {
      const item = path.join(uploadBackup, entry);
      if (fs.existsSync(item)) fs.chmodSync(item, fs.statSync(item).isDirectory() ? 0o700 : 0o600);
    }
  }
}
const manifest = {
  created_at: new Date().toISOString(),
  data_dir: dataDir,
  database: { path: snapshot, integrity_check: snapshotIntegrity },
  uploads: fs.existsSync(uploads) ? fs.readdirSync(uploads).length : 0,
};
fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
try { execFileSync('sha256sum', ['-b', snapshot], { stdio: 'inherit' }); } catch { /* manifest remains usable without sha256sum */ }
console.log(`BACKUP_DIR=${target}`);
console.log(`DATABASE_INTEGRITY=${integrity}`);
console.log(`UPLOAD_ENTRIES=${manifest.uploads}`);
