# Auria 迁移与恢复

## 迁移包边界

迁移包包含源码、锁文件、生产内容的 SQLite 一致性快照、上传目录和示例部署文件。不包含真实 `.env`、管理员密码哈希、飞书凭据、证书私钥、登录 Session、Hermes 文件、`node_modules` 或旧构建产物。

## Windows 恢复

1. 安装 Git 和 Node.js 22 LTS。
2. 解压迁移包或 `git clone` 项目。
3. 在 PowerShell 进入项目目录。
4. 执行 `npm ci`。
5. 执行 `Copy-Item .env.example .env`。
6. 创建运行数据：
   - `New-Item -ItemType Directory -Force data\uploads`
   - `Copy-Item migration-data\auria.sqlite data\auria.sqlite`
   - `Copy-Item migration-data\uploads\* data\uploads\ -Recurse -Force`（目录为空时可跳过）
7. 执行 `npm run build`。
8. 在当前 PowerShell 设置：`$env:AURIA_DATA_DIR="$PWD\data"`、`$env:PORT="3000"`、`$env:NODE_ENV="development"`。
9. 执行 `npm start`。
10. 打开 `http://127.0.0.1:3000`。

如需登录后台，先运行 `node scripts/generate-password-hash.mjs`，再把生成的哈希和管理员邮箱写入本机 `.env` 或当前终端环境。不要把密码或哈希提交 Git。

## macOS / Linux 恢复

1. 安装 Node.js 22 LTS。
2. 运行 `npm ci`。
3. 运行 `cp .env.example .env`。
4. 运行 `mkdir -p data/uploads`。
5. 运行 `cp migration-data/auria.sqlite data/auria.sqlite`。
6. 如有附件，复制 `migration-data/uploads/` 内容到 `data/uploads/`。
7. 运行 `npm run build`。
8. 运行 `AURIA_DATA_DIR="$PWD/data" PORT=3000 NODE_ENV=development npm start`。

## 校验

- 首页、作品、文章、关于、联系和 404 可打开。
- `/api/public/bootstrap` 返回作品和文章数据。
- `/api/admin/bootstrap` 未登录时返回 401。
- SQLite `PRAGMA integrity_check` 为 `ok`。
- 本次包的 SHA256 见同目录校验文件。

## Git

本次源目录和正式 release 原本都不是 Git 仓库。迁移副本会初始化成本地 Git 仓库，但不会自动推送任何远程。`migration-data/` 默认被忽略；如要长期保存生产内容，请另行加密备份，不建议放入公开代码仓库。
