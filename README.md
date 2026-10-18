# dsh-boot-suite

> **DeepSeek Harness 开机套件** —— 六幕开机动画 + 聊天壁纸。
> 一个插件，两个半侧：**冷启动的仪式感**，和**进入聊天后的那张底图**。
> v2.2.0 起**分幕是数据**：可以换成任意幕数（1~24）的模板。

[![release](https://img.shields.io/github/v/release/LeeRolling/dsh-boot-suite?label=release)](https://github.com/LeeRolling/dsh-boot-suite/releases)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![platform](https://img.shields.io/badge/platform-Windows%20%7C%20Web-lightgrey)](#安装)

![开机动画主画面](docs/hero.png)

![启动过程演示](docs/demo.gif)

> 演示 GIF 由 `preview/demo.html` 逐帧录制，5 秒循环。真实播放带真声台词与界面音效。

---

## 它是什么

DeepSeek Harness（DSH）冷启动时会先播六幕动画，播完进聊天，再落在你自己设的底图上：

    黑幕 DeepSeek 标识 → 过曝洗白 → 暖白「技术档案」底板
      → 五步交互式访问授权 → 色散故障揭幕 → 聊天壁纸

**不是视频文件，是代码动画**：`lib/splash.js`（1468 行）+ `lib/splash.css`（1093 行）
用 DOM + CSS 动画 + WebAudio 现场绘制，画面部分只有 ~94 KB。

| | 开机动画 | 聊天壁纸 |
|---|---|---|
| 入口 | DSH 设置页 →「启动动画」 | DSH 设置页 →「聊天背景」 |
| 内容 | 六幕序列、逐字打出的英文副标题、环形准星、色散故障 | 开场视频 / 静态底图 / 大字横幅 |
| 素材 | 5 句真声台词 + 终幕欢迎语 + 2 个界面音效（mp3） | 你自己的视频和图片 |
| 可调 | 33 项：身份名称 / 编号 / 权限等级 / 配色 / 速度 / 音色 / 语速 / 每处文案 | 视频放置方式、循环区间、纱的浓度、横幅文字 |

两个半侧**各自独立**：动画坏了不影响壁纸，壁纸坏了不影响动画，界面照常进。

---

## 安装

### 方式一：双击安装（推荐，不需要命令行）

1. 下载本仓库（Code → Download ZIP，或 `git clone`）并解压
2. **完全退出** DeepSeek Harness Desktop（任务管理器里确认没有 `DeepSeek Harness` 进程）
3. 双击根目录的 **`安装.cmd`**
4. 重新打开桌面端

脚本会自动找到 DSH 的命令行（它不在 PATH 里也没关系）、找到已初始化的 profile、
卸掉同名旧插件、以 `link:` 方式装好并修正 `bundles` 列表，最后自检。
只想看它要做什么、不动手：`powershell -File tools\install.ps1 -CheckOnly`

### 方式二：命令行

    # 桌面端：先完全退出 DeepSeek Harness Desktop
    dsh plugin --profile desktop add link:<仓库路径>


**桌面端必须先完全退出** —— 否则 profile 的 `package.json` 被进程锁着，装不进去。
（`dsh` 不在 PATH 里的话，桌面端自带的在 `%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd`）

> 从旧的两个插件（`dsh-startup-screen` / `dsh-chat-wallpaper`）迁过来的话，
> 先 `dsh plugin --profile desktop remove` 掉它们，再装本插件。

---

## 开机动画

| # | 中文主字 | 英文副标题 | 要操作吗 |
|---|---|---|---|
| 1 | 需要访问许可 | ACCESS PERMISSION REQUIRED | 点按钮 / Enter / 空格 |
| 2 | 身份资料确认 | IDENTITY VERIFICATION | 点按钮 / Enter / 空格 |
| 3 | 接收访问需求 | ACCESS REQUEST RECEIVED | 自动 |
| 4 | 开始读取权限 | PERMISSION READ STARTED | 自动 |
| 5 | 读取完毕 · 核验通过 | READ COMPLETE · VERIFIED | 自动 |
| 6 | 欢迎「身份名称」访问 | WELCOME, NAME | 自动 |

- 中文主字 + 英文等宽副标题，**逐字打出**，像终端接收数据
- **真声台词**（`lib/assets/line-1..6.mp3`），素材缺失自动回落系统 TTS
- **语音没播完不推进** —— 每步停留时长由实际音频决定
- 显示模式：每次会话 / 总是 / 每天；可要求确认，也允许跳过

配置：`~/.dsh/dsh-startup.json`（设置页改，不用手改）

## 聊天壁纸

- **开场视频**：进聊天后全屏播一段，播完淡出；也可以放最底层当常驻背景循环
- **聊天底图**：丢进 `~/.dsh/chat-wallpaper/` 就自动换（按修改时间取最新）
- **大字横幅**：铺满窗口的一行字，矢量文字，字号按窗口自动算
- **循环区间**：第一次从头播完，之后只在 `[loopStart, loopEnd]` 里循环，支持剪辑软件时间码（`00:00:05:23`）
- **等开机动画收场再播**，并且从 0 开始 —— 片头不会被覆盖
- **失败即退场**：视频放不出来就把 CSS 全部撤回，页面回原样

配置：`~/.dsh/chat-wallpaper.json`（设置页改）

---

## 模板（v2.2.0 起）

六幕不是写死的：**每一幕的文案、音频槽、按钮、停留时长都是数据**，幕数 1~24 任意。

    templates/<id>/template.json          # 插件自带
    ~/.dsh/startup-templates/<id>/template.json   # 你自己的（同 id 优先）

### 开机体验（v2.5.0）

- **不露底**：首帧在文档解析阶段就画上，DSH 自带的「HARNESS / Loading plugins…」卡片被按掉
- **标题栏收编**：桌面端片头播放时，右上角原生按钮条变透明，按钮浮在动画上（片头结束自动还回去）
- **两段式揭幕**：内容先化进自己的底色（200ms），底色再淡出（420ms）—— 不会把结尾 logo 留成灰影
- **检查更新**：设置页「启动动画」底部一键比对 GitHub 最新版本

选哪个模板：DSH 设置页「启动动画」→ 模板下拉框；或直接改 `~/.dsh/dsh-startup.json` 的 `template` 字段，留空 = 内置。

**模板商店**：设置页 →「打开模板编辑器」→ 顶栏「🏪 商店」。列表来自
[dsh-boot-suite-templates](https://github.com/LeeRolling/dsh-boot-suite-templates) 的 `index.json`，
点「安装」即落到 `~/.dsh/startup-templates/<id>/`。不建服务器、不需要登录。
格式见 [docs/模板格式.md](docs/模板格式.md)。模板**只能是数据**，运行时不会执行模板里的任何代码。
找不到模板、字段缺了、id 非法 —— 一律回落内置，不会黑屏。

---

## 出事了怎么救 🧯

这个插件注入的是**首屏**，出问题时是整块黑屏、连"跳过"都点不到。所以仓库自带三个**不依赖界面**的维护脚本：

| 工具 | 干什么 | 什么时候用 |
|---|---|---|
| **`卸载.cmd`**（根目录） | 等于 `tools/emergency-uninstall.cmd` | **开机黑屏、界面点不动**，只想先恢复 |
| `tools/emergency-uninstall.cmd` | 把插件从 profile 里彻底卸掉 | 同上，脚本本体 |
| `tools/rollback.cmd` | 切回 `backups/` 下最新的已知可用快照 | 想退回上一个能用的版本 |
| `tools/make-backup.ps1` | 给当前状态留快照 | **改代码之前** |

用法：任务管理器结束全部 `DeepSeek Harness` 进程 → 双击脚本 → 重开客户端。

诊断日志写在 `~/.dsh/boot-suite-diag.log`（首屏注入走了哪条通道、自愈有没有触发、壁纸半侧卡在哪一步）。

---

## 结构

    lib/
      index.js          宿主半：把两个半侧挂在同一个 cordis 插件上
      host-startup.js   开机动画宿主管：/dsh-startup/* 路由 + index.html 首屏注入
      host-wallpaper.js 壁纸宿主管：/chat-wallpaper/* 路由 + Range 视频流
      client.js         浏览器半：一个模块 id（dsh-boot-suite），内部两个 IIFE
      splash.js / splash.css / assets/    开机动画运行时与素材
    preview/
      index.html        交互式离线预览（带设置面板，直接浏览器打开）
      demo.html         纯净演示页（无面板，截图/录屏用）
    test/               13 套冒烟测试，零依赖
    tools/              急救 / 回滚 / 备份
    docs/               README 用的图

### 改代码前先读这三条

1. **模块 id 必须等于 bundle 行名**（`dsh-boot-suite`），四处要一致：client 的 loader id、package.json、cordis.patch.yml 的 id 和 name。
2. **首屏注入行是一次性的**：行表幂等 + 订阅互斥。重复注入 = 两个 `#dsh-startup-root` = 永久黑屏（真实事故，见 `02-文档/故障记录`）。
3. **注入外部脚本只能用 `script-src` 行**，不能用 `html` 行包 `<script>` —— 桌面端解释器按文本插入，脚本不会执行。

---

## 测试

    npm test

13 套冒烟测试、约 450 项断言，零运行时依赖、零测试框架。改 `lib/` 下任何文件都要重跑。

---

## 许可与致谢

MIT（只覆盖作者原创代码与文案）。

视觉风格参考自动画作品；音频素材取自第三方视频，权利归原权利人。
**未授权任何商业用途。**

原作者：**沈宏宏** · 合并、修复与维护：LeeRolling

模板（`archive-warm` / `deep-sonar` / 商店里的 `archive-ink`）的视觉与叙事基于沈宏宏的动画作品，
模板 JSON 里的 `author` 字段如实标注原作者，`adaptedBy` 标注改版者。