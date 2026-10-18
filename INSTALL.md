# 安装

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

1. 设置页多出**两项**：「启动动画」（顶部版本号应为 **2.1.0**）和「聊天背景」
2. 冷启动播六幕动画，播完进聊天；随后播开场视频、落在聊天底图上
3. 左下角不再有浮层「🖼 背景」按钮（设置已并入设置页）

## 卸载

    dsh plugin --profile desktop remove dsh-boot-suite

配置文件不会自动删除，要清干净手动删：

    ~/.dsh/dsh-startup.json
    ~/.dsh/chat-wallpaper.json
