# anim-ir v1 —— 风格包（stylePack）规格

> 实现：`ir-player.js`（零依赖、纯 Canvas2D）。入口 `IR.renderStyle(pack, t, target?, opts?)`。
> 一句话：**风格 = 一份 JSON + 一个只由 t 决定的渲染函数**。同一 `(pack, t)` 永远画出同一帧，`t = duration` 与 `t = 0` 完全等价，于是"3 秒循环"是零成本的。

```
风格提示词(md) ──人工翻译──▶ stylePack(JSON) ──IR 播放器──▶ 实时预览(Canvas2D)
                                   ▲                              │
                                   └────── 参数全是数据，可存/可比/可 diff ┘
```

---

## 1. 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | 唯一 id；**参与随机种子派生**，改名会改画面 |
| `name` | string | ✅ | 显示名（网格页标注用） |
| `source` | string | 建议 | 源风格 md 的相对路径，用于追溯 |
| `duration` | number | ✅ | 循环时长（秒）。契约：`render(duration) ≡ render(0)` |
| `fps` | number | 建议 | 仅元数据；播放器按时间 t 画，不按帧计数 |
| `seed` | number | 建议 | 全局种子，派生每个 entry 的 RNG |
| `palette` | `{token: "#RRGGBB"}` | ✅ | 颜色 token 表。params 里写 `"$token"` 即引用 |
| `bg` | object | ✅ | 背景，见 §2 |
| `texture` | object \| null | 可选 | 纸纹/颗粒/扫描线，见 §2 |
| `layout` | object | 建议 | `{safe:[x,y,w,h], cols:n}` 安全区与栅格（辅助线用） |
| `timeline` | entry[] | ✅ | 时间线条目，见 §3 |

**画布坐标**：永远是 1920×1080 逻辑像素。`fitCanvas()` 负责把 CSS 尺寸 × DPR 映射成这个坐标系，风格包本身**不关心**分辨率、DPR、窗口大小。

---

## 2. 背景与纹理

`bg` 支持单层或 `layers` 数组（由底到顶依次绘制）：

```jsonc
"bg": { "type": "layers", "layers": [
  { "type": "solid",  "color": "$bg" },
  { "type": "linear", "angle": 165, "stops": [["$bg1", 0], ["$bg2", 1]] },
  { "type": "radial", "x": 960, "y": 240, "r": 1240, "r0": 0,
    "stops": [{ "c": "#24150B", "at": 0, "a": 1 }, { "c": "#24150B", "at": 1, "a": 0 }] }
]}
```

- `angle` 单位为度，`0` = 从上到下，`90` = 从左到右。
- stop 两种写法：`[color, at]`（不透明）或 `{c, at, a}`（带 alpha）。
- `texture`：`{type, alpha, count, colors[], min, max, size, gap, seed}`，`type ∈ {grain, speckle, fiber, canvas, scanlines, dots, none}`。
  **纹理画在离屏画布上并缓存**（按 `type+seed+params` 命中），因此逐帧零成本，也不会因 `Math.random` 破坏确定性。

---

## 3. timeline entry

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `primitive` | string | ✅ | 原语名（§4） |
| `from` / `to` | number | ✅ | 生效区间（秒），`to > from`，`to ≤ duration` |
| `layer` | number | 可选 | 层级，小者先画（默认 0）；同层按数组顺序（稳定排序） |
| `params` | object | 可选 | 原语参数，值可以是常量 / `"$token"` / **参数动画对象**（§5） |
| `alpha` | number | 可选 | 整条 entry 的不透明度（默认 1） |
| `fadeIn` / `fadeOut` | number | 可选 | 进入/退出时长（秒），也可写在 `params` 里 |
| `ease` | string | 可选 | 缓动名（§6），作用于 entry 的局部进度 `p` |
| `seed` | number | 可选 | 缺省按 `hashStr(pack.id + primitive + seed)` 派生 |

**局部进度**：`p = (t - from) / (to - from)`，`pe = EASE[ease](p)`；原语默认用 `pe` 当整体进度，参数动画则用**全局** `t`。

---

## 4. 原语（39 个）

| 类别（需求要求的 10 类） | 原语 |
|---|---|
| 色块 / 版面 | `rect` `poly` `frame` `grid` `vignette` `wipe` |
| 文字 / 排版 | `text` `type_text` `caption` `badge` `balloon` `seal` `timeline_rail` |
| 线条 / 轴线 | `line` `arrow` `curve` `axes` `focus_lines` |
| 粒子 / 聚形 | `particles` `morph`（粒子聚形） `glow_dot` `burst` `halftone` |
| 波形 | `wave` |
| 纸片 / 折纸 | `paper_fold`（通用折纸原语；demo 里 K22 改用 `poly`+`pv` 手折） |
| 纹理颗粒 | （见 `texture` 字段）`scanlines` |
| 网格 | `grid` `halftone` |
| 符号流 | `glyph_rain`（字雨） `glyph_stream` `glyph_field`（字符网格画） `term_log` `crt` |
| 图像化风格 | `sun` `hero` `comic_panel` `ink_wash` `bamboo` `oil_strokes` `portrait_oil` `light_pool` |

