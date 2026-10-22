# 用代码生成 15 秒动效片：架构、逐段拆解与 AI 规范

> 说明：本文基于对两支参考片「分段现象」的描述和这类片子的通用做法整理，我没有看过视频本身，也没有核对参考页面。凡是对原片实现的猜测都标注「推测」。所有缓动参数、数值均为经验值，不是原片真实参数。
>
> 参考片（仅作学习对象，不复刻）：SuperX feature release teaser（Product UI）、Claude motion design showreel（Kinetic type），均来自 motionvideo.xyz。

---

## 目录

1. 第一轮：总体架构
2. 第二轮：逐段技术拆解
3. 第三轮：关键能力专项
4. 第四轮：给 AI 的最小规范
5. 附：30 行最小示例

---

## 第一轮：总体架构

### 1.1 技术选型

推荐路线：**Remotion（React）做编排，DOM/CSS/SVG 做主体，Canvas 2D 做粒子和点阵，Three.js 只在必须时才用。**

| 层 | 用什么 | 理由 |
|---|---|---|
| 编排 / 时间轴 | Remotion（`useCurrentFrame`、`Sequence`） | 一切都是 `frame` 的纯函数，可 seek、逐帧确定 |
| 文字、卡片、色块、HUD | DOM + CSS transform | 排版质量最好，字体、字距、对齐都是浏览器原生能力 |
| 线、刻度、雷达、blob、准星 | 内联 SVG | `stroke-dashoffset`、path 插值顺手，矢量不糊 |
| 点阵球、粒子 | Canvas 2D | 几千个点够用，不依赖 GPU，headless 渲染最稳 |
| 真 3D、真 bloom、上万粒子 | Three.js / WebGL | 仅在 2D 做不到时使用，headless 需处理 GL 后端 |

取舍：

- 纯 CSS animation 写起来最快，但由墙钟时间驱动，逐帧渲染时不确定，不要用。
- WebGL 全栈上限最高，但字体排版要自己做，调试成本高，AI 生成的稳定性差。
- 15 秒片子约 90% 的画面是文字、色块和线，DOM + SVG 完全够用。
- 与你猜测一致（推测）：原片大概率是 agent 写 React/CSS/SVG，偶尔加 canvas/WebGL，再用 Remotion 渲染。

### 1.2 时间轴与确定性

**结构**：根组件 `<Composition>`；每个镜头一个组件；用 `<Sequence from durationInFrames>` 摆放；镜头内部使用**局部帧**（Sequence 内 `useCurrentFrame()` 自动归零）。

**确定性铁律**：

- 所有动画值必须是 `f(frame)` 的纯函数：用 `interpolate` + `Easing`，或 `spring({frame, fps})`。
- 禁用 CSS `transition` / `animation`、`requestAnimationFrame`、`setTimeout`。
- 禁用 `Math.random()` / `Date.now()`，改用 `random('seed')`。
- 粒子不要逐帧积分（依赖上一帧状态），用**闭式解**：`pos(t) = p0 + v·(1−e^{−kt})/k`，任意帧可直接算出。
- 字体、图片等资源在首帧前加载完（`delayRender`，或使用本地 woff2）。

### 1.3 缓动与节奏经验

| 用途 | 曲线 |
|---|---|
| 入场（主力） | `cubic-bezier(0.16, 1, 0.3, 1)`（expo-out 近似）或 `(0.33, 1, 0.68, 1)`（cubic-out） |
| 位移 / 推镜头 | `(0.65, 0, 0.35, 1)`（in-out） |
| 硬切式 wipe | `(0.77, 0, 0.175, 1)` |
| 带回弹弹出 | `(0.34, 1.56, 0.64, 1)` 或 `spring({damping: 14–18, stiffness: 80–120})` |
| 打字、计数、扫描 | 线性，或阶梯 |
| 呼吸 | `sin`，周期取整数帧 |

节奏规则：

