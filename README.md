# Auria 个人网站

中文 AI 产品作品集：作品、开源项目、文章、简历 PDF、数字分身、互动池塘，以及可编辑上述内容的 SQLite 管理后台。当前配色、布局和交互随源码保存。

## 在另一台电脑恢复当前网站

安装 Git、Node.js **22.22.0**（版本见 `.nvmrc`，npm 10），然后执行：

```sh
git clone https://github.com/2392772541/auria-portfolio.git
cd auria-portfolio
npm ci
npm run content:restore
npm run setup:admin
npm run build
npm start
```

这是私有仓库，需要有访问权限的 GitHub 账号。`setup:admin` 会隐藏输入密码，并创建本机 `.env`；密码至少12位，不会上传到 Git。

打开网站：<http://127.0.0.1:3101/>；后台：<http://127.0.0.1:3101/?page=admin>。终端保持运行。不需要旧电脑路径、单独的池塘服务、SQLite 命令行或复制 `node_modules`。

`content:restore` 还原仓库内 `portable/` 的内容和7个附件，并校验 SHA256。已有数据库时会拒绝覆盖。后台编辑保存在本机 `data/`；Git 拉取代码不会覆盖你的新内容。迁移新内容见 [MIGRATION.md](MIGRATION.md)。

## 恢复范围

- 源码、锁文件、静态图片和视频、池塘交互、上传图片和简历 PDF。
- 作品和文章（包括草稿）、品牌联系信息、首页及内页配置、数字分身提示词/知识/预设问答。
- 不上传管理员凭据、API 密钥、登录会话、访客留言和日志。完整私密数据备份使用 `npm run backup`，通过私密渠道迁移。
- 数字分身的在线模型和飞书通知需在新电脑 `.env` 单独配置；没配置密钥时数字分身按现有预设/降级逻辑工作。外链 Demo、远程图片/视频及 Google 字体仍需要网络，第三方服务可用性不由本仓库保证。

## 技术与命令

React 19、TypeScript 5、Vite 8、Express 5、better-sqlite3。完整运行入口是 `server/index.mjs`，页面构建到 `dist/client`；不要只部署静态目录，否则后台不可用。仓库内 Worker/Cloudflare 文件为历史入口，不是当前服务部署方式。

- `npm run build`：类型检查和构建；改前端后重新构建。
- `npm start`：启动完整前后台，读取本机 `.env`。
- `npm run backup`：备份数据库和上传目录，无需额外安装 sqlite3。
- `npm run content:export -- portable-next`：导出新的可提交内容快照（不覆盖旧目录）。
- `npm run test:cms`：独立数据副本验证前后台联动；需 Playwright 与 Chrome，详见脚本。

详细说明：[跨电脑迁移](MIGRATION.md)、[前后台对应审查](docs/ADMIN-FRONTEND-AUDIT.md)、[开发约定](DEVELOPMENT.md)。`DEPLOYMENT.md` 和旧服务器基线文件是历史参考，不代表当前远端部署状态。
