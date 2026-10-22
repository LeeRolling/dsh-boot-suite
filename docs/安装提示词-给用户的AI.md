# 安装提示词（给其他用户的 AI 用）

> 用法：让用户把下面整段贴进他的 DSH / Claude / Codex 助手，AI 会按步骤准备并指导安装。

```text
你是我的 Windows 电脑助手。请帮我安装 DeepSeek Harness 的开机动画插件 dsh-boot-suite（开源，MIT）。

目标：装好后冷启动 DSH 有片头动画，进聊天后设置里能看到「启动动画 / 聊天背景」。

边界（必须遵守）：
- 只动安装插件所需的东西；不要删除或改写我 ~/.dsh 下的模板、配置、聊天记录。
- 不要用管理员权限做无关操作；不要执行来源不明的脚本。
- 不要擅自结束 DeepSeek Harness 进程。

步骤：
1. 确认系统是 Windows 10/11，并检查 DSH 是否正在运行。
   如果在运行，只提醒我：「请完全退出 DSH（窗口 + 右下角托盘），退出后告诉我」。不要自己杀进程。
2. 下载最新版安装包：
   https://github.com/LeeRolling/dsh-boot-suite/releases/latest/download/dsh-boot-suite-win.zip
   保存到 %USERPROFILE%\Downloads\dsh-boot-suite-win.zip。
3. 解压到固定目录，例如 %USERPROFILE%\Downloads\dsh-boot-suite\。
   检查目录里至少有：安装.cmd、工具目录 tools\install.ps1、诊断.cmd。
4. 告诉我去双击「安装.cmd」，并说明：装完把窗口最后 10 行发给你。
5. 我装完后，你验证：
   - 读 %USERPROFILE%\.dsh\profiles\desktop\package.json：
     dependencies 和 dsh.profile.bundles 里应有 dsh-boot-suite；
   - 确认 %USERPROFILE%\.dsh\profiles\desktop\node_modules\dsh-boot-suite 存在；
   - 若存在 %USERPROFILE%\.dsh\profiles\web，也同样检查一遍。
6. 告诉我接下来：重新打开 DSH → 设置页找「启动动画」，选模板；聊天里点左下角或设置里的「聊天背景」调壁纸。
7. 如果安装失败：让我运行安装目录里的「诊断.cmd」，把桌面生成的 dsh诊断-*.txt 内容总结给你；
   不要让我反复重试超过 2 次。

输出要求：每一步给一句结果；最后给一个「接下来我要做的 3 件事」清单。
```

## 如果用户不想让 AI 代劳，给他这段手动步骤

1. 完全退出 DeepSeek Harness（窗口 + 托盘）
2. 下载：https://github.com/LeeRolling/dsh-boot-suite/releases/latest/download/dsh-boot-suite-win.zip
3. 解压，双击 `安装.cmd`
4. 装完重开 DSH；设置页找「启动动画」
5. 出问题：双击 `诊断.cmd`，把桌面生成的报告发给作者

## 备选：一条命令安装（PowerShell）

```powershell
irm https://raw.githubusercontent.com/LeeRolling/dsh-boot-suite/main/install-online.ps1 | iex
```

> 注意：命令行安装同样要求 DSH 已完全退出。
