# 全境大肥鱼 · Codex 版采用与接入交接

> 2026-10-31 · Lead 归档。用户决定：**以 Codex 版（division-editable）为基底**，替代我们此前的 p6 融合版。
> 本目录 `01-源码/docs/proto/division-codex/` 是从 Codex 原始目录复制并做「可渲染 + 参数化」适配后的工作副本；**原仓库既有文件未改**。

## 1. 文件清单

| 文件 | 说明 |
|---|---|
| `index.html` / `app.js` / `motion.js` / `voice.js` / `style.css` | Codex 原版（未改结构） |
| `config.js` | 已改为我们的默认值：`username='人类与AI的日常'`、tip1 文案、`duration 25.92`、`loadingStart 9.2`、进度曲线按参考实测重排（63% 保持到 25.4s、25.45 跳 100%） |
| `render.html` | 渲染用副本：隐藏右侧编辑侧栏、`?t=<秒>` 定格帧（通过 `#seek` input 事件驱动 `seek()`） |
| `render_frames.py` | Chrome headless 逐帧渲染 → `division-codex-1080p30.mp4`；3 线程、独立 user-data-dir、失败重试 |
| `division-codex-1080p30-audio.mp4` | 成片：1920×1080 / 30fps / 25.92s / 2.06MB，混入原片环境声（`division-code/render/src-audio.m4a`） |
| `still-2/5/12/16/25.png` | 成片抽帧 |
| `compare-ref-vs-codex.png` | 参考（左）vs Codex 版（右）t=2/5/12/16/25 对比 |

## 2. 架构与参数

纯 **SVG + JS** 参数化动画（无视频、无位图、无逐帧数据）；全部参数集中在 `config.js`：

```js
window.CONFIG = {
  username, title, description,       // 可编辑文字
  duration: 25.92, loadingStart: 9.2, // 时间轴
  progress: [[9.2,0],[10,10],...,[25.45,100],[25.92,100]], // 进度曲线
  voiceY, voiceWidth,                 // ISAC 波形条位置/宽
}
```

- 动画状态机在 `motion.js`（`HUDMotion.state(t)`）：展开/退场/重新展开/脉冲/呼吸/闪入，纯解析函数，可任意 seek。
- 进度弧、百分比、状态文字、tips 面板、ISAC 波形均由 `app.js` 每帧重绘；`render.html` 通过 `#seek` 控制时间。
- 右侧 `aside` 是 Codex 自带的可编辑侧栏（username/heading/body、播放、跳转、导入语音、保存 JSON、恢复默认）；渲染版已隐藏，**功能保留给插件侧移植**。

## 3. 接入插件（给插件维护上下文）

引擎（splash.js）当前只支持 `steps` 与 `layers` 两种模板，Codex 版是独立 HTML/SVG 应用，建议新增**第三种模板类型 `html`**：

