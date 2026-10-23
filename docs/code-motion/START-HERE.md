# 新窗口从这里开始（代码动效线）

> 你（新的 AI）如果刚打开这个仓库、没有之前对话记忆：
> 先读完这一页，再按顺序读 01→02→03→04，然后看 STATUS.md。
> 不要凭记忆猜，所有规则都在文件里。

## 我们在做什么

把"网上的 CSS/Remotion 动效视频"变成我们插件能用的**代码模板**。
最终目标：用户对任何 AI 许愿 → AI 按规范写模板 → 我们校验/渲染/对比 → 装进插件。

## 阅读顺序

1. 01-代码模板规范-v0.1.md   ← 宪法：怎么写、什么能写、什么不能写
2. 02-交接协议.md             ← AI 输出怎么给、怎么接、不靠人手复制
3. 03-复刻流程.md             ← 从一段参考视频到成品的固定流水线
4. 04-校验器与工具.md         ← 机器怎么帮我们兜底
5. STATUS.md                 ← 现在做到哪、下一步是什么

## 当前样板

- 成功案例：SuperX 15s（Claude 写码，Remotion 渲染，结构基本对齐）
- 代码位置：docs/code-templates/superx-full-15s/
- 对比视频：09-技术验证-remotion/out/superx-full-compare.mp4
- 第二个样板：S5 故障换字（docs/code-templates/glitch-swap/）

## 复活口令（新窗口第一句话）

把下面这段贴给新的 AI：

    读 F:\Lee的GitHub仓库\DeepSeek harness 开机动画\01-源码\docs\code-motion\START-HERE.md
    和 STATUS.md，按里面的流程继续。不要凭记忆，所有规则以文件为准。

## 铁律

- 不靠聊天记忆，靠文件
- 每个决定写进 STATUS.md 或规范，不留在对话里
- 改动前先备份，改完跑校验和渲染
- 不确定就标 ASSUMPTION，不编
