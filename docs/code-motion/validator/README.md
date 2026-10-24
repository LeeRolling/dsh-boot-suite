# Validator（v0.2 质量闸门）

## 用法

~~~bash
# 只看文件（Claude 回复 txt 或源码目录）
node tools/validator/validate.mjs --submission <目录|txt>

# 加上已有视频的画面指标
node tools/validator/validate.mjs --submission <目录> --video out/xxx.mp4

# 先渲染再检查（需要提交已注册为 Remotion Composition）
node tools/validator/validate.mjs --submission <目录> --render --composition SignalClaude
~~~

## 检查项

1. 结构：tokens / parts / Main / 镜头文件 / 文件块无说明混入
2. 规格：分辨率 / 帧率 / 帧数
3. 确定性：Math.random / Date.now / setTimeout / setInterval / CSS animation / transition
4. 视觉约束：≤4 色、≤2 字体
5. 能力覆盖：网格/准星/打字机/3D/进度/扫描/粒子/描边/故障（启发式，不计入 pass）
6. 交付：ASSUMPTION / 分镜表 / 自检表 / 风险取舍
7. 画面：平均亮度 ≥10、近黑帧 ≤5%、内容覆盖率 ≥10%
