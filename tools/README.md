# tools —— 维护者工具

> 这三个脚本**不需要 DSH 界面能显示**，界面全黑时也能跑。
> 只依赖 PowerShell 5.1+ 和 node（PATH 里或 DSH 自带的 pnpm 都行）。

| 脚本 | 干什么 | 什么时候用 |
|---|---|---|
| `emergency-uninstall.cmd` | 把 `dsh-boot-suite` 从 profile 里彻底卸掉，恢复干净界面 | **开机黑屏、动画卡死、界面点不动** |
| `rollback.cmd` | 切回 `backups/` 下最新的 `known-good-*` 快照 | 想退回上一个能用的版本 |
| `make-backup.ps1` | 给当前状态留一份快照到 `backups/` | **改代码之前**（自保） |

## 用法

1. 用任务管理器结束全部 `DeepSeek Harness` 进程
2. 双击对应的 `.cmd`（或 `powershell -NoProfile -ExecutionPolicy Bypass -File xxx.ps1`）
3. 重新打开桌面端

## 参数

- `-Profile <名字>`：默认 `desktop`，也可以指定 `web` 等其他 profile
- `rollback.ps1 -Backup "backups/known-good-2026-10-18_170000"`：指定要回滚到的备份
- `make-backup.ps1`：无参数，直接生成

## 注意

- 三个脚本都会**先要求桌面端完全退出**，否则直接退出不干活 —— 这是刻意的，避免在进程锁着 profile 时写半截。
- 卸装 / 回滚都不会动 `~/.dsh/dsh-startup.json` 和 `~/.dsh/chat-wallpaper.json`（回滚会从备份里恢复它们）。