- 模板目录：`%DSH_HOME%\startup-templates\bigfish-division-html\`（或打包进插件 `templates/`），含 `index.html` + `config.js` + `app.js` + `motion.js` + `voice.js` + `style.css`。
- 播放：在启动层内用 `<iframe>`（或 ShadowRoot）加载 `template-asset/bigfish-division-html/index.html?username=<encodeURIComponent(username)>`；iframe 内读 query 合成 `CONFIG`，或宿主 `postMessage({type:'config',...})`。
- 跳过：宿主顶部显示「跳过 ▸」，点击/ESC 时 `iframe.contentWindow.postMessage({type:'skip'})`；动画 25.92s 结束 `postMessage({type:'done'})` 由宿主收尾。
- 设置面板：仿档案暖白专属组，仅在模板选中时显示 `连接用户名`（及未来 tips 编辑、语音导入）；默认值来自 `config.js`。
- 音频：可直接复用 `audio.m4a`（原片环境声）作为模板资产，或允许用户导入。

**参数契约（最小集）**：`username`、`title`、`description`（tips 第 1 条）、`duration`（默认 25.92）、可选 `voice`（音频文件 + 开始时间）。

## 4. 与参考的差距（诚实说明）

`compare-ref-vs-codex.png` 左=参考 V3（无鼠标），右=Codex 版：

1. 环几何为几何重建：参考亮弧带 r≈50–62（stage 1280×720），Codex 更内收、外层刻度更细；无 bloom 光晕层。
2. 字体：参考是横向压缩 DIN 类；Codex 用系统字体，中文更宽。
3. 百分比/状态文字位置与字号略不同；tips 面板行距/字距为近似。
4. ISAC 波形条：参考原片没有，是 Codex 新增（用户要求保留）。
5. 无鼠标移动（已按用户要求）。

用户评估：约 85% 接近目标。后续打磨方向：字体横向压缩、环几何/亮度权重、面板排版细化；插件接入 = 交给插件上下文。

## 5. 复现命令

```powershell
$py = 'C:\Users\Admin\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe'
& $py 'F:\Lee的GitHub仓库\DeepSeek harness 开机动画\01-源码\docs\proto\division-codex\render_frames.py'
# 输出 division-codex-1080p30.mp4，再与 src-audio.m4a 混流（见上）
```

单帧：`render.html?t=12.34`（Chrome headless `--window-size=1920,1080 --screenshot`）。

## 6. v3 调整（2026-10-31 晚）

- `config.js` 新增 `startAt:3`：动画从源时间 3.0s 起播，有效时长 **22.92s**（25.92−3）。
- `app.js`：初始 `t=startAt`；播放结束/重播/连接按钮都回 `startAt`；seek 下限 `startAt`；时间显示按有效时长；**「连接中」始终显示为「连接中：<username>」**（不再在 3.05s 后切成纯「连接中」）。
- 成片 `division-codex-1080p30-audio.mp4` 已按 3.0→25.92 重渲并裁掉音轨前 3s（22.92s）。注意：源片 3.0–4.3s 本身是转场黑场，所以成片开头约 1s 黑屏属于原有转场，不是丢帧。
- 插件侧接入时：iframe 加载后 `duration` 用 22.92，进度/事件时间仍按源时间（绝对），或把 `startAt` 传给页面。

## 7. v7 新增参数与行为（2026-11-01 更新）
- `startAt:3`：跳过源片前 3 秒（源 3.0–4.3s 本身是黑场转场，故开头约 1.3s 黑属正常）。
- `speedStart:9.2, speed:1.5, speedEnd:25.45`：加载段 1.5 倍速（页面时钟按 dt 增量、仅该区间乘 1.5；音频在成片里用 atempo 同步，页面用 syncAudio 跟随 t）。
- 进度条从 0% 起：`progress` 曲线首段为 `[9.2,0],[10,0],[10.9,0],[11.5,10]`，保证加载界面淡入后先显示 0% 再走。
- 右上角「跳过 ▸」按钮：`style.css` 中 `#skip` 系列样式 + `app.js` 末尾注入；点击/Esc 触发 `dsh-startup-skip` 事件、`parent.postMessage({type:'dsh-startup-skip'})`、`window.__DSH_SKIP__()`。插件宿主要接这三者之一（建议 postMessage）。
- 成片时长 17.5s（= 6.2s 连接/黑场 + 10.833s 加载@1.5x + 0.467s 尾部停留）；mp4 内跳过按钮为画面固定元素，交互页里才可点击。

## 8. v8 新增：掉线彩蛋 + 首帧修正（2026-11-01）

### 8.1 首帧「闪一下」修正
- `config.js` 的 `startAt` 由 3.0 改为 **3.4**（落在源片 3.05–4.30 的黑场里），视频第一帧即纯黑；`render_frames.py` 同步 `S0=3.4`。

### 8.2 彩蛋触发
- 参数（`config.js` 的 `egg`）：`{chance:0.28, at:9.2}`；`chance` 为每次启动的触发概率，`at` 为判定时间点（源片时间，即加载阶段开始）。
- 逻辑（`app.js` 末尾 `掉线彩蛋` IIFE）：动画播放到 `t>=egg.at` 时掷一次 `Math.random()<chance`，命中则**硬切**到掉线画面；每次启动**只判定一次**。`?egg=1` 可强制触发（用于测试/录制）。
- 硬切：暂停播放与音频、隐藏「跳过」按钮（`body.egg-on #skip{display:none}`）。

### 8.3 掉线画面
- 结构：`assets/egg-bg.png` 底图 → `#egg-veil` 半透明白纱（`rgba(232,238,246,.42)` + `backdrop-filter: blur(3px)`）→ `#egg-card` 错误对话框。
- 对话框按用户截图重建为 HTML/CSS（便于按钮可点、文字可改）：橙色「!」+「错误」、《The Division®》服务目前无法使用，请稍后再试。、红色 `DELTA` / `C-0-1302` 条、按钮「重新连接」。
- 文案/错误码在 `index.html` 的 `#egg-card` 内，可直接改；如需换成用户原始截图作为纯图层，可把 `#egg-card` 的背景图换成 PNG（但会失去按钮交互）。

