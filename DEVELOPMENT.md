# 本地开发

## 原则

- 当前视觉、路由和业务逻辑为迁移基线；局部需求优先局部修改。
- 不将 `node_modules`、`dist`、`data`、`migration-data` 或 `.env` 提交 Git。
- `better-sqlite3` 包含本机原生模块，换系统后必须重新执行 `npm ci`。
- 前端开发使用 `npm run dev`；需要验证后台和真实 API 时，先 `npm run build`，再 `npm start`。

## 修改后最小验证

1. `npm run build`
2. 使用独立 `AURIA_DATA_DIR` 启动服务。
3. 打开关键页面并检查 `/api/public/bootstrap`。
4. 确认未登录后台接口仍为 401。
5. 涉及数据时运行 SQLite 完整性检查并备份。
