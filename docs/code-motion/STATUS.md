# 状态（每次收工前更新）

更新时间：2026-10-24 04:00

## 已完成

- 验证 Remotion 路线可跑（S5 故障换字 1:1）
- Claude 写出 SuperX 15s 全片（8 个文件、750 帧），渲染成功
- 全片左右对比：结构/节奏基本对齐，质感有差距
- 代码归档：docs/code-templates/superx-full-15s/
- 交接方式验证：用户把 Claude 回复存桌面 txt → 我拆分/修错/渲染

## 进行中

- 代码模板规范 v0.1（本目录 01）
- 交接协议（本目录 02）

## 下一步（按优先级）

1. 写拆包器脚本（txt → 文件，自动清理说明段落）
2. 写校验器最小版（7 条硬约束）
3. 给 SuperX 做"精修帧包"（20fps + 1:1 裁切），6:30 后让 Claude 只改差异段
4. 把 S5 + SuperX 作为两个样板，跑完整流程一遍

## 已知问题

- 字体未内置（Inter / Instrument Serif 缺失时回退）
- 卡片 3D/受光、粒子密度与原片有差距
- GitHub 推送偶尔超时，代码本地已提交

## 2026-10-24 更新：圣经验证启动

- 新命题：SIGNAL（12s），见 validation/SIGNAL-命题.md
- 大肥鱼版已完成：out/signal-v1.mp4，代码归档 docs/code-templates/signal-v1/
- 给 Claude 的验证提示词：validation/给Claude的验证提示词.md
- 对比计划：validation/对比计划.md
- 下一步：Claude 版出来后，按对比计划打分，产出规范 v0.2 增补

## 2026-10-24 04:10：验证提示词改为用户修订版

- 不在提示词里告诉 Claude"这是验证规范"（避免应试）
- 最终提示词：validation/给Claude的验证提示词-用户修订版.md
- 明天：发 Claude → 存 txt → 拆分/渲染/对比


## SIGNAL 验证结果（2026-10-25）

- Claude 版已渲染：`09-技术验证-remotion/out/signal-claude.mp4`（600 帧，2.79 MB）
- 对比：加权 **V1 2.9 / Claude 4.7**（满分 5）
- 客观指标：V1 近黑帧 32%、平均亮度 9.4；Claude 近黑帧 0%、平均亮度 12.9
- 结论：**规范 v0.1 可执行**（Claude 独立完成 7 文件、元素全覆盖、通过渲染），但**缺质量下限**；V1 是“结构合格、画面不可看”的反例
- 已产出：
  - `validation/对比结论.md`
  - `validation/claude-signal/`（源码 + 分镜表 + 两张联系表 + 并排对比）
  - `01-代码模板规范-v0.2-增补.md`（A–F 六组增补）
- 下一步：
  1. 把 v0.2 增补合入规范正文（validator 规则）
  2. 做“许愿式”流水线：AI 交模板 → 自动校验（结构+质量指标）→ 渲染 → 安装
  3. 字体工具链：打包 Inter / JetBrains Mono（或系统安全替代）
  4. 下一轮换命题再验证（避免只对一个题过拟合）


## Validator v0.2（2026-10-25，步骤 1–3 完成）

- 代码：`docs/code-motion/validator/`（validate.mjs / metrics.py）
- 能力：静态检查（结构/规格/禁用项/色彩字体/能力/交付）+ 画面指标（平均亮度/近黑帧/覆盖率）+ 评分门槛
- 首轮结果：
  - Claude SIGNAL 提交：**PASS**（规格、交付、画面全过）
  - 大肥鱼 V1：**FAIL**（近黑帧 31.7%、交付 0/5）
  - 报告：`09-技术验证-remotion/out/validator-{claude,v1}-report.md`
- 第 4 步已就绪：命题 `validation/ORIGAMI-命题.md`，Claude 提示词 `validation/给Claude的验证提示词-ORIGAMI.md`