### 8.4 重新连接与结束
- 点击「重新连接」：关闭彩蛋 → `seek(loadingStart)` → `playing=true`，**重播进度条 0%→100%**。
- 到达结尾（`t>=duration-0.02`）：`flashDone()` 白闪 260ms，然后依次触发：
  1. `document` 事件 `dsh-startup-done`
  2. `parent.postMessage({type:'dsh-startup-done'}, '*')`（iframe 场景）
  3. `window.__DSH_DONE__()`（若宿主提供）
- 宿主（插件）应在收到 `dsh-startup-done` 后关闭启动画面、进入主界面；「跳过」保持原有 `dsh-startup-skip` 三种握手。

### 8.5 暴露的调试接口
- `window.__DSH_APP__ = {play,pause,seek,showEgg,flashDone}`；`?egg=1` 强制彩蛋、`?play` 自动播放、`?showegg` 直接展示彩蛋画面（截图/录制用）。

### 8.6 v8 成片
- `division-codex-v8-normal.mp4`：17.4667s，正常路径（末尾 0.35s 白闪）。
- `division-codex-v8-easteregg-demo.mp4`：19.6667s，演示彩蛋路径（5.8s 连接 → 2.2s 蛋画面 → 11.3s 重播加载 → 0.35s 白闪）；随机性无法在成片里体现，仅作视觉演示。
- 音频待用户重做，两版均为无声。

## 9. v9 修改（2026-11-01）：文案 / 黑纱 / 固定概率 / 配音

### 9.1 文案与纱
- 错误文案：《The Division®》… → **《战术大肥鱼®》服务目前无法使用，请点击重试按钮。**
- 纱：白纱 → **黑纱**（`rgba(6,8,12,.55)` + `backdrop-filter: blur(3px) saturate(.85)`），底图与对话框不变。
- 「跳过」在彩蛋期间仍隐藏（`body.egg-on #skip{display:none!important}`）。

### 9.2 触发概率
- 固定 **28%**（`app.js` 顶部 `var EGG_CHANCE=0.28`），用户不可调，也不走 `config.js`。
- 调试：URL 加 `?egg=1` 强制触发、`?mute=1` 静音（含配音）。

### 9.3 配音
- 源：`C:\Users\Admin\Downloads\Music\全境封锁主题-配音-完整-男-V2.wav`（8.722s，3 句）。
- 切句（已生成）：`assets/voice-line1.wav`（2.650s，第 1 句）、`assets/voice-line3.wav`（2.772s，第 3 句）；中间的【身份确认】跳过。
- 播放规则（`app.js` 彩蛋 IIFE）：
  - 第 1 句：源时间 `voice.line1At=4.6s`（「连接中：用户名」显示后）播放一次；
  - 第 3 句：源时间 `voice.line3At=25.45s`（进度 100%）播放一次；
  - 彩蛋硬切（`showEgg`）→ `stopVoice()` 立刻 `pause()` 并 `currentTime=0`，配音中断；
  - 正常结束：到 `duration-0.02` 后若第 3 句还没播完，最多等 **3500ms**，播完（或超时）才白闪并 `doneEmit`；
  - 重播（点「重新连接」）只重置第 3 句，第 1 句不重播。
- 时间参数均可改：`config.js` 的 `voice.line1At/line3At`。

### 9.4 成片（含配音，静音底混音）
- `division-codex-v9-normal.mp4`：**20.1667s**（17.1s 动画 + 2.7s 100% 停留等台词 + 0.35s 白闪）；
- `division-codex-v9-easteregg-demo.mp4`：**22.3667s**（5.8s 连接 + 2.2s 彩蛋 + 11.3s 重播 + 2.7s 停留 + 0.35s 白闪）；
- 配音落点：第 1 句 in 1.2s；第 3 句 normal in 17.033s、demo in 18.833s。

## 10. v10：四句英文配音 / 波形动画 / ISAC→DSH / 最终时间轴（2026-11-01）

- 配音 4 句（`assets/voice-line1..4.wav`，来自 `全境封锁主题-配音-完整-男-补充.wav`）：line1 3.375s、line2 3.232s、line3 3.300s、line4 1.911s（line4 = "Alert. Agent offline."）。
- 成片时间轴：line1 `1.20s`、line2 `6.60s`、line3 `16.63s`（100% 时）、彩蛋 line4 `硬切后 +1.0s`；音频轨已生成为 `audio-normal.m4a`（20.283s）与 `audio-demo.m4a`（22.483s）。
- 波形动画：`voice-env.js`（4 句 8ms RMS envelope，条数 422/404/413/239）；`app.js` 按 `window.VOICE_SCHED` 命中时用 envelope 驱动 20 根波形条，说话才出现、说完消失；高度公式 `4+min(440, amp^0.8*440)`，`cfg.voiceWidth` 改 520 放大整组。
- ISAC→**DSH**：`voice.js` 的字母路径替换为 `<text>DSH</text>`（字号 178、字距 18、fill #e8e5d9），保留左侧小方块（四角方块）与波形；彩蛋文案统一为「《战术大肥鱼®》服务目前无法使用，请点击重试按钮。」。
- 彩蛋：概率固定 `EGG_CHANCE=0.28`（不可调，`?egg=1` 强制）；硬切时立即 `stopVoice()` 静音；点「重新连接」重播进度条 0→100%；结束等 line3 播完（≤3500ms）再白闪 260ms → `dsh-startup-done` / postMessage / `__DSH_DONE__`。
- 成片：`division-codex-v10-normal.mp4`（20.283s，1920×1080/30fps）、`division-codex-v10-demo.mp4`（22.483s，含彩蛋路径演示）；静默底片 `division-codex-v10-silent.mp4`。


