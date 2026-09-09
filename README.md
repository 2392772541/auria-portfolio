# Auria 个人网站

Auria 是一个中文产品经理与 AI 产品作品集，包含前台作品、文章、关于、联系页面，以及基于 SQLite 的管理后台。

## 技术栈

- Vite 8 + React 19 + TypeScript 5
- Tailwind CSS 4
- Express 5
- SQLite（`better-sqlite3`）
- Node.js 22.23.x，npm 10.x

## 快速开始

1. 安装 Node.js 22 LTS。
2. 在项目根目录运行 `npm ci`。
3. 复制 `.env.example` 为 `.env`，按需填写本地配置。
4. 如需恢复服务器内容，按照 `MIGRATION.md` 将 `migration-data/auria.sqlite` 和 `migration-data/uploads/` 复制到 `data/`。
5. 运行 `npm run dev` 开发前端，或运行 `npm run build` 后执行 `npm start` 启动完整网站。

默认完整网站地址为 `http://127.0.0.1:3000`，后台为 `http://127.0.0.1:3000/?page=admin`。

## 常用命令

- `npm ci`：按锁文件安装依赖。
- `npm run dev`：Vite 前端开发服务器。
- `npm run build`：TypeScript 检查并构建前后端产物。
- `npm start`：启动 Express 正式服务。
- `npm run backup`：一致性备份 SQLite 和上传文件。

## 环境变量

完整变量名见 `.env.example`。管理员密码必须通过 `node scripts/generate-password-hash.mjs` 在本机隐藏输入生成，不要填写明文密码。飞书三项配置是可选项；未配置时联系信息仍会写入数据库，只是不发送飞书通知。

## 数据与附件

- 本地数据库：`data/auria.sqlite`
- 本地上传目录：`data/uploads/`
- 服务器内容快照：`migration-data/`

数据库和上传目录必须成对备份。迁移快照已清除登录 Session，不含生产密码、Token 或证书。

## 当前服务器部署基线

- 域名：`https://gz.grzdt.com`
- 反向代理：Caddy → `127.0.0.1:3000`
- 服务：systemd `auria-hero.service`
- 正式代码：`/opt/auria-hero/releases/20260824-150611`
- 正式数据：`/var/lib/auria-hero/data`

这些服务器绝对路径只是当前部署记录，不是本地运行依赖。新电脑按 `MIGRATION.md` 恢复；生产部署模板见 `deployment/`。

## 更多文档

- `MIGRATION.md`：跨电脑恢复流程。
- `DEVELOPMENT.md`：开发约定。
- `DEPLOYMENT.md`：Linux/Caddy/systemd 部署。
- `docs/PRODUCTION-BASELINE.md`：本次快照来源与差异说明。