常用参数速查（完整参数以源码 `PRIM` 注册表为准）：

| 原语 | 关键参数 |
|---|---|
| `rect` | `x,y,w,h,fill,radius,stroke,lineWidth,grad{type,angle,stops},reveal,revealFrom,grow,rot,blend` |
| `poly` | `pts[[x,y]…],fill,stroke,lineWidth,scale,rot(度),`**`pv`（铰点/轴心）**`,ox,oy,closed,blend` |
| `line` | `pts` 或 `x1,y1,x2,y2`；`color,width,cap,dash,progress,blend` |
| `text` | `x,y,lines[],font,size,weight,italic,tracking,align,baseline,color,glow,stroke,box,rot` |
| `type_text` | `text,x,y,size,font,tracking,color,progress,chars,cursor,cursorPhase` |
| `particles` | `count,area{x,y,w,h},colors[],rmin,rmax,travel,sway,dir,twinkle,cycles,blend,dotAlpha,seed` |
| `morph` | `a,b`（`heart/house/person/home`）`,count,seed,cx,cy,scale,trail[2],colors[2],hold[2],k,phase,zoom,blend` |
| `wave` | `x,w,y,amp,k`（整数周期）`,phase,samples,progress,fill,base,color,width,dots` |
| `paper_fold` | `cx,cy,scale,rot,u,paper,shade,crease,shadow,sheet[[x,y]…],flaps[{h,a0,a1,len,w,delay}]` |
| `glyph_rain` | `words[],count,size,sizes[],area,fall,font,color,pile,pileH,pileW,pileColor,seed` |
| `glyph_field` | `art[]`（等宽字符串数组）`,cell,cellW,chh,x,y,font,sizeK,reveal,color,bright,brightColor,dimAlpha,glow` |
| `term_log` | `x,y,w,size,font,color,tag,tagColor,prompt,text,progress,cursor,cursorPhase` |
| `crt` | `power,exposure,scan,scanGap,scanAlpha,glass,radius,flicker,flickerK,color` |
| `ink_wash` | `x,y,r,color,alpha,spread,seed,layers,coreAlpha,edge` |
| `bamboo` | `stalks[{x,y0,y1,w,nodes,sway,phase,taper,alpha,leaves[{at,a,len,w,a2}]}],sway,color,nodeColor` |
| `sun` | `x,y,r,color,halo,haloR,rings[],ringWidth,ink,ticks,tickR,tickCount,rot(度),rise` |
| `halftone` | `x,y,w,h,spacing,rmax,angle,color,mode('radial'\|'flat'),circle,gamma` |

> `poly` 的 `pv` 是折纸/铰链的关键：不写则绕**质心**旋转（`rot` 单位是度），写了则绕 `pv` 旋转与缩放——翅膀才能绕铰点摆而不是整体打转。

---

## 5. 参数动画（IR 最关键的一层）

JSON 里任何数字位置都可以放一个"动画对象"，由 `resolveParams()` 每帧递归求值（深度 ≤ 5）。**它把"时间怎么写"从原语里抽出来**，因此绝大多数动效不需要新原语：

| 写法 | 求值 | 用途 |
|---|---|---|
| `{"$wave":[min,max,k,ph]}` | `lerp(min, max, .5 − .5·cos(2π·cyc(t,D,k,ph)))` | 呼吸、升降、开合（**首尾必等**） |
| `{"$osc":[amp,k,ph]}` | `amp · sin(2π·cyc(t,D,k,ph))` | 摆动、摇摆（首尾必等） |
| `{"$cyc":[amp,k,ph]}` | `amp · cyc(t,D,k,ph)` | 线性推进后折回：相位、角度转一圈、扫描 |
| `{"$pulse01":[k,ph]}` | `0.5 − 0.5·cos(2π·cyc(…))` | 0→1→0 的脉冲 |
| `{"$steps":[n,k,ph]}` | `min(n−1, floor(cyc(…)×n))` | 幕序号 / 步骤号 / 章节号（**阶跃**） |
| `{"$tween":[from,to,ease]}` | 基于 entry 进度 `p` 的插值 | 入场位移；**跨整段会破坏首尾一致，除非 from==to** |
| `{"$lt":[from,to,ease,den]}` | 基于 `lt/den` 的插值 | 只在前 `den` 秒内发生的事 |

其中 `cyc(t,D,k,ph) = frac(t/D·k + ph)`，`k` 必须是**整数**——这是"无缝循环"的数学保证。
`$wave` / `$osc` / `$cyc` / `$pulse01` / `$steps` 在 `t=0` 与 `t=D` 处取值恒等，所以**只在参数里用它们，循环就不会破**。

例：K22 折纸的翅膀 —— 绕铰点摆动，不用写一行代码：

