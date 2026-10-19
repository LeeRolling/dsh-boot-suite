# 安装

## 普通用户：Windows 一键安装（推荐）

1. 下载 **`dsh-boot-suite-win.zip`**（不是 `.tgz`，见下方 FAQ）
2. 右键 → **全部解压**（不要在压缩包里直接双击）
3. **完全退出** DeepSeek Harness Desktop（托盘图标也要退出）
4. 双击解压出来的 **`安装.cmd`**
5. 弹出 PowerShell 窗口 → 一路确认；安装完成后重新打开 DSH
6. 设置页应多出「启动动画」「聊天背景」两项

> 如果双击后一闪而过：右键 `安装.cmd` → 以管理员身份运行，或在 PowerShell 里执行
> `powershell -ExecutionPolicy Bypass -File .\tools\install.ps1`

## 下载了 `.tgz` 找不到安装.cmd？

`.tgz` 是给 `npm` / 命令行用户的压缩包，Windows 资源管理器**不能直接打开**，
有些解压软件还会把里面的中文文件名解成乱码（`��װ.cmd`）。

**请改下 `dsh-boot-suite-win.zip`**：解压后根目录第一个文件就是 `安装.cmd`。

## 开发者 / 命令行安装

## 桌面端（DeepSeek Harness Desktop）

    1) 完全退出桌面端（任务管理器里不要留进程）
    2) dsh plugin --profile desktop add link:<本仓库路径>\01-源码
    3) 重新打开桌面端

桌面端必须在**完全退出**的状态下装 —— profile 的 package.json 由桌面端进程加锁管理。

装之前若还装着旧的两个插件，先卸掉：

    dsh plugin --profile desktop remove dsh-startup-screen
    dsh plugin --profile desktop remove dsh-chat-wallpaper

## web profile

    dsh plugin --profile web add link:<本仓库路径>\01-源码

## 换装后要确认的三件事

1. 设置页多出**两项**：「启动动画」（顶部版本号应为 **2.7.0**）和「聊天背景」
2. 冷启动播六幕动画，播完进聊天；随后播开场视频、落在聊天底图上
3. 左下角不再有浮层「🖼 背景」按钮（设置已并入设置页）

## 卸载

    dsh plugin --profile desktop remove dsh-boot-suite

配置文件不会自动删除，要清干净手动删：

    ~/.dsh/dsh-startup.json
    ~/.dsh/chat-wallpaper.json
