# 交付包说明

本次交付采用源码与数据分离，避免把生产内容误提交到 Git。

## 文件

- `auria-website-source.tar.gz`：可追溯源码，由本地 Git commit 导出，不含 `.git`、数据库、`.env`、凭据、依赖或构建产物。
- `auria-website-data.tar.gz`：SQLite 一致性快照和 `uploads/`；已清除登录 Session。
- `MANIFEST.json`：技术栈、数据数量、排除项和恢复验收结果。
- `SHA256SUMS`：归档校验值。

## 恢复

1. 解压源码包。
2. 解压数据包。
3. 将 `auria-data/auria.sqlite` 复制到源码目录的 `data/auria.sqlite`。
4. 将 `auria-data/uploads/` 内容复制到源码目录的 `data/uploads/`。
5. 按源码包中的 `MIGRATION.md` 安装、构建和启动。

生产凭据、管理员密码哈希、飞书配置、证书和 Hermes 文件不在交付包内，需要在目标机器单独配置。
