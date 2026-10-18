# dsh-boot-suite

> DeepSeek Harness **开机套件**：冷启动六幕开机动画 + 聊天壁纸。
> v2.1.1 = 把原来的两个插件合并成一个包（v2.0.0 合并；v2.0.1–2.0.3 修首屏注入与黑屏；v2.1.0 聊天背景设置并入设置页；v2.1.1 缩短开幕等待、去掉重复加载）：
>
> | 功能 | 入口 | 原插件 |
> |---|---|---|
> | 开机动画（六幕） | DSH 设置页 →「启动动画」 | dsh-startup-screen v1.1.1 |
> | 聊天壁纸（开场视频 + 底图 + 大字横幅） | DSH 设置页 →「聊天背景」 | dsh-chat-wallpaper v0.2.2 |

两个半侧**各自独立**：动画坏了不影响壁纸，壁纸坏了不影响动画，界面照常进。

> **v2.0.1 修的是什么**：DSH 0.2.x 的桌面端改成 `file://` + IPC —— index.html 是打包好的静态壳，
> 启动数据以「结构化注入行」经 IPC 下发。原来的 `webServer.tapIndex` 原始字符串变换在那种部署里
> **不会被执行**，于是首帧不再是黑幕，而是先闪一下 DSH 自己的启动界面（约 1 秒）再播动画。
> 2.0.1 把首屏注入改成注入行表（服务端渲染与 IPC boot payload 共用同一张表），
> `tapIndex` 降级为 web 部署的兜底。诊断日志：`~/.dsh/boot-suite-diag.log`（最多 40 行）。

---

## 一、装

    # 桌面端：先完全退出 DeepSeek Harness Desktop
    dsh plugin --profile desktop add link:F:\Lee的GitHub仓库\DeepSeek harness 开机动画\01-源码

装完重新打开。桌面端必须先退出，否则 profile 的 package.json 被进程锁着，装不进去。

装之前如果还装着旧的两个插件，先卸掉：

    dsh plugin --profile desktop remove dsh-startup-screen
    dsh plugin --profile desktop remove dsh-chat-wallpaper

（本仓库 `04-开发脚本/02-安装合并版.cmd` 把这几步串好了，退出桌面端后双击即可。）

---

## 二、开机动画

冷启动播六幕连贯动画，不是播片，是可控序列：

    黑幕 DeepSeek 标识 → 过曝洗白 → 暖白「技术档案」底板
      → 五步交互式访问授权 → 色散故障揭幕

| # | 中文主字 | 英文副标题 | 要操作吗 |
|---|---|---|---|
| 1 | 需要访问许可 | ACCESS PERMISSION REQUIRED | 点按钮 / Enter / 空格 |
| 2 | 身份资料确认 | IDENTITY VERIFICATION | 点按钮 / Enter / 空格 |
| 3 | 接收访问需求 | ACCESS REQUEST RECEIVED | 自动 |
| 4 | 开始读取权限 | PERMISSION READ STARTED | 自动 |
| 5 | 读取完毕 · 核验通过 | READ COMPLETE · VERIFIED | 自动 |
| 6 | 欢迎「身份名称」访问 | WELCOME, NAME | 自动 |

- **中文主字 + 英文等宽副标题**（逐字打出）
- **真声台词 + 界面音效**：`lib/assets/line-1..6.mp3`，五句台词 + 终幕欢迎语；素材取不到自动回落系统 TTS
- **语音没播完不推进**：每步停留时长由实际音频决定
- **33 项设置**：身份名称 / 编号 / 权限等级 / 配色 / 速度 / 音色 / 语速 / 每处文案……
- 详细槽位见 [AUDIO-FIELDS.md](AUDIO-FIELDS.md)

配置：`~/.dsh/dsh-startup.json`（设置页改，不用手改）

---

## 三、聊天壁纸

三件事：**开场视频** + **聊天底图** + **大字横幅**。

- **开场视频**：进入聊天后全屏播一段，播完淡出进聊天；也可以放"后面"当常驻背景长期循环
- **聊天底图**：把图丢进 `~/.dsh/chat-wallpaper/` 就自动换（按修改时间取最新那张）
- **大字横幅**：铺满窗口的一行字，矢量文字，字号按窗口自动算
- **循环区间**：第一次从头播完，之后只在 `[loopStart, loopEnd]` 里循环；支持剪辑软件时间码（`00:00:05:23`）
- **等开机动画收场再播**，并且从 0 开始 —— 片头不会被开机动画吃掉
- **失败即退场**：视频放不出来就把 CSS 全部撤回，页面回原样，绝不留黑洞