- 入场 12–20 帧（30fps 下约 0.4–0.65s）；退场约为入场的 0.6–0.7 倍，退场要比入场快。
- 文字落定后 **hold 至少 0.8s**，短词 0.5s 是下限。
- 同组元素 stagger 2–5 帧，超过 6 帧会显得拖。
- 镜头之间重叠 4–10 帧：下一段入场在上一段退场未结束时开始，避免「断电感」。
- 每个镜头只放一个主角，次要信息用 mono 小字、低透明度。
- 一个镜头里「一次大动作 + 一次小动作」，同时发生的动作不超过三个。
- 故障、爆发放在节奏峰值，前后留静帧对比。

### 1.4 渲染输出

| 项 | 典型值 |
|---|---|
| 分辨率 | 1920×1080（竖版 1080×1920，方版 1080×1080） |
| fps | 30（文字和 UI 够用）；60 对快速故障/粒子更顺，渲染时间翻倍 |
| 15s 总帧数 | 450（30fps） |
| 编码 | H.264，`yuv420p`，`--crf 16–18` |
| 并发 | `--concurrency` 取 CPU 核数一半到全部，内存紧则降低 |

CLI 示例：

```bash
npx remotion render Main out.mp4 --codec=h264 --crf=17 --pixel-format=yuv420p
```

常见坑：

1. **字体没加载完**，首帧闪换字体，必须等字体。
2. **混入 CSS animation/transition**，渲染结果错乱。
3. **headless 下 WebGL 不出图**，需要 `--gl=angle`（或 swangle）等配置，要实测。
4. **暗部色带（banding）**：黑底渐变和光晕在 H.264 下易出现色带，叠 3–6% 噪点（dither）解决。
5. **红色文字在 yuv420p 下色度溢出/发糊**：降低 crf，红字边缘别太细。
6. **大半径 blur / backdrop-filter / box-shadow 逐帧重算很慢**，渲染时间会暴涨。
7. **emoji 依赖系统字体**，不同机器渲染不一致；片尾 🔥 建议改成自绘 SVG。
8. 总时长、fps 改动后，用「秒」写的时间要经 `fps` 换算，别写死帧数。

---

## 第二轮：逐段技术拆解

> 时间按 30fps 理解；缓动为大致 cubic-bezier 经验值（推测）。

### 2.1 SuperX（0–15s）

