# Auria 网站全站审查与修复报告

审查日期：2026-09-07  
项目目录：`E:\工程项目\codex项目合集\个人用\auria-local-migration-20260831-1017\auria-website`  
本地地址：`http://127.0.0.1:3101/`

## 结论

本轮发现并修复 2 个数字分身前端 Bug。修复后，公开页面、PDF 简历、数字分身、主要 API、构建流程和 SQLite 数据库均通过回归检查；网站当前由 Node.js 进程在 3101 端口正常提供服务。

## 已修复问题

### 1. 数字分身展开面板被作品卡片遮挡

- 现象：首页数字分身展开后，面板下半部分与横向作品轨道重叠时会被作品卡片盖住。
- 根因：`.xiaoyang-intro` 和 `.xiaoyang-strip` 分别建立了不同的 stacking context（层叠上下文：决定元素前后遮挡关系的分组）；子元素自己的高 `z-index` 无法越过父级层叠上下文。
- 修复：数字分身打开时提升 `.xiaoyang-intro` 的层级，使整个数字分身面板位于作品轨道之上。
- 回归保护：`scripts/test-avatar-ui-regressions.mjs` 新增 CSS 结构断言。

### 2. 数字分身回答后整页发生错误滚动

- 现象：新回答出现时，页面会整体滚动，回答首行可能进入固定导航栏下方。
- 根因：对回答元素调用 `scrollIntoView()`，浏览器会滚动页面祖先，而不只滚动数字分身消息区域。
- 修复：根据回答元素与消息容器的相对位置计算目标，只调用消息容器的 `scrollTo()`；同时尊重系统的“减少动态效果”设置。
- 回归保护：新增源码断言，禁止恢复到会滚动整页的 `scrollIntoView()` 实现。

## 页面与功能审查

| 范围 | 结果 | 证据 |
| --- | --- | --- |
| 首页 | 正常 | `01-home.png` |
| 作品列表 | 正常 | `02-work-list.png` |
| 作品详情 | 正常 | `03-work-detail.png` |
| 文章列表 | 正常 | `04-writing-list.png` |
| 文章详情 | 正常 | `05-writing-detail.png` |
| 关于 | 正常 | `06-about.png` |
| 联系 | 正常；未提交表单，避免制造测试记录 | `07-contact.png` |
| PDF 简历 | 1 页成功绘制；打开、下载、重载入口正常 | `08-resume-pdf.png` |
| 数字分身 | 回答只出现一次；回答区内部定位正常；展开层级正常 | `09-avatar-answer.png` |
| 404 页面 | 正常 | `10-not-found.png` |
| 后台 | 登录入口正常 | `11-admin-login.png` |

截图目录：`artifacts/browser-captures/full-functional-audit-20260906/`

## 自动化验证

- `npm run test:avatar-ui`：通过。
- `npm run test:avatar`：通过。
- `npm run test:pdf-embed`：通过，PDF 返回 HTTP 200、`Content-Type: application/pdf`，允许 iframe 嵌入。
- `npm run test:pdf-recovery`：通过，渲染器为 PDF.js。
- `npm run test:wechat`：通过。
- `AURIA_AUDIT_BASE=http://127.0.0.1:3101 node scripts/audit-production.mjs`：28/28 通过。
- `node --check server/index.mjs`：通过。
- `node --check scripts/test-avatar-ui-regressions.mjs`：通过。
- `npm run build`：通过。
- SQLite `PRAGMA integrity_check`：`ok`；数据库共 8 张表，联系记录为 0。
- `GET /`：HTTP 200。
- `GET /api/public/bootstrap`：HTTP 200，返回 JSON。
- 3101 端口：Node PID 41880 正在监听，进程可响应。
- 当前服务器 stderr 日志为空。

## 非阻塞项与审查边界

- Vite 构建仍提示主客户端 chunk 超过 500 kB。这是性能优化提示，不影响本轮构建和运行；后续可通过路由级动态加载进一步减小首屏包体。
- 本轮后台只验证到登录入口，没有使用或索取后台密码，也没有执行新增、修改、上传或删除操作。
- 数字分身网络错误与重试状态主要由源码回归测试覆盖，本轮没有主动断网破坏正在运行的网站。
- 本轮没有生成新的移动端截图；历史移动端检查不能作为本轮新证据。

## 修改文件

- `src/App.tsx`
- `src/xiaoyang-hero.css`
- `scripts/test-avatar-ui-regressions.mjs`
- `functional-audit-and-fixes-20260907.md`