## 11. v11：恢复原始两句 + 彩蛋硬性时序 + 蛋内 DSH 波形（2026-11-01）

### 11.1 恢复「最开始的第一句与第三句」
- 旧文件在 v10 被覆盖，现从 `v9-normal-audio.m4a` 精切恢复（不是从母版猜）：
  - `assets/voice-orig1.wav`：v9 音频 1.20–3.85s（2.65s）
  - `assets/voice-orig3.wav`：v9 音频 17.03–19.80s（2.77s）
- 总时间轴改为 5 句（页面时间，秒）：
  `[4.6 orig1 2.65] [8.0 line1 3.375] [12.8 line2 3.232] [17.9 line3 3.300] [25.45 orig3 2.77]`
- 对应成片时间（video）：orig1 1.2、line1 4.6、line2 8.2、line3 11.6、orig3 16.633。

### 11.2 彩蛋硬性时序
- 掉线画面出现后：**静默 2s** → 播 `voice-line4`（"Alert. Agent offline."，1.911s，同时 DSH 波形）→ 说完再**静默 2s** → 自动重播进度条 0%→100%。
- 参数：`voice.eggLineAt:2.0`、`voice.eggReplayWait:2.0`、`voice.line4Dur:1.911`；彩蛋总时长 2+1.911+2=5.911s。
- 「重新连接」按钮保留：点击立即重播（不等）。彩蛋期间隐藏「跳过」。

### 11.3 蛋内 DSH
- `ensureEggVoice()` 在 `#egg` 内动态建 SVG（与主画面同 `voiceWidth/voiceY` 变换），`eggVoice(vt)` 用 `VOICE_ENV.line4` 的 8ms 包络做历史采样波形；只在 line4 期间显示。
- 「ISAC」标签已在 `voice.js` 改为 `<text>DSH</text>`（字号 178、字距 18）。

### 11.4 文件与渲染
- `index.html` / `render.html` 重建为 UTF-8（原文件 GBK 损坏不可恢复），中文正常；`render.html` 支持 `?t=秒`、`?egg=1&eggt=秒`、`?play`。
- 帧渲染：normal 513 帧（S0=3.4、V1=5.8、V2=16.6333、VD=17.1）；egg 177 帧（5.911s）。
- 成片：normal 20.283s（head + loading + hold 3.3 + 白 0.35）；demo 26.183s（head 5.8 + egg 5.911 + 重播 10.833 + hold 3.3 + 白 0.35）。
- 音频：`audio-normal-v11.m4a`（20.283s）、`audio-demo-v11.m4a`（26.194s）；demo 中 line1 在硬切处截断为 1.2s。

### 11.5 已知取舍
- 音频无 BGM（用户后续另配）。
- 蛋画面 DSH/波形位置沿用主画面 voice 组参数；若想更大可调 `config.voiceWidth`（现 520）。

### 11.6 v11 成片核对（2026-11-01）
- `division-codex-v11-normal.mp4`：1920×1080/30fps、**20.283s**、1,028,042B；抽帧 v11n-1.5/5.5/17.0/19.9 通过（连接态 orig1 波形、line1 波形、100% 处 orig3 波形、末尾白闪）。
- `division-codex-v11-demo.mp4`：1920×1080/30fps、**26.183s**、1,264,796B；抽帧 v11d-6.5/9.0/11.8/25.9 通过（蛋画面无波形→line4 波形出现→replay 0%→末尾白闪）。
- 已知可调：normal 波形整体偏细（高度系数 `4+min(440,pow(amp,.8)*440)`，如要更明显可把 440 提到 560–600 重渲）；蛋内 DSH 位置/大小沿用主画面 voice 参数（`voiceWidth 520 / voiceY 908`）。

