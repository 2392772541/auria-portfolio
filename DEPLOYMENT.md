# Linux 正式部署

推荐架构：Caddy 对外提供 HTTPS，Auria 只监听 `127.0.0.1:3000`，systemd 负责进程管理，代码、配置和数据分离。

## 目录建议

- 代码：`/opt/auria-hero/releases/<timestamp>`
- 数据：`/var/lib/auria-hero/data`
- 环境文件：`/etc/auria-hero/auria.env`
- 备份：`/var/backups/auria-hero`

生产环境文件至少需要 `ADMIN_EMAIL`、`ADMIN_PASSWORD_HASH`，可选飞书变量见 `.env.example`。环境文件建议 `root:root 0640`，不得进入代码仓库。

示例文件位于 `deployment/auria-hero.service.example` 和 `deployment/Caddyfile.example`。部署新机器时应重新配置域名并由 Caddy 重新签发证书，不复制旧服务器私钥。

部署前：创建一致性备份；部署后：检查服务、127.0.0.1:3000、HTTPS、公开 API、后台 401、数据库完整性和错误日志。当前线上服务不因本迁移包自动变更。
