# 数字分身功能审查报告

审查日期：2026-09-04  
审查对象：首页“小羊数字分身”及后台数字分身配置  
本地环境：`http://127.0.0.1:3101/`

## 结论

数字分身的主要功能可用：访客可以展开、提问、使用推荐问题、收到回答、清空和折叠；管理员可以保存名称、欢迎语、提示词、知识和固定问答。自动测试与生产构建均通过。

当前不建议直接把它视为完全完成。需优先修复“重试重复插入问题”和网络错误文案；手机端长回答的阅读空间也应优化。

## 已验证流程

| 编号 | 检查项 | 状态 | 结果 |
| --- | --- | --- | --- |
| 01 | 桌面端展开与折叠 | 正常 | 面板可正常开合，折叠后焦点留在触发按钮 |
| 02 | 自由输入与 Enter 提交 | 正常 | 输入问题后可通过 Enter 发送 |
| 03 | 推荐问题 | 正常 | 三个推荐问题均可触发对话 |
| 04 | 回答期间状态 | 正常 | 输入框、发送和推荐按钮会禁用，显示“正在整理回答…” |
| 05 | 清空对话 | 正常 | 对话可恢复到初始欢迎状态 |
| 06 | 网络错误与恢复 | 部分正常 | 能显示错误并重试，但错误文案和重试逻辑需要改进 |
| 07 | 后台读取与保存 | 正常 | 保存后显示“数字分身设置已保存”，未破坏前台配置 |
| 08 | 390×844 手机端 | 部分正常 | 无横向溢出，浮层可操作；长回答阅读区域偏拥挤 |
| 09 | 控制台错误 | 正常 | 正常提问过程中未捕获业务 console error 或 page error |
| 10 | 自动测试与构建 | 正常 | `npm run test:avatar`、`npm run build`、Node 语法检查通过 |

## 主要问题

### P1：点击“重试”会重复插入同一条用户问题

错误后的重试再次调用发送函数，而发送函数固定向消息列表追加用户问题。因此界面会出现两条相同问题。重试应复用原消息，只重新发起请求。

### P1：网络错误直接暴露英文技术信息

服务不可用时可能显示 `Failed to fetch`。这对普通访客不可理解，也容易让页面显得未完成。建议统一成中文，例如“暂时无法连接数字分身，请稍后重试”。详细错误只写入开发日志。

### P2：手机端长回答阅读空间不足

390px 宽度下，展开面板本身可用且没有横向溢出，但长回答会占据页面顶部的大块区域，并自动滚到回答底部。用户容易错过回答开头，继续输入时也需要在较小区域内阅读和操作。

### P2：在线状态含义不准确

界面固定显示 `ONLINE`，但它没有反映 AI 上游服务是否真的可用。建议改成不承诺实时可用的文字，或根据一次轻量健康检查显示真实状态。

### P2：输入框和清空按钮的无障碍名称不足

输入框目前依赖 placeholder，没有独立 label 或 `aria-label`。清空按钮只有 `title="清空对话"`。鼠标用户可操作，但读屏软件识别不够可靠。发送按钮已有 `aria-label="发送"`；键盘 Tab 顺序和 Enter 提交已验证可用。

## 手机端证据

![数字分身手机端初始入口](artifacts/browser-captures/full-functional-audit-20260904/22-avatar-mobile-initial.png)

![数字分身手机端展开状态](artifacts/browser-captures/full-functional-audit-20260904/23-avatar-mobile-expanded.png)

![数字分身手机端长回答](artifacts/browser-captures/full-functional-audit-20260904/25-avatar-mobile-answer-final.png)

## 后台证据

![后台数字分身配置](artifacts/browser-captures/full-functional-audit-20260904/20-admin-digital-avatar.png)

![后台保存成功](artifacts/browser-captures/full-functional-audit-20260904/21-admin-avatar-save-success.png)

## 验证命令

```powershell
npm run test:avatar
npm run build
node --check server\index.mjs
node --check scripts\test-digital-avatar.mjs
```

以上检查于 2026-09-04 全部通过。构建只有 bundle 体积较大的警告，不影响本次数字分身功能结论。

## 证据边界

本轮确认的是本地 Chrome 环境下的功能、390px 手机视口、键盘基本路径、后台保存和正常请求过程。没有声称达到完整 WCAG 合规，也没有覆盖 iOS Safari、Android 实机软键盘、弱网抖动、多人并发、上游模型限流或生产环境长期稳定性。