### 12. v12 波形修复（2026-11-01）
- 波形：普通版原先 20 根柱等高（`4+min(440,amp^0.8*440)`），现改为逐柱历史采样 `st=max(0,vt-(19-k)*0.055)`、`h=4+min(360,amp^0.9*360)`；`VOICE_ENV` 重新按 p95 归一生成 7 组包络（orig1/line1/line2/line3/orig3/line4/reconnect，8ms RMS）。
- DSH 行：opacity 不再乘提示条 `labelOpacity`，只在说话窗口内显示；100% 后的静止段改为 99 帧 hold 段（`?hold=` 推进 voice 时间），第五句波形继续推进，不再冻屏。
- 掉线：延迟 2s→1s（`eggLineAt=1.0`）；蛋时长 1+1.911+2=4.911s（148 帧）；返回后清空蛋层波形；新增 `voice-reconnect.wav`（2.821s）在重播 0% 处播放，说完 +0.5s 接 line3，最后 orig3。
- 时间轴（成片时间）：normal 20.334s——orig1 1.2 / line1 4.6 / line2 8.2 / line3 11.6 / orig3 16.633；demo 25.233s——orig1 1.2 / line1 4.6(截 1.2s) / line4 6.8 / reconnect 10.733 / line3 14.054 / orig3 21.567。
- 成片：`division-codex-v12-normal.mp4`（20.334s/1,078,114B）、`division-codex-v12-demo.mp4`（25.233s/1,236,673B），1920×1080/30fps，无声（BGM 待接）。
- 核对帧：v12n-1.5/5.5/19.0；v12d-7.5/11.2/13.8/14.3/21.6。

### 13. v13 语音动画与音频对齐修复（2026-11-01）
- 根因：`VOICE_SCHED` 原为「页面时间」，加载段页面时间以 1.5× 推进，导致语音窗口被压短 1.5×；音频 wav 按视频时间 1:1 播放 → 话没说完 DSH/波形先结束（实测早退 0.7/1.06/1.1s）；蛋层 `eggVoice` 不控制整行显隐 → line4 说完 DSH 仍停留到重播。
- 改法：`app.js` 引入视频时间 `VT`（`window.__VTIME__` 优先，否则由页面 t 反算），`VOICE_SCHED` 的页面 at 转为视频 at（`at<=9.2?at-3.4:5.8+(at-9.2)/1.5`），dur 保持音频秒；波形取 `VT-atV`。demo 用 `window.__VSCHED__`（视频时间）。`eggVoice` 在 `vt<0||vt>=line4Dur` 时隐藏整行。
- 渲染参数：`render_v12.py` 新增 `vtime=`（normal `i/30`、hold `16.6333+i/30`、replay `10.7333+i/30`、egg 不变）。
- 自检方法：`C:\Users\Admin\AppData\Local\Temp\divwork\audit.py`（裁剪 (760–1080,895–955) 最大灰度判 DSH 行 + 音频 8kHz/30fps RMS>0.01 判说话），要求 DSH 区间与音频区间误差 ≤0.1s。

- v13 复核（audit.py）：normal DSH 区间 (1.2,3.87)/(4.6,8.0)/(8.23,11.43)/(11.6,14.9)/(16.73,19.5)，对应语音结束 3.7/8.0/11.47/14.93/19.2，末段提前消失问题消除（末句留 0.3s 尾巴）；demo 抽帧 6.2s 无 DSH、7.0s 有、10.0s（line4 说完）无；replay 14.07–17.37 为 line3 DSH，13.57 后 0.5s 空档无 DSH。
- 成片：normal 20.334s/1,086,513B、demo 25.233s/1,242,806B（1920×1080/30fps，无声）。

### 13.1 v13.1 修复 100% 前 DSH 单帧闪烁（2026-11-01）
- 现象：normal 在 16.7s（100% 附近）DSH 行出现一帧「消失」。
- 根因：主段末帧 VT=16.6333 与 orig3 窗口起点 atV=16.63333（浮点）判定为「未开始」，而 100% 静止段首帧却按 16.6333 起算，造成 on→off→on。
- 修法：`app.js` 语音窗口比较加 20ms 容差 `VT>=s.at-0.02`；重渲 hold 段与边界帧后重编；逐帧复核 495–510 帧：100% 前（≤16.6s，64%）无 DSH，100% 帧起 DSH 持续显示，无 off 帧。
- 成片：`division-codex-v12-normal.mp4` 20.3337s/1,087,006B、`division-codex-v12-demo.mp4` 25.2333s/1,242,829B。
- 彩蛋时间：验收 demo 固定掉线点为可复现；真实交互页随机 0.28（每次启动只判定一次），`?egg=1` 可强制。
