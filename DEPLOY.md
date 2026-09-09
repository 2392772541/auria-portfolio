# Auria 普通服务器部署说明

当前压缩包是标准 Node.js 服务器版本：Express 提供接口，SQLite 保存内容，`data/uploads/` 保存图片、MP4 和 PDF。适合 VPS、宝塔、Docker 或任何能运行 Node.js 20+ 的服务器。

## 直接启动

```bash
npm ci
npm run build
npm start
```

默认监听 `3000` 端口。可以通过环境变量修改：

```bash
PORT=3000 AURIA_DATA_DIR=/var/lib/auria NODE_ENV=production \
  ADMIN_EMAIL=you@example.com \
  ADMIN_PASSWORD_HASH='<salt>$<scrypt-hex>' \
  npm start
```

`AURIA_DATA_DIR` 目录必须可写，里面会生成 `auria.sqlite` 和 `uploads/`. 部署时要把这个目录加入备份，不要只备份代码目录。

`ADMIN_PASSWORD_HASH` 必须是通过受信任的本地密码生成流程得到的 scrypt 哈希，不能写明文密码。生产环境必须配置 `ADMIN_EMAIL`、`ADMIN_PASSWORD_HASH` 和 `NODE_ENV=production`；未配置管理员凭据时，管理后台会拒绝服务。登录后端使用 HttpOnly Session Cookie 和 CSRF Token，所有 `/api/admin/*` 写操作都必须携带 CSRF Token。

生成哈希时不要把密码放入命令行参数或聊天记录；在服务器本地交互输入后生成并写入受限权限的环境文件。

后台地址：`/?page=admin`

## 宝塔 / Nginx

把站点反向代理到 `127.0.0.1:3000`，并允许上传请求体至少 25 MB。后台使用应用内管理员登录，不要把 Basic Auth 作为唯一认证；Caddy/Nginx 只负责 HTTPS 和反向代理。

## 本地检查

```bash
npm ci
npm run build
```

## 备份

运行 `npm run backup` 前设置 `AURIA_DATA_DIR` 和 `AURIA_BACKUP_DIR`。脚本会对 SQLite 执行 `integrity_check`，生成一致性数据库备份、复制 `uploads/` 并写入 manifest。备份目录不能放在公开网站目录中。

## Cloudflare 版本

仓库仍保留 `wrangler.jsonc`、Worker 入口和 D1/R2 迁移文件，原来的 Cloudflare Sites 版本不受影响；普通服务器部署使用本包里的 `server/index.mjs`。