| 段落 | 图元 | 动画原语 | 时间与缓动 | 层叠与混合 | 性能 |
|---|---|---|---|---|---|
| 0–1.5 红光起手 | 全屏 div + `linear-gradient` 斜光带（约 −25°）；X 用大字或 SVG path，被遮罩只露一角 | 光带 `translateX(-120%→120%)`；X 用 `clip-path: inset()` 只露 8–15% | 扫光 1.2s，in-out `(.65,0,.35,1)` 或 expo-out | 黑底 < 光带（`screen` / `plus-lighter`）< X | 渐变层便宜，用 `radial-gradient` 代替大 blur |
| 1.5–2.5 X 聚焦 | 大字 `X` 或 SVG path | `scale 3.2→1`、`opacity 0→1`、`blur 24px→0` | 1.0s，`(.16,1,.3,1)` | X 在光之上 | blur 动画逐帧重算，半径限制在前 10 帧、≤ 24px |
| 2.5–3.5 X 定版 | X + 下方 mono 小字 | 小字 `opacity` + `translateY 12→0`；X `scale 1→1.02` 缓漂 | 小字 stagger 4–6 帧，cubic-out | 小字在 X 下方 | 无压力 |
| 3.5–5.0 等式排版 | 单个 `<span>`，等宽字体 | `text.slice(0, n)`，`n = floor(interpolate(f,[a,b],[0,len]))`；光标 `f%16<8` 闪烁 | 线性，约 12–18 字/秒，可加 seeded 随机停顿 | 光标在字上 | 用等宽字体避免重排抖动 |
| 5.0–6.0 故障换字 | 三层同字（R/G/B）+ 6 条横向切片 | 见第三轮 3.1 | burst 6–10 帧，2 帧阶梯，窗口中点换字，末帧白闪 | 三层 `mix-blend-mode: screen` | 6 切片 × 3 层 = 18 个文字节点，无压力 |
| 6.0–7.2 悬念问号 | 文字 | X `opacity 1→0.25`；`?` 进场 `scale 1.15→1` + 衰减抖动 `A·e^{-kt}·sin(ωt)` | 0.4s ease-out | `?` 在 X 之上 | 无压力 |
| 7.2–8.0 X 呼吸 | 光晕 div（radial-gradient） | `opacity`/`scale = 0.7 + 0.3·sin(2πf/48)` | 周期约 1.6s | 光在 X 下 | 只动 opacity/transform，别动 blur |
| 8.0–9.5 UI 卡片散落 | 6–10 个 div 卡片，**自绘假 UI**（圆角、1px 边框、骨架条、头像圆、小折线 SVG） | `translate3d + rotate + scale`；入场后 sin 慢漂做视差 | 0.8s，`(.22,1,.36,1)` 或 spring；stagger 3–5 帧 | 按 z 排序，远处更暗、blur 1–3px 做景深 | 阴影用预烘焙模糊 div，别每张都大半径 `box-shadow` |
| 9.5–10.5 卡片网格推进 | 同一批卡片 | 同一 progress 驱动，每张从散落位姿插值到 3×4 网格位姿；整体 `scale 1→1.6` 推镜头 | 0.9s，in-out `(.65,0,.35,1)` | 整体包一层 transform，单个合成层 | 别逐卡片加 filter |
| 10.5–12.0 X 粒子爆开 | Canvas 2D，预渲染小 X sprite 到离屏 canvas | 闭式运动 `pos = c + dir·speed·(1−e^{−kt})/k`；自转 `ωt`；冲击环（SVG circle `scale 0→3`、`opacity 1→0`） | 爆发 1.5s，速度分布 seeded | `globalCompositeOperation: 'lighter'`，红→白 | N=800–2000，`drawImage` sprite 可行，避免逐粒子 `shadowBlur` |
| 12.0–13.0 粒子消散 | 同一粒子系统 | 每颗 `alpha *= 1 − ease(t/life)`，寿命随机 0.6–1.2s，最后留一个小 X | cubic-out | 同上 | 无压力 |
| 13.0–14.0 片尾锁标 | 自绘 SVG 火焰图标 + 大字 + 副句 | 标题 `overflow:hidden` + `translateY 100%→0` mask 上滑；副句逐词 `opacity` + `blur 8→0` | 0.6s，expo-out；词间 stagger 3 帧 | 无特殊 | 字体需提前加载 |
| 14.0–15.0 片尾收束 | 大字 + mono 域名 | `scale 1.04→1`、`opacity` | 缓慢，最后 hold ≥ 0.8s，可选最后 0.3s 线性淡黑 | 无 | 无压力 |

### 2.2 Claude 蓝图（0–15s）

