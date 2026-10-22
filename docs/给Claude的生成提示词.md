# 给 Claude 的「代码动效」生成提示词套件

> 用法：先贴【总提示词】，再贴一张【任务卡】，收代码；渲染对比后，用【迭代提示词】回喂。
> 原则：让 Claude 写**原创实现**，只学技法，不复刻原片素材。

---

## 一、总提示词（每次新对话先贴这段）

```text
你是我的「代码动效」合作者。我们要一起做一种 15 秒左右的程序化动效片：用 React + Remotion 写组件，浏览器逐帧渲染成 MP4。

我的背景：我在做一个开源工具，让用户用一句话生成开机动画模板。我会把你写的代码接进我的渲染器，渲染后拿对比图回来找你改。

请你遵守下面的硬规则：

1. 只写原创代码。不要复制任何现有作品的代码、素材、字体文件；参考的只是「技法类型」（比如故障字、点阵球、3D 翻面）。
2. 技术栈固定：React + TypeScript + Remotion（interpolate / Easing / spring / random / Sequence / AbsoluteFill）。
   需要粒子或点阵时用 Canvas 2D；除非我明确要求，不要用 Three.js。
3. 确定性渲染：所有动画必须是 frame 的纯函数。
   禁止 CSS animation/transition、requestAnimationFrame、setTimeout、Math.random、Date.now。
   随机只用 Remotion 的 random('seed')。
4. 不联网、不引外部字体/图片/视频；所有图形用代码画。
5. 时间用秒写，通过 sec(n) = Math.round(n * fps) 转帧；缓动只从下面的表里取：
   out: cubic-bezier(0.16, 1, 0.3, 1)
   inOut: cubic-bezier(0.65, 0, 0.35, 1)
   wipe: cubic-bezier(0.77, 0, 0.175, 1)
   pop: cubic-bezier(0.34, 1.56, 0.64, 1)
6. 输出格式固定：
   - 先给 5 行以内的分镜表（时间 / 主角 / 动作 / 缓动）
   - 再给完整代码：tokens.ts、Shot_X.tsx（如果需要一个 Main.tsx 入口也一并给）
   - 代码里每个关键决策用 // ASSUMPTION: 标注你不确定的地方
   - 不要写长篇解释，不要写“你可以进一步……”这类客套话
7. 视觉上要「克制」：黑底、低饱和、细线、mono 小字、最多 4 个颜色、最多 2 个字体族。
8. 如果我的描述里有歧义，先按最简方案实现，并在注释里标 ASSUMPTION，不要停下来问我。

收到请只回复「明白」，然后等我发任务卡。
```

## 二、任务卡（一次贴一张）

### 任务卡 1：故障换字（1.2–2.0 秒）

```text
任务卡：故障换字。

画面：1280×720，黑底（#050303），左侧一个红色 X（#D9482C，约 190px，带柔光），
右侧等宽/无衬线文字，从「=  VOGUE」在故障窗口内换成「=  ?」。

要求：
- 文字用 6 条横向切片（clip-path），每片内部叠 RGB 三层（#FF2D55 / #22FF88 / #00E5FF），mix-blend-mode: screen。
- 故障只发生在 1.0 秒附近约 0.45 秒的窗口：幅度包络 0 → 峰值 → 0，每 2 帧阶梯式更新随机值。
- 换字发生在窗口中点；窗口内允许 1 帧白色闪屏（opacity ≤ 0.25）。
- 文字字号 64，X 与文字基线对齐；整体入场 scale 0.96 → 1（0.35 秒，out）。
- 故障结束后必须回到完全干净的文字（零位移），再维持 0.6 秒。
- 组件名 Shot_GlitchSwap，durationInFrames 按 50fps 算 2.2 秒（110 帧）。

输出：分镜表 + tokens.ts + Shot_GlitchSwap.tsx。
```

### 任务卡 2：制图线（1.4 秒）

```text
任务卡：制图线。

画面：1280×720，黑底，蓝图感。一条水平细线（1px，rgba(242,242,242,.55)）从中心向两侧展开到 760px；
线上有 7 根等距刻度（12px 高）；一个红色圆点（14px，带光晕）沿线从左到右移动；
线左上方 mono 小字「02  LINE — 1440 PX」，下方「X 240   Y 320」。

要求：
- 线用 stroke-dashoffset 或 clip-path 展开，0.6 秒，out。
- 刻度 stagger 1 帧；红点 1.2 秒从 -350 移到 +350，缓动 inOut。
- 红点走过之处留 3 个递减透明度残影。
- HUD 小字 10px，letter-spacing 0.24em，颜色 #8A8A8A。
- 组件名 Shot_Line，50fps，70 帧。

输出：分镜表 + tokens.ts + Shot_Line.tsx。
```