```json
{ "from": 0, "to": 3, "primitive": "poly", "layer": 20,
  "params": { "pts": [[1044,654],[1238,486],[1156,700]], "pv": [1044,654],
              "rot": { "$osc": [16, 1, 0] },
              "fill": "$paper", "stroke": "$crease", "lineWidth": 1.8 } }
```

---

## 6. 缓动库（`IR.EASE`）

`linear, inQuad, outQuad, inOutQuad, inCubic, outCubic, inOutCubic, inQuart, outQuart, inOutQuart, outQuint, inExpo, outExpo, inOutExpo, inSine, outSine, inOutSine, outCirc, outBack, outBackSoft, inOutBack, outElastic, smoothstep, smootherstep, step, hold`

---

## 7. `render(t)` 契约

```js
IR.renderStyle(pack, t, target, opts)
```

| 参数 | 说明 |
|---|---|
| `pack` | stylePack 对象（不会被修改） |
| `t` | 时间，秒，**必须落在 `[0, duration]`**。播放器不取模——`t=duration` 必须是独立可测的一帧 |
| `target` | canvas 或 2D context。省略时用 `opts.ctx`；再缺就新建离屏 canvas（供服务端/测试用） |
| `opts` | `{dpr, fit:'cover'\|'contain', maxDpr, lod, strict, guides, instance}` |

**七条硬契约（`tools/selftest.mjs` 会逐条查）**

1. **纯函数**：同一 `(pack, t)` 两次渲染的调用序列逐项相同；禁 `Math.random` / `Date.now` / `performance.now` / 跨帧累积状态。
2. **首尾一致**：`render(0)` 与 `render(duration)` 的**全部绘图调用**完全相同 → 循环无接缝、无跳帧。
3. **确定性随机**：只用 `mulberry32(hashStr(seed))`；每条 entry 独立一条流——增删一条不会挪动其它条的画面。
4. **状态卫生**：每条 entry `save()/restore()` 必须配平；`globalAlpha / globalCompositeOperation / setLineDash / lineCap / lineJoin` 进来先复位。
5. **不越界**：内容落在 `layout.safe` 内；`tools/audit.mjs` 用矩阵栈反算包围盒，检查"完全画到画布外"与"文字横向溢出"。
6. **失败兜底**：未知原语或抛异常时，`strict=false` 跳过并 `console.warn`，`strict=true` 直接抛（供 CI）。
7. **LOD**：`opts.lod ∈ [0.15, 1]` 只缩"元素个数"（不低于 1），网格缩略图传 0.5、单格放大传 1；`halftone` 做 mip 式降采样以守恒墨量。

---

## 8. 校验

| 工具 | 作用 |
|---|---|
| `node tools/selftest.mjs` | 解析 / `validatePack` / 首尾一致 / 确定性 / `save-restore` 配平 / 单帧耗时 / 原语覆盖率 |
| `node tools/audit.mjs` | 版式体检：包围盒是否越出画布、文字是否横向溢出（含 `audit.allow.json` 白名单） |
| `node tools/bundle.mjs` | 把 `styles/*.json` + `ir-player.js` 内联成单文件 `index.html`（file:// 可直接打开） |
| `IR.validatePack(pack)` | → `{ok, errors[], warnings[]}`：缺 `id/duration/timeline`、`to<from`、未知原语为 error |

**为什么 JSON 要内联进 index.html**：`file://` 下 `fetch()`/`XHR` 读本地 JSON 会被 Chrome 以 origin `null` 拒绝。`tools/bundle.mjs` 把 10 份 JSON 与播放器一起内联进 `<script type="application/json">` 与 `<script>`，于是**双击即可离线预览，且仍然只有"样式 JSON + 播放器"两个来源**。

---

## 9. 最小可跑示例

```json
{
  "id": "demo-min", "name": "最小示例", "duration": 3,
  "palette": { "bg": "#0B0E15", "fg": "#D6E0F2", "accent": "#F1B25C" },
  "bg": { "type": "solid", "color": "$bg" },
  "timeline": [
    { "from": 0, "to": 3, "primitive": "text", "layer": 10,
      "params": { "x": 960, "y": 540, "align": "center", "size": 96,
                  "font": "serifCJK", "color": "$fg", "lines": ["风格即数据"] } },
    { "from": 0, "to": 3, "primitive": "glow_dot", "layer": 20,
      "params": { "x": 960, "y": 700, "r": 26, "color": "$accent",
                  "pulseK": 1, "pulseAmp": 0.4 } }
  ]
}
```

---

## 10. 已知取舍

- **笔画最细 1.2px**：逻辑画布 1920 宽，缩到 640 的缩略图时 1px 线会消失或变灰；H1 的细线设计因此保留 1.6–1.8px。
- **`fit:'cover'` 会裁边**：非 16:9 容器下按短边填满，靠 `layout.safe` 保证主体不丢。
- **无 SVG/图片素材**：所有"图像"都由路径、字符网格或粒子拼出来，所以是"风格化"而非"写实"。
- **耗时以真实设备为准**：`selftest` 的 ms 来自 Node 的 mock context，只用于横向比较，不代表浏览器实测。
