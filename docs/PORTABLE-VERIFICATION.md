# Git 恢复验收（2026-09-09）

本次在独立 Git 克隆目录使用 Node 22.22.0 / npm 10.9.4 安装，没有使用原项目的 node_modules、data、.env 或隐藏托管配置。原网站3101端口持续运行，测试使用3196/3197临时端口。

## 已完成

- 修复旧锁文件缺项导致的 `npm ci` 失败；全新安装通过。
- 默认 Vite 构建使用 Express 的 `dist/client` 入口，去除对 `.openai/hosting.json` 的依赖；构建通过。
- `content:restore` 从 Git 中的7张内容表/7个附件重建 SQLite，完整性及 SHA256 通过。
- `test:portable`：全部表行/附件往返一致、拒绝覆盖现有数据、备份无需外部 sqlite3。
- `test:cms`：24项通过，覆盖实际后台表单保存、前台回读、发布/草稿、上传引用保护、收件箱、移动端、池塘点击和重启持久化。测试使用独立数据副本，不发送飞书消息。
- `test:restored`：恢复站公开 API 与3101原站逐字段相同；7个上传附件HTTP内容哈希相同，简历PDF可获取；公开页面路由、池塘弹层、桌面/390px移动端、无未捕获页面异常。

截图保存在本地忽略目录 `artifacts/`，不作为站点依赖。代码/内容通过 Git；管理员账号、模型密钥和其他环境凭据由新电脑单独配置。外部链接/图片/字体需要网络。本次没有实际在 macOS/Linux 或另一台实体电脑运行，验证是本机独立克隆与Node22运行环境。

## 复验

完成 README 的安装和恢复后：

```sh
npm run test:portable
npm run test:cms
npm run test:restored
```

浏览器测试需要安装 Chrome 和 Playwright。脚本允许通过 `PLAYWRIGHT_MODULE` 指定 Playwright 模块绝对路径；默认路径是本次测试机的 Codex 缓存。测试不影响普通网站运行。

`test:restored` 可设置 `AURIA_TEST_ROOT` 指向另一个已安装、构建、恢复的克隆目录；可设置 `AURIA_REFERENCE_URL` 为原站根地址进行精确 API 比较。运行前确保3196/3197端口空闲。