### 任务卡 3：3D 翻面卡片（1.6 秒）

```text
任务卡：3D 翻面卡片。

画面：1280×720，黑底。一个 500×260 的橙色卡片（#FF4A1E）从侧后方翻入，落定后微微倾斜 -8°，
卡片内黑色大字「PLANE」（约 78px），右下角小字「1440 × 820」。

要求：
- 用 CSS perspective（约 1400px）+ rotateX/rotateY 实现翻入，不用 Three.js。
- 动画 0.8 秒：rotateY 55° → -8°，rotateX 35° → 0°，scale 0.85 → 1，缓动 out。
- 投影：卡片下方一块预模糊的深色 div，随「离地高度」偏移、缩放、变淡。
- 受光：卡片上叠一层线性渐变高光，mix-blend-mode: overlay，随 rotateY 扫过。
- 组件名 Shot_Plane，50fps，80 帧。

输出：分镜表 + tokens.ts + Shot_Plane.tsx。
```

### 任务卡 4：点阵球（1.4 秒）

```text
任务卡：点阵球。

画面：1280×720，黑底。一个由 1800 个白点组成的球体，从半径 0 长到 260px，绕 Y 轴缓慢自转（0.6 rad/s）。
点有深度：越靠前越亮越大，越靠后越暗越小。

要求：
- 用 Canvas 2D，Fibonacci sphere 均匀分布。
- 投影用透视：s = f/(f - z*R)，f 取 2.2R。
- 深度处理：alpha = 0.15 + 0.85 * (z+1)/2；点半径随 z 在 0.6–1.6px 之间。
- 性能：按 alpha 分 6 个桶批量 draw，不用 shadowBlur；不要逐帧排序（用 lighter 叠加）。
- 运动用闭式解，任意帧可 seek；不要依赖上一帧状态。
- 组件名 Shot_DotSphere，50fps，70 帧。

输出：分镜表 + tokens.ts + Shot_DotSphere.tsx。
```

### 任务卡 5：瑞士网格卡 + 故障字（2 段，每段 1.2 秒）

```text
任务卡：瑞士网格卡 + 故障字。

段 A（1.2 秒）：橙色全幅卡片（#FF3B16），左侧巨大数字「01」（约 200px，黑），右侧「SWISS GRID」
（26px 黑）+「TYPE / COLOR / TIME / SPACE」（10px，70% 黑）。
卡片用 clip-path: inset(0 100% 0 0) → inset(0) 做硬 wipe，0.5 秒，wipe 缓动；网格线 1px 叠在最上。

段 B（1.2 秒）：蓝色全幅卡片（#2333FF），白色「GLITCH」（110px，900），
做 2 次短促故障（每次 6 帧），三层 RGB + 切片，中间保持干净静帧。

输出：一个文件里两个组件 Shot_SwissGrid、Shot_GlitchCard，各 60 帧，50fps。
```

## 三、迭代提示词（渲染完回喂用）

```text
我渲染了你上一版，附上对比图（左：参考，右：你的实现）。

请只改这几处，其他不要动：
1. 整体亮度：你的版本比参考亮约 30%，请降低文字/卡片亮度，并加一层轻微暗角（vignette）。
2. 故障：参考更像「信号丢失」，你的太干净。请把切片幅度从 ±14px 提到 ±20px，
   并在峰值处叠 1 帧 2px 的全局模糊（只 1 帧）。
3. 字体：参考是几何无衬线。请在 tokens 里把字体族改成 ['Inter','Space Grotesk',sans-serif]，
   不要下载字体文件，只改 family 名。
4. 节奏：入场快了 0.1 秒，请把 0.35 秒改成 0.45 秒。

输出：只给改动后的完整文件，并在注释里标 // CHANGED: 说明改了什么。
```

## 四、验收清单（收到代码后先自己看）

- [ ] 有没有 `Math.random` / `Date.now` / `setTimeout` / CSS animation
- [ ] 时间是不是用 `sec()` 写的
- [ ] 有没有 `// ASSUMPTION:` 标注不确定处
- [ ] 分镜表时间加起来是否等于 durationInFrames
- [ ] 有没有引用外部字体/图片/网络

## 五、拿到代码后怎么用

1. 把 `tokens.ts` 和 `Shot_*.tsx` 放进 `09-技术验证-remotion/src/`
2. 在 `Root.tsx` 注册 Composition（id 用组件名，fps=50）
3. 渲染：`node node_modules\@remotion\cli\remotion-cli.js render src/index.ts Shot_X out/x.mp4 --codec=h264 --browser-executable="C:\Program Files\Google\Chrome\Application\chrome.exe"`
4. 我这边负责出对比图和迭代提示词
