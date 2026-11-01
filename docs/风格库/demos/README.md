# 风格 IR demo · 10 个 3 秒循环

> 目的：证明「**风格 → IR → 预览**」这条链能跑通 —— 一份风格 JSON + 一个通用播放器，就能把 10 种截然不同的视觉风格渲染成**首尾无缝、确定性可复现、不丑不错位**的 3 秒循环。
> 这里的 IR 是"成品包"层（stylePack），规格见 [`anim-ir.md`](./anim-ir.md)。

**打开方式（离线，双击即可）**

```
F:\Lee的GitHub仓库\DeepSeek harness 开机动画\01-源码\docs\风格库\demos\index.html
```

无需服务器、无 CDN、无字体文件、无图片素材；`file://` 直接可跑。

---

## 1. 文件清单

| 文件 | 作用 |
|---|---|
| `anim-ir.md` | **IR 规范**：stylePack 字段、39 个原语、参数动画语法、`render(t)` 契约、确定性要求 |
| `ir-player.js` | **通用播放器**：零依赖 Canvas2D，1920×1080 逻辑画布 + DPR 适配、mulberry32 种子随机、26 种缓动、安全区/网格辅助线、39 个原语、`renderStyle(pack, t)` |
| `styles/*.json` | **10 个风格包**（每个 3 秒、首尾参数一致） |
| `index.html` | **网格页**（由 `tools/bundle.mjs` 生成，内联播放器与 10 份 JSON） |
| `README.md` | 本文件 |
| `package.json` | 仅供 node 侧跑工具（声明 `type: commonjs`） |
| `tools/selftest.mjs` | 无浏览器自检：解析 / `validatePack` / 首尾一致 / 确定性 / save-restore 配平 / 耗时 / 覆盖率 |
| `tools/audit.mjs` | 版式体检：包围盒是否越出画布、文字是否横向溢出 |
| `tools/bundle.mjs` | 把 `styles/*.json` + `ir-player.js` 内联成单文件 `index.html` |
| `tools/index.template.html` | 网格页模板（`{{PACKS}}` / `{{PLAYER}}` 两个占位符） |
| `tools/probe.mjs` + `tools/shot.ps1` | 目视验证：生成"一个风格 × 多个时间点"探针页，用 headless Chrome 截图到 `tools/_shots/` |
| `tools/solo.mjs` | 单原语调试图：只渲染某一条 entry，打印它的绘图调用序列 |
| `tools/audit.allow.json` | 版式体检白名单（只放过"有意"的画布外内容，如字雨从画面上方落下） |

---

## 2. 网格页怎么用

| 操作 | 效果 |
|---|---|
| `空格` | 播放 / 暂停 |
| `重播` | t 归零 |
| `0.5×` / `0.25×` / `1×` | 慢放（看细节与接缝） |
| `辅助线` | 安全区 + 三分线 + 中心十字 + 12 栏（品红/青） |
| 点任意格子 | 放大单 demo（`←`/`→` 切换，`Esc` 关闭） |
| HUD | `t = x.xxxs · 帧 f/180 · lod 0.50 · 渲染 x.xms` |

细节：

- **逻辑帧量化**：`t = floor(frame) % 180 / 60`，所以即使 120/144Hz 屏也只有 180 个离散状态，逐帧比对才有意义。
- **自动 LOD**：每 400ms 统计"每格平均渲染毫秒"，>9ms 降 `lod`（0.5→0.2），<3.2ms 回升；粒子/网点/字符数按 `lod` 缩，缩略图不卡，放大时用 `lod = 1` 全量。
- **只画可见格**：`IntersectionObserver`，滚出视口的格子不渲染。
- **重播/暂停不依赖 `Date.now`**：时间由 rAF 的 `dt` 累加，动画本身只由 `t` 决定。

---

## 3. 10 个 demo ↔ 源风格

