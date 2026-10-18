# AGENTS.md · 工作规范（每个会话开始先读这份）

> 这份文件是给"下一个我"看的：上下文被压缩、或者换了会话，先读这里，别重新摸索。
> 最后更新：2026-10-18 · 版本 2.6.0

## 一、项目坐标

| 东西 | 路径 |
|---|---|
| 源码根目录 | `F:\Lee的GitHub仓库\DeepSeek harness 开机动画\01-源码` |
| 仓库 | https://github.com/LeeRolling/dsh-boot-suite |
| 模板商店数据源 | https://github.com/LeeRolling/dsh-boot-suite-templates |
| 备份目录 | `...\08-备份\known-good-<版本>-<说明>` |
| 发布包 | `...\03-发布包\dsh-boot-suite.tgz` |
| 参考 skill（本地） | `F:\Lee的GitHub仓库\_vendor\refactoring-ui-skill` |
| 诊断日志 | `~/.dsh/boot-suite-diag.log` |
| 用户配置 | `~/.dsh/dsh-startup.json`、`~/.dsh/chat-wallpaper.json` |

## 二、硬规则（违反过，代价很大）

1. **改之前先备份**：整仓快照进 `08-备份`；用户明确要求"凡事都要留 backup"。
2. **插件绝不黑屏**：缺模板/缺素材/字段坏了 → 一律回落默认，不能把界面锁死。
3. **模板只能是数据**：template.json 里不许出现可执行代码。
4. **自定义路由必须过信任栅栏**：`registerRoute` 已包了 `connection.requestRejection`，别绕开。
5. **首帧注入走 index 行**：`script-src` 行才会执行；`html` 行里的 `<script>` 在桌面端不跑。
6. **作者字段如实标**：`author` 写原作者，`adaptedBy` 写改版者（沈宏宏的作品不能署成自己的）。
7. **用户目录优先**：`~/.dsh/startup-templates` 覆盖内置同名模板，别写反。
8. **.cmd 必须纯 ASCII**：UTF-8 无 BOM 的 .cmd 会被当 GBK 执行成乱码。
9. **PowerShell 5.1 读 UTF-8** 用 `[System.IO.File]::ReadAllText`，别用 `Get-Content`。

## 三、每轮收尾清单（做完功能必跑）

```powershell
cd "F:\Lee的GitHub仓库\DeepSeek harness 开机动画\01-源码"
npm test                     # 全套断言：host + splash + client + desktop + merge
npm run motion:check         # 动效回归：画面在动/分幕换过/根节点移除/无异常
npm run ui:detect            # impeccable 61 条规则（需要网络，跑不跑都可）
```

然后：`git add -A` → 提交（中文说明"为什么"）→ push → 如有发版：tag + `gh release create`。
**push 完成要用 `git ls-remote` 核对远端**，网络经常 reset，命令"看起来成功"不算数。

## 四、impeccable 的用法（2026-10-18 决定：只当发布前检查，不装 skill）

```powershell
npx --yes impeccable@latest detect --json --no-config tools/editor.html preview/index.html
```

- 61 条确定性规则，不需要 LLM；发现问题会以 `warning` / `advisory` 标出
- 已知历史：编辑器主按钮 hover 4.05:1 已被抓过并修成 `#3f68f5`
- 预览页剩余的 11px 小字 / 装饰条纹属刻意，不用修

## 五、常用命令与路径

| 用途 | 命令 |
|---|---|
| DSH CLI | `C:\Users\Admin\AppData\Local\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd` |
| pnpm | `...\resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.cjs` |
| Chrome（截图/验证） | `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| 打包 | `npm pack --pack-destination ..\03-发布包` 然后重命名成 `dsh-boot-suite.tgz` |
| 编辑器官网入口 | 设置 →「启动动画」→「打开模板编辑器」 |

## 六、验证套路（别靠"应该没问题"）

- **动画类**：`tools/motion-check.mjs`（headless Chrome，按真实时间跑，断言帧差异/文案变化/收尾）
- **UI 类**：`npx impeccable detect`（对比度/字号/阴影/装饰规则）
- **截图**：CDP 实时抓帧（不要用 virtual time，会把 CSS 动画冻住）；GIF 用 Pillow 合成，没有 ffmpeg
- **宿主路由**：`test/smoke-host.mjs` 里 stub 掉 `globalThis.fetch`，不碰真网络

## 七、踩过的坑（重复率很高）

| 坑 | 表现 | 修法 |
|---|---|---|
| 类名撞车 | 终端身份卡用了 `.dsu-card`，和档案版式里原有小卡冲突 | 加前缀 `dsu-term-card-` |
| 归一化白名单 | 模板自定义字段（`screen`）被 `normalizeSteps` 丢掉 | 在归一化里显式加字段 |
| 客户端提前 return | 宿主注入成功时 `selfBoot()` 直接返回，`injectRoot()` 里的逻辑全不执行 | 关键逻辑提到 `apply()` 级 |
| 标题栏透明化 | DSH preload 量 `body>span` 探针颜色再 IPC 重画 | 解析阶段就插样式（`BOOTSTRAP_JS`），不是客户端挂载时 |
| 双订阅 | `ctx.inject` 与 `ctx.on` 同时订阅 → 两个启动根 → 黑屏 | 互斥订阅 + `contributeRows` 幂等 |
| 早退不揭幕 | 单幕播放播完接终幕，看起来"闪到最后一屏" | 有 `count` 时播完停住 |

## 八、文档索引（压缩后按需读）

| 想知道 | 读 |
|---|---|
| 引擎现在能做什么 | `docs/引擎能力清单.md` |
| 模板 JSON 怎么写 | `docs/模板格式.md` |
| 时间线编辑器怎么做 | `docs/编辑器v2-时间线规格.md` |
| 动效参数（弹簧/错峰） | `docs/引擎v2-动效物理参数.md` |
| 设计审查记录 | `docs/设计走查-编辑器-2026-10-18.md`、`docs/设计审查-impeccable-2026-10-18.md` |
| 参考动画拆解 | `docs/参考分析-龙娘启动动画.md`、`docs/出图要求-描线动画.md` |
| 术语中英对照 | `docs/术语表.md` |
| 干音怎么录 | `docs/干音台词单-深海声呐.md` |

## 九、人机协作约定

- 需要在真实客户端里看效果的，一律给**明确的 human gate 清单**（看什么、期望什么、不对反馈什么）
- 用户是创作者不是程序员：能点就别让他打字；能预览就别让他重启
- 不确定就问，别猜着做；做错了直接认，别圆