配置：`~/.dsh/chat-wallpaper.json`（**DSH 设置页 →「聊天背景」** 改；原来左下角的「🖼 背景」浮层按钮已取消）
视频片库：`~/.dsh/boot-animation/videos/`（丢 mp4/webm/mov/m4v 进去，>64KB，按修改时间取最新）

---

## 四、这个包的结构

    lib/
      index.js          宿主半：把两个半侧挂在同一个 cordis 插件上
      host-startup.js   开机动画宿主管：/dsh-startup/* 路由 + index.html 首屏注入
      host-wallpaper.js 壁纸宿主管：/chat-wallpaper/* 路由 + Range 视频流
      client.js         浏览器半：一个模块 id（dsh-boot-suite），内部两个 IIFE
      splash.js         开机动画运行时
      splash.css        开机动画全部样式
      assets/           真声台词 x5 + 终幕欢迎语 + 界面音效 x2
    test/               13 套冒烟测试，零依赖
    preview/index.html  离线预览页（直接浏览器打开）
    cordis.patch.yml    一条 insert 行（dsh-boot-suite）

### 合并时守住的约定（别随手改）

- **模块 id 必须等于 bundle 行名**：`dsh-boot-suite`。改一处不改另一处会报
  `loaded without registering dsh-boot-suite`。
- **两套配置文件名没动**：`dsh-startup.json` / `chat-wallpaper.json`，老用户的设置原样生效。
- **两半的 DOM / 全局标记 / 存储键全部沿用旧名**（`#dsh-startup-root`、`#dsh-chat-wallpaper`、
  `__DSH_STARTUP_*`、`dsh-chat-wallpaper:intro-shown`、路由 `/dsh-startup/*` 与 `/chat-wallpaper/*`）。
  这些是两半互相握手的契约，改一个就断一根。
- **导出优先级**：`module.exports.apply` 先调壁纸半侧、再调开机动画半侧；
  `inject` 用开机动画的 `['slots']`（壁纸半侧自己声明的是 `[]`，会被覆盖，这是刻意的）。

---

## 五、出事了怎么救（安全网）

改代码之前都会在 `08-备份/known-good-<时间戳>/` 留一份快照。真被插件搞黑屏时：

| 工具 | 干什么 | 什么时候用 |
|---|---|---|
| `09-工具/99-急救-卸载开机动画.cmd` | 把插件从 profile 里彻底卸掉（不碰你的配置和素材） | **界面全黑、点不动**，只想先恢复界面 |
| `09-工具/98-回滚到备份.cmd` | 切回最新那个「已知可用」备份 | 想退到上一个能用的版本 |

两个脚本都要求先**完全退出桌面端**（任务管理器里结束 `DeepSeek Harness` 全部进程），
然后在资源管理器里双击即可 —— 它们不需要 DSH 界面能正常显示。

## 六、测试

    npm test

13 套冒烟测试、约 500 项断言，全过才算数。零运行时依赖、零测试框架，Node ≥ 20。

| 文件 | 测什么 |
|---|---|
| smoke-host.mjs | 开机动宿主：路由 / 栅栏 / 配置落盘 / index.html 注入 |
| smoke-splash.mjs | 开机动画运行时：六幕、语音、音效、回归断言 |
| smoke-client.mjs | 设置页「启动动画」面板：渲染 / 保存 / 恢复默认 / 预览 |
| smoke-desktop-boot.mjs | 桌面端自举：BOOT 标记 / 跳过判定 / 失败自愈 |
| smoke-wallpaper-host.mjs 等 7 个 | 壁纸宿主与浏览器半：三级回落 / 挂载幂等 / 起始闸门 / 循环区间 / 面板 |
| smoke-merge.mjs | 合并契约：一条 bundle 行、一个模块 id、两半都在、命名不互相污染 |

---

## 七、许可与致谢

MIT（只覆盖作者原创代码与文案）。视觉风格参考自动画作品，音频素材取自第三方视频，
权利归原权利人；**未授权任何商业用途**。

原作者：沈宏宏 · 合并与维护：LeeRolling