| # | 风格包 | 源风格文件（`风格提示词/` 下） | 视觉参数选择理由 |
|---|---|---|---|
| 01 | `a1-glyph-rain` | `A-G_代码样片/A1_字雨.md` | 深蓝黑竖渐变（`#0B0E15→#050608`）+ 26 个"被说教"的词（应该/必须/落后/评价…）以 5 档字号系数下落；落地堆积 + 底部暖橘 `glow_dot`（`#F1B25C`）脉冲——橘点是"唯一暖色 = 唯一还在跳的东西"，把压迫感钉在画面上 |
| 02 | `b3-particles-home` | `A-G_代码样片/B3_粒子聚形.md` | 1500 粒子做**心 ↔ 房子**的双向贝塞尔聚形（控制点沿法线偏移），3 层解析拖尾 + `lighter` 叠加；字幕"先有一颗心 / 再有一个房子 / 合起来叫家"按 1.2s 分段。周期压到 3s（源是 4.8s），因为 demo 只有 3 秒 |
| 03 | `h1-biennale` | `H_现成版式/H1_Biennale Yellow.md` | 严格照源参数：纸色 `#F2E9D2`、太阳 `#F6C23E`、墨蓝 `#1D2A68`；外框 `64,64,1792,952`、横线 `y=148/932`、太阳圆心 `(1380,470)` 半径 250 + 同心环 250/330/410 + **120 条刻度**（每 5 条加长）；刻度环每秒 1°，3 秒正好走**一个刻度间距** → 折回不可见，循环无缝 |
| 04 | `k22-origami` | `K_卡通画风/K22_折纸.md` | 源只有一句"折出来的纸"。用 **`poly` + `pv` 铰点**手折一只纸鹤：身体/腹面/颈/头/喙/尾 + 两片翅膀（`rot:{$osc:[16,1,0]}` 绕铰点摆），虚线折痕、朱红小方、桌面线与纸屑；奶油纸色 4 级明度差保证"一眼是折纸而不是灰团" |
| 05 | `l39-ascii-crt` | `L_Lemo-Opuscar/L39_ASCII · CRT 终端.md` | P3 琥珀单色（`#FFB454`）+ 暗玻璃 + 扫描线；**整幅"房子"由 40×15 字符网格上的真字符构成**（`#` 墙体、`@` 窗户、`~` 地面）；唯一的第二色冰蓝 `#9FD8F0` 只用在**窗户**上（"一处情感物件"）；`crt` 的 `power` 走 `$wave[0,1,1,0.5]`——开机「点→线→面」后长时间亮着，循环末尾再关一次 |
| 06 | `m18-manim` | `M_动态风格/M18_数学·科学讲解（3Blue1Brown 那种）.md` | 深底 + 60px 栅格 + 直角坐标系；一条静止的 `cos` 作参照，另一条 `sin` 用 `phase:{$cyc}` + `morph.k:{$pulse01}` **连续变成 cos**——"只差一个相位"这句话由画面自己证明；金色切点 + 数学斜体公式 |
| 07 | `m23-five-act` | `M_动态风格/M23_五幕讲解（万能讲解模板）.md` | 五幕结构 0.6s/幕：问题（你卡住了）→ 定义（它是什么）→ 三步（拆开/替换/合上 三张卡）→ 真实例子（5 根柱状图）→ 落款；斜切 `wipe` 转场 + 底部 `timeline_rail`（`active:{$steps:[5]}` 高亮当前幕）；字大、粗、留白够 |
| 08 | `o45-godfather` | `O_奥斯卡98部/O45_教父.md` | 伦勃朗式明暗：80% 画面是暖暗部（`#24150B` 系），一盏顶光锥（`light_pool`）+ 身后一处暖亮口（窗）；人物做成**近黑剪影**（头/颈/肩 + 白衬衫 V + 领结）配琥珀色轮廓光，唯一的饱和红是胸前玫瑰（`#9C1A1A` 且随 `$wave` 微微呼吸）；厚涂笔触用 `oil_strokes` 低透明度叠在肩部 |
| 09 | `x7-comic-hero` | `X_code-video/X7_英雄漫画.md` | 报纸底色 `#F4ECD6` + 厚墨线三格（第三格斜切 46°）；Ben-Day 半调网点、英雄剪影 + 披风 + 星徽、黄色旁白框、带尾气泡、`burst` 拟声字 POW!、集中线绕一圈（`k=1` 整数圈保证无缝） |
| 10 | `z1-ink-wash` | `Z_中国风/Z1_水墨.md` | 源只有"水墨晕染，留白，竹林"。宣纸米色 + 纸纤维；**四团 `ink_wash` 分两层做远山**（上层淡灰、下层墨青），三竿细竹（叶在梢部、`$osc` 轻摆），竖排红印「山水」+ 两行「空山新雨后／天气晚来秋」——留白占七成，靠"少"立住水墨 |

---

## 4. 自检清单（全绿）

```bash
node --check ir-player.js          # 语法
node tools/selftest.mjs            # 10 个包：解析 / 契约 / 确定性 / 耗时
node tools/audit.mjs               # 版式：无越界、无文字溢出
node tools/bundle.mjs              # 生成 index.html（构建期断言：无 http(s)://、无外链 script/link、播放器无 Math.random/Date.now）
python -m json.tool styles/*.json  # 每个 JSON 独立可解析
```