| 段落 | 图元 | 动画原语 | 时间与缓动 | 层叠与混合 | 性能 |
|---|---|---|---|---|---|
| 0–2.0 制图点 | SVG 十字准星（2 line + 1 circle）；背景网格用两层 `repeating-linear-gradient`（大格 40px + 小格 8px，`rgba(255,255,255,.08)`）；mono 坐标文字 | `stroke-dasharray/dashoffset` 画线；坐标数字插值变化 | 线 0.6s ease-out；标注 stagger | 网格 < 线 < 红准星 < 文字 | 全矢量，`vector-effect: non-scaling-stroke` 保线宽 |
| 2.0–3.4 制图线 | 一条 path 拼出所有刻度（`M x0 y V y2` 重复），红点用 circle | 刻度逐个 reveal（stagger 1 帧）；红点沿线 `lerp`；尾迹用 `position(t−δ)` 采样 3–5 个递减透明度圆 | 红点 1.2s，`(.45,0,.15,1)` | 红点最上层 | 一条 path 比几十个 line 节点省 |
| 3.4–5.0 制图面 | 橙色平行四边形：div + `clip-path: polygon()` 或 `skewX(-20deg)` | 「翻入」用 `perspective` + `rotateX(-90→0)`，或 `scaleY 0→1`（origin 在底） | 0.8s，expo-out | 压在线上，可试 `multiply` 让线透出（推测） | 单个 3D 变换层，轻 |
| 4.8–6.0 大字打字 | 巨型字（280–360px）逐字 span | 逐字 `clip` 或 `opacity + translateY 30%→0`；光标块 | stagger 4–5 帧，与上段重叠约 0.2s | 字在面之上 | 逐字 span 需 `display:inline-block` |
| 5.8–7.2 点阵球 | Canvas 2D，N≈1200–2400 点 | 半径 `R: 0→280`；自转 `θ = ωt`，ω≈0.6 rad/s；深度 alpha | 1.0s，回弹 `(.34,1.56,.64,1)` | 点用 `lighter`，可省深度排序（见 3.3） | 2D canvas 足够 |
| 7.2–8.2 数据计数 | 数字 span + N 根细柱 div | 数值 `round(interpolate(...))`，用 `tabular-nums`；或每位数字做垂直 strip；柱用 `scaleY`（origin 在底），高度 seeded | 1.0s，expo-out | 无特殊 | 用 `scaleY` 不用 `height`，不触发 layout |
| 8.2–9.4 音频电平条 | 24–48 根 bar | `scaleY = base_i·(0.25+0.75·\|sin(ω_i t+φ_i)\|^p) + 拍点脉冲`；130 BPM = 每拍 13.85 帧，相位用浮点；LED 分段感用 mask 的 `repeating-linear-gradient` | 拍点 `e^{-k·phase}` | 无特殊 | 同上 |
| 9.4–10.8 瑞士网格卡 | 橙色 div、无圆角、12 列网格、mono 小字 | `clip-path: inset(0 100% 0 0)→inset(0)` 硬 wipe | 0.5s，`(.77,0,.175,1)` | 网格线 1px 叠在最上 | 无压力 |
| 10.8–12.6 故障字 | 蓝色全幅色块 + 白字三层 + 切片 | 同 3.1，分 2–3 个 burst，中间 hold | burst 6–10 帧 | 色块 < 三层字 | 无压力 |
| 12.6–13.4 雷达圆 | SVG 同心圆（r=60/120/180/240）；扫描用 `conic-gradient` + radial mask；红点 | 圆 `dashoffset` draw-on（stagger 3 帧）；扫描角 `θ = ωf`；红点被扫过后 `opacity = e^{−k·(f−f_hit)}` 衰减 | 圆 0.5s；旋转线性 | 扫描 < 圆 < 点 | conic-gradient 全屏一次，没问题 |
| 13.4–14.2 红色团块 | SVG path，8–12 个极坐标控制点 `r_i(t)=R(1+a·sin(ω_i t+φ_i))`，Catmull-Rom 转贝塞尔闭合 | path `d` 逐帧重算；整体 `scale` 胀缩带 overshoot | 0.8s，in-out | 要「粘连」效果：`filter: url(#goo)`（blur + feColorMatrix） | goo 滤镜限制在 blob 容器内，别全屏 |
| 14.2–15.0 片尾收束 | 大字 `CLAUDE` + 红色句点 + mono 副标题 | 句点 `scale 0→1` overshoot；副标题 `opacity` | 句点 0.4s 回弹 | 句点最上 | hold ≥ 0.6s |

---

## 第三轮：关键能力专项

### 3.1 故障字

**RGB 分离：三层 + `screen` 可行，是标准做法。** 黑底上三层纯色字（`#f00` / `#0f0` / `#00f`），各自 `mix-blend-mode: screen`，水平错开 ±2–6px：重叠处叠加成白/青/品红，边缘出现红蓝色边。注意：在非黑底（如蓝底）上 `screen` 会提亮背景，需把三层包进 `isolation: isolate` 的黑底容器，或改用 `lighten` / `plus-lighter` 实测。

**切片抖动：优先 `clip-path: inset()`。**

- 把整块文字（三层打包）复制成 N 份，每份用 `inset(top 0 bottom 0)` 只露一条，各自 `translateX` 一个 seeded 随机值。
- 用 px 而不是百分比，并取整，避免相邻切片出现 1px 缝隙。
- `feDisplacementMap` 能做更「扭曲」的效果，但 Chromium 中逐帧开销大、边缘有插值糊，只在需要波浪形扭曲时使用。

**避免「假」和糊：**

