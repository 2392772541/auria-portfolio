# 生产基线与迁移选择

本迁移包制作时，systemd 实际运行：

- 工作目录：`/opt/auria-hero/releases/20260824-150611`
- 启动文件：`server/index.mjs`
- Node：`/opt/auria-hero/runtime/node`，版本 22.23.0
- 监听：`127.0.0.1:3000`
- Caddy 域名：`gz.grzdt.com`

开发工作目录为 `/home/ubuntu/work/auria-hero-node-server-20260824/project`。两边都不是 Git 仓库。比较发现开发目录中的 `index.html`、`src/api.ts`、`src/index.css`、`src/pages/PortfolioPages.tsx`、`src/types.ts` 与 release 源码不同，且开发目录多出 `scripts/audit-production.mjs`。此前部署流程已将工作目录构建产物复制到正式 `dist/`，因此本迁移包采用开发目录作为可继续开发源码，以正式 SQLite 在线备份作为内容数据，并保留原始 release 的 root-only 回滚备份。

构建产物中的绝对路径不会进入迁移包；换机后通过 `npm run build` 重新生成。审计脚本默认数据库路径已改为项目内 `data/auria.sqlite`。这些变化只存在于迁移副本，不影响线上网站。