当前结果（2026-10-29）：

| 检查 | 结果 |
|---|---|
| 10 个 JSON 可解析 + `validatePack` | ✅ 10/10 |
| **首尾一致** `render(0) ≡ render(duration)`（逐条绘图调用比对） | ✅ 10/10 |
| **确定性** 同一 `t` 渲染两次逐调用一致 | ✅ 10/10 |
| `save()`/`restore()` 配平（深度回到 0） | ✅ 10/10 |
| 版式体检（包围盒越界 / 文字溢出） | ✅ 0 处 |
| 单帧耗时（Node mock context，仅供横向比较） | 平均 **5.2 ms**，最慢 `b3-particles-home` **15.1 ms**（16.6 ms 预算内） |
| 原语覆盖 | **33/39**（未用：`arrow` `glyph_stream` `paper_fold` `portrait_oil` `scanlines` `wave`） |
| 外部依赖 | **0**（构建期断言：产物与全部源文件里没有任何网络 URL、没有外链字体/图片/脚本标签） |
| 字体 | 只声明系统字体：`Microsoft YaHei / SimHei / PingFang SC / Noto Serif SC / Georgia / Cambria Math / Cascadia Mono / Consolas / Impact`，缺失时按栈回退 |

> `paper_fold` 与 `portrait_oil` 已实现但**未在本批 demo 中使用**：K22 改用 `poly`+`pv` 手折（硬边折面比通用折纸原语更"纸"），O45 改用剪影拼装（通用油画人像在 3 秒 demo 里对比度不够，剪影 + 一束顶光更能一眼看出"教父"）。两者都保留在 `PRIM` 注册表里，规格文档有登记。

---

## 5. 已知限制

1. **纯 Canvas2D**，无 WebGL/WebGPU 分支；`x7` 的半调网点与 `b3` 的粒子是 CPU 绘制，缩略图靠 LOD 降级（`lod 0.5`），单格放大才是全量。
2. **没有像素级"眼见为实"的自动断言**：`selftest`/`audit` 只能验证"调用序列一致、包围盒不越界"，**画面好不好看**靠 headless Chrome 截图人工过（`tools/shot.ps1`）。10 个 demo 均已逐格截图核对。
3. **字体靠回退**：`Impact` 代替源里要求的 `Bangers`，`Georgia/Times` 代替 Biennale 的衬线，雅黑/宋体代替思源——字宽会差 3%~8%，H1 的大标题字距因此设了 `tracking` 手调。
4. **`glyph_field` 未做 LOD**：字符数固定（40×15），缩略图下略糊但有抗锯齿兜底。
5. **每格逻辑相同、相位相同**：10 个 demo 都从 `t=0` 起步，网格里会"同时呼吸"；真实产品里应给每格随机相位（本 demo 故意不加，方便逐帧比对）。
6. **`cover` 裁切**：非 16:9 容器下按短边填满会裁边，主体都在 `layout.safe` 内故不丢信息。
7. 未接音频；音画同步留给外层时间线。

---

## 6. 生成与调试工作流（可复现）

```bash
# 改任意 styles/*.json 后
node tools/selftest.mjs      # 契约自检（首尾一致/确定性）
node tools/audit.mjs         # 版式自检
node tools/bundle.mjs        # 重新生成 index.html
```

目视检查某个风格在 0 / 0.6 / 1.2 … 秒的样子（Windows + Chrome）：

```powershell
node tools/probe.mjs
.\tools\shot.ps1 -pack k22-origami -ts "0,0.6,1.2,1.8,2.4,2.95" -cols 3 -w 640
# 结果在 tools/_shots/k22-origami.png
```

单独排查某个原语：

```powershell
node tools/solo.mjs o45-godfather portrait_oil 1.5   # 打印该原语的全部绘图调用
# 或
chrome --headless=new --screenshot=solo.png --window-size=1000,600 `
  "file:///…/tools/_probe.html?p=o45-godfather&solo=portrait_oil&ts=1.5&w=960"
```

---

### 维护注记（Lead 验收）

- `l39-ascii-crt` 的 `crt.power` 已改为 `{"$wave":[0.86,1,1,0]}`：原相位 0.5 会导致 t≈1.2–1.5s 时 CRT 黑边裁到只剩窄条（整格全黑）。改后全程可见，仍保持 CRT 呼吸感。
- `_midframe.png` 为 Lead 用 10 个最终包在 t=40% 时长处生成的联系图，供人工验收。