1. 故障是**短促爆发**，不是持续抖动：每次 6–10 帧，前后 hold 干净静帧。
2. **阶梯式**更新，每 2–3 帧换一次随机值，不要缓动，不要每帧都变。
3. 幅度有包络：0 → 峰值 → 0，峰值之后立刻收。
4. 换字发生在窗口中点，让观众来不及看清换的瞬间。
5. 偶尔插 1 帧反色或白闪、1 帧整体放大 2–4%。
6. 不用 blur，保持边缘锐利；最后一帧回到完全对齐的干净文字。
7. 切片数 4–8，高度不等比更自然。

### 3.2 三维卡片翻面

- **CSS `perspective` + `rotateX/Y`**：平面卡片（UI 卡、翻牌）完全够用，文字最清晰，成本最低。需设 `transform-style: preserve-3d`、`backface-visibility: hidden`、合适的 `perspective`（800–1400px）。
- **Three.js**：需要真实光照、很多卡片互相遮挡、景深、反射时才值得；代价是 headless GL 配置和字体需烘成纹理。
- 15 秒 UI 卡片片子，**优先 CSS**。

**模拟投影与受光：**

- 投影：卡片下方放一个模糊的暗色 div（预烘焙），位置随「卡片离地高度」偏移、变大、变淡。
- 受光：卡片上叠 `linear-gradient` 高光层，角度和透明度绑定 `rotateY`，用 `mix-blend-mode: overlay` 或 `soft-light`；翻转时让高光扫过。
- 边缘：1px `rgba(255,255,255,.12)` 描边，加一点 `inset` 高光，质感提升明显。

### 3.3 点阵球

**Fibonacci sphere：**

```text
φ = π·(3 − √5)                  // 黄金角
for i in 0..N-1:
  y = 1 − 2·(i + 0.5)/N         // −1 到 1 均匀
  r = √(1 − y²)
  θ = φ·i
  x = r·cos θ,  z = r·sin θ
```

**旋转与投影**：先绕 Y 轴旋转 `θ_rot = ω·t`（可加一点绕 X 的倾角），然后：

- 正交投影：`sx = cx + x·R`，`sy = cy + y·R`
- 透视投影：`s = f / (f − z·R)`，`sx = cx + x·R·s`，`sy = cy + y·R·s`

**深度处理：**

- alpha = `0.2 + 0.8·(z+1)/2`；点的半径也随 z 缩放（前大后小）。
- 排序：每帧按 z 排序一次（N=2000 很快）；若用 `lighter` 叠加混合，可省掉排序。
- 优化：按 alpha 分成 6–8 个桶，每桶一次 `fillStyle`，批量 `fillRect`，比逐点 `arc` 快得多。

**Canvas 还是 WebGL**：N ≤ 5000 用 Canvas 2D；上万点、要 bloom 或点大小衰减再考虑 WebGL `gl.POINTS`。headless 渲染下 Canvas 2D 更稳。

### 3.4 粒子与光晕

- **Canvas 2D**：1–3k 带旋转的 sprite（`drawImage`）没问题；用闭式运动保证可 seek。
- **WebGL instancing**：上万颗、要深度、要 additive + bloom 时用。
- **bloom**：
  - 轻量路线：复制发光层，`filter: blur(20–40px)` + `mix-blend-mode: screen`，再叠回原层。
  - 更省：把发光层画在 **1/4 分辨率** canvas 上，用 CSS 放大，双线性插值本身就是廉价模糊。
  - 真 HDR bloom 需要 Three 后处理（`UnrealBloomPass`）。
  - 推测：原片黑底红光大概率是 CSS radial-gradient + blur 叠出来的，不一定用了后处理。

### 3.5 字体

候选（均为开源 OFL，使用前自行核对许可证）：

- 几何 / 新怪诞无衬线：**Inter / Inter Tight、Space Grotesk、Archivo（可变宽度 `wdth` 轴适合 kinetic）、Manrope、Sora、Instrument Sans**
- 重磅标题：Archivo 800–900、Inter 800–900
- 等宽：**JetBrains Mono、IBM Plex Mono、Space Mono、Geist Mono**

**可变字体逐字动画注意：**

1. 动画 `font-variation-settings` / `font-weight` 会改变文字宽度、触发重排，周围元素会抖。固定容器宽度，或用 transform 缩放代替。
2. 拆成逐字 `span` 会丢 kerning 和连字，标题需手动补 `letter-spacing`；每个 span 用 `display:inline-block`，否则 transform 不生效。
3. 字体必须在首帧前加载完。无网络时用本地 woff2 或 base64 内联。
4. 数字滚动用 `font-variant-numeric: tabular-nums`，避免宽度跳动。
5. 子像素抖动：用 `transform` 位移代替 `letter-spacing` 动画。

