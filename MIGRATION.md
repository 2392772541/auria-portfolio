# 跨电脑恢复与持续备份

## 首次恢复

按 README 的命令安装、恢复、配置管理员、构建和启动。Windows PowerShell、macOS/Linux 使用相同 npm 命令。推荐 Node 22.22.0 / npm 10；不要复制其他电脑的 `node_modules`，SQLite 含平台相关二进制，必须在目标机器执行 `npm ci`。

`portable/content.json` 包含7张内容表，`portable/uploads/` 包含附件，`portable/manifest.json` 包含 SHA256。快照由 SQLite 读取事务生成，排除 `sessions`、`contacts` 和所有环境配置。JSON 会包含站长写入后台的草稿、数字分身知识等内容，仓库应保持私有；后续导出后也应检查是否写入了敏感文本。

`content:restore` 仅允许目标不存在或只有空目录/空 `.gitkeep` 的初始目录，先在临时目录完成校验和 SQLite 完整性检查，再放到目标目录。重复执行不会覆盖已经编辑的数据库。请只恢复自己信任的 Git 快照。

`setup:admin` 创建或更新当前电脑 `.env` 中的管理员邮箱及密码哈希。它不会显示或记录密码，其他环境配置保留；重启服务后生效。若只想浏览、不配置后台，可以复制 `.env.example` 为 `.env` 后构建启动。

## 当前电脑继续修改以后

代码和素材修改后正常提交 Git。后台内容修改不会自动提交：

```sh
npm run backup
npm run content:export -- portable-next
```

暂停后台编辑/上传后导出，检查新快照和附件，用 `portable-next` 替换仓库的 `portable`（先保存旧版本），再 `git add portable`、提交并推送。导出命令不会覆盖旧目录，也不会导出账号凭据或访客消息。每台电脑独立保存数据，不提供多机实时同步；不要把旧快照覆盖到新编辑的数据上。

已经运行的目标电脑更新内容时：先停止服务并运行备份，将旧 `data` 改名保留，再执行 `npm run content:restore`，重新启动。仅更新源码时执行 `git pull`、`npm ci`、`npm run build` 并重启，无需恢复内容。

## 私密信息与在线依赖

管理员账号需在新电脑本地设置；旧密码不在 Git。在线数字分身在 `.env` 设置 `DIGITAL_AVATAR_API_KEY` 及相应 BASE_URL/MODEL；飞书通知设置 `FEISHU_*`。不要把这些值写进前端、命令行历史或 Git。

`npm run backup` 生成的 `backups/` 含完整数据库（可能含会话和访客留言），仅用于私密迁移，默认不提交。`.env` 如需迁移请用密码管理器/加密渠道另行传递。

本地图片、PDF、项目视频和池塘资源随仓库保存。现有外部 Demo/GitHub 链接、部分图片/视频及 Google 字体仍依赖网络；外部链接不是项目源码的一部分。操作系统字体渲染、屏幕尺寸和第三方资源变化也可能导致细节差异。本次验证覆盖 Windows 独立 Node22 安装与恢复；macOS/Linux 需在对应系统安装依赖后验证。

## 验收与排错

检查首页、作品/详情、开源、文章、关于、联系、404、后台登录；池塘应点哪里哪里出鱼，简历可查看/下载。`/api/public/bootstrap` 返回内容，未登录访问 `/api/admin/bootstrap` 应返回401。

- 端口占用：在 `.env` 更改 `PORT`，按新地址打开。
- 页面没更新：`npm run build` 后重启 `npm start`。
- 内容变成默认示例：先恢复快照再启动；若提前启动创建了 data，保留该目录，恢复到新目录后切换 `AURIA_DATA_DIR`。
- 数据库原生模块版本错误：确认 Node22，重新 `npm ci`，不要复用 Node25 的依赖。
- HTTP 本地后台：保持示例中的 `NODE_ENV=development`。生产环境应配置 HTTPS 后使用 production（安全 Cookie 需要 HTTPS）。
