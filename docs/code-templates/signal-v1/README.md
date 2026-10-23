# SIGNAL V1（圣经验证第一版）

12s / 1280x720 / 50fps，用来验证《代码模板规范 v0.1》是否可执行。

- 命题：docs/code-motion/validation/SIGNAL-命题.md
- 自检：SIGNAL-V1-大肥鱼实现.md
- 渲染：node node_modules\@remotion\cli\remotion-cli.js render src/index.ts Signal out/signal-v1.mp4 --codec=h264

## 已知不足

- 未写 ASSUMPTION（违规，规范验证要暴露的问题）
- 3D 面板缺受光/投影；粒子仅 90 个
- 字体依赖系统 Inter