### 3.6 时间码 / HUD

- **等宽字体**：JetBrains Mono / IBM Plex Mono；开启 `font-feature-settings: "tnum", "zero"`；小字 14–18px（1080p），`letter-spacing: .08em`，全大写，`opacity .5–.7`。
- **时间码**由帧算出：`HH:MM:SS:FF`，每帧更新，这是「真」HUD 感的来源。
- **对齐**：所有 HUD 元素落在 8px 基线网格上，四角固定位置（左上标题、右上时间码、左下坐标、右下页码）。
- **扫描线不廉价的做法**：全屏均匀条纹最显廉价。要用就低到 3–5% 透明度，周期 2–3px，缓慢漂移，只在局部窗格出现。
- **噪点**：SVG `feTurbulence`（`baseFrequency≈.8`，`numOctaves=2`），`seed` 随 `floor(frame/2)` 变化，叠 4–8% `overlay`；或预生成一张噪点 tile，每帧随机偏移。噪点主要价值是消除黑底色带，不是装饰。
- **克制原则**：一个镜头里同时只出现一种「质感特效」；色差（chromatic aberration）只在故障峰值使用。

---

## 第四轮：给 AI 的最小规范

下面这份可直接作为 system prompt 或 `SPEC.md`。具体数字是建议值，需按你的工具实测调整。

````markdown
# Motion Video Spec v0.1

## 1. 模板/组件结构
- 入口 `Main.tsx`：1920×1080，30fps，durationInFrames=450（15s）。
- 每个镜头一个组件 `Shot_<name>.tsx`，由 `<Sequence from durationInFrames>` 摆放。
- 全局常量文件 `tokens.ts`：颜色(≤4色)、字体(≤2族)、缓动表、`sec(n)=Math.round(n*fps)`。
- 镜头内只用局部帧 `useCurrentFrame()`，不读全局帧。
- 每个镜头导出 `meta = {start, end, hero: '主角元素'}`。

## 2. 能力白名单
- React、Remotion（interpolate、Easing、spring、random、Sequence、AbsoluteFill）。
- CSS：transform、opacity、clip-path、mask、mix-blend-mode、filter(blur ≤ 40px)、gradient、grid/flex。
- SVG：path、line、circle、pattern、feTurbulence、feColorMatrix、feGaussianBlur。
- Canvas 2D（粒子/点阵）。
- WebGL/Three.js：仅在 brief 明确要求时使用。

## 3. 时间与缓动书写规则
- 所有时间用秒写，经 `sec()` 转帧；禁止裸数字帧。
- 所有动画 = `interpolate(frame, [t0,t1], [a,b], {easing: EASE.xxx, extrapolateLeft:'clamp', extrapolateRight:'clamp'})`。
- 缓动只能从 `EASE` 表取：`out`(.16,1,.3,1)、`inOut`(.65,0,.35,1)、`wipe`(.77,0,.175,1)、`pop`(.34,1.56,.64,1)、`linear`。
- 入场 0.4–0.65s，退场为入场的 0.6–0.7 倍；stagger 2–5 帧；镜头重叠 4–10 帧；文字落定后 hold ≥ 0.8s。
- 随机只用 `random('<seed>')`；故障/抖动按 `floor(frame/2)` 阶梯更新。
- 周期动画（呼吸、旋转）周期必须是整数帧。

## 4. 性能预算
- 分辨率 ≤ 1920×1080；fps 30；时长 ≤ 15s。
- 同屏 DOM 动画元素 ≤ 80；Canvas 粒子 ≤ 3000；SVG 节点 ≤ 500。
- blur 半径 ≤ 40px，且同屏带 blur 的层 ≤ 3；禁止全屏 backdrop-filter。
- 不要逐帧动画 `box-shadow`、`height`、`width`、`top/left`（用 transform/opacity）。
- 单帧本地渲染 > 1s 视为超标，需简化。

