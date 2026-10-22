# PR 巡检记录

## 2026-10-21 00:00（定时巡检）

- dsh-boot-suite：开放 PR 0
- dsh-startup-screen：开放 PR 0
- dsh-chat-wallpaper：开放 PR 0
- 结论：三个仓库无新 PR，未做任何修改。
## 2026-10-22 00:00（定时巡检）

- dsh-boot-suite：开放 PR 0
- dsh-startup-screen：开放 PR 0
- dsh-chat-wallpaper：开放 PR 0
- 结论：三个仓库无新 PR，未做任何修改。
## 2026-10-23 00:00（定时巡检）

- dsh-boot-suite：开放 PR 0
- dsh-startup-screen：开放 PR 0
- **dsh-chat-wallpaper：开放 PR 1**
  - PR #1「feat: 设置面板移入 DSH 设置（settings.section），纱的浓度放开至 100%」
  - 作者：@ArtificialAngels（PZX0X），+475 −259，4 个文件
  - 审查：改用 settings.section 注册「聊天背景」；去掉左下角浮钮；纱 80%→100%；DOM 复用；无网络/凭据/exec 风险
  - 测试：本地 clone 分支跑 `npm test`，8 个 smoke 全绿
  - 动作：squash 合并到 main（commit ff2b120），PR 留合并说明
  - 跟进：主仓库 dsh-boot-suite 需移植同一改动 → issue #1（https://github.com/LeeRolling/dsh-boot-suite/issues/1）