## 5. 禁止项
- 禁止联网（fetch、外链字体、CDN、远程图片/视频/音频）。
- 禁止 `eval`、`new Function`、动态 import 外部 URL。
- 禁止外部素材：所有图形用代码绘制，字体用本地文件。
- 禁止 CSS animation/transition、`requestAnimationFrame`、`setTimeout`、`Math.random`、`Date.now`。
- 禁止复刻任何现有作品、品牌资产或受版权保护的素材。

## 6. 自检清单（生成后逐条打勾）
- [ ] 总帧数=450，Sequence 无空洞、无意外黑帧
- [ ] 每个镜头有明确主角，同时发生的动作 ≤ 3
- [ ] 所有时间经 sec()，所有缓动取自 EASE 表
- [ ] 字体已加载，首帧不闪
- [ ] 首帧、末帧、每个镜头的第一帧与最后一帧各检查一次静帧
- [ ] 文字落定后 hold ≥ 0.8s，文字在静帧可读（对比度 ≥ 4.5:1）
- [ ] 两次相同帧号渲染结果一致（确定性）
- [ ] 性能预算全部满足，无禁止项

## 7. 输出要求
- 只输出：`tokens.ts`、`Main.tsx`、`Shot_*.tsx`，以及一份 ≤ 10 行的分镜表（时间 / 主角 / 缓动）。
- 不输出解释性长文；不确定的实现决策在代码注释里标 `// ASSUMPTION:`。
````

实践中对 AI 效果最大的几条补充约束（经验判断，推测其普适性）：

1. **给分镜表模板**：让它先写「时间 / 主角 / 动作 / 缓动」再写代码，比直接写代码质量高得多。
2. **限制调色板和字体数量**（≤4 色、≤2 字体），是避免「AI 味」最便宜的手段。
3. **提供缓动白名单**而不是让它自由发挥，节奏一致性会好很多。
4. **要求每个镜头先写静帧**（落定后的样子），再加动画，保证构图先对。

---

## 附：30 行最小示例（故障换字段落）

Remotion + 三层 RGB + 切片，局部帧 0–45（1.5s）。纯示例代码，不涉及任何原片素材。

```tsx
import {AbsoluteFill, useCurrentFrame, interpolate, Easing, random} from 'remotion';
const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const SLICES = 6, H = 1080;

export const GlitchWord: React.FC<{from: string; to: string}> = ({from, to}) => {
  const f = useCurrentFrame();
  const burst = f >= 12 && f < 24;                         // 故障窗口：0.4s
  const word = f >= 18 ? to : from;                        // 窗口中点换字
  const amp = burst ? interpolate(f, [12, 18, 24], [0, 14, 0]) : 0;  // 幅度包络
  const tick = Math.floor(f / 2);                          // 每 2 帧阶梯更新
  const scale = interpolate(f, [0, 10], [0.96, 1], {easing: EASE, extrapolateRight: 'clamp'});
  const layer = (color: string, dx: number) => (
    <AbsoluteFill style={{display: 'grid', placeItems: 'center', color, mixBlendMode: 'screen',
      fontSize: 220, fontWeight: 800, letterSpacing: '-0.02em', transform: `translateX(${dx}px)`}}>
      {word}
    </AbsoluteFill>
  );
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {Array.from({length: SLICES}, (_, i) => {
        const shift = burst ? (random(`s${i}-${tick}`) - 0.5) * 2 * amp : 0;
        const top = Math.round((i * H) / SLICES), bot = H - Math.round(((i + 1) * H) / SLICES);
        return (
          <AbsoluteFill key={i} style={{clipPath: `inset(${top}px 0 ${bot}px 0)`,
            transform: `translateX(${shift}px) scale(${scale})`, isolation: 'isolate'}}>
            {layer('#f00', -amp * 0.4)}{layer('#0f0', 0)}{layer('#00f', amp * 0.4)}
          </AbsoluteFill>
        );
      })}
      {f === 24 && <AbsoluteFill style={{background: '#fff', opacity: 0.25}} />}
    </AbsoluteFill>
  );
};
```

要点：时间全由 `f` 决定；随机用 `random(seed)`；切片用整数 px；三层 `screen` 放在 `isolation: isolate` 里，不会污染外层背景。
