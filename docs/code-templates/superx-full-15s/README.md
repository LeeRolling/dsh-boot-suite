# SuperX 15s（Claude 全片实现）

来源：Claude 按《给Claude的生成提示词》+ 10fps 帧表生成；我们拆分、渲染、对比。

- 结构：tokens.ts / parts.tsx / Main.tsx / Shot_Intro / Shot_Glitch / Shot_Cards / Shot_Particles / Shot_Outro
- 规格：1280x720 / 50fps / 750 帧
- 渲染：`node node_modules\@remotion\cli\remotion-cli.js render src/index.ts SuperX out/x.mp4 --codec=h264`

## 已知依赖

- 字体：本机最好装 Inter 与 Instrument Serif；没有会回退 Arial / Georgia
- 首次渲染前删掉从聊天里粘出来的尾部说明段落（已在本目录清理）

## 对比

- 参考片 15s vs 本实现：结构/节奏接近，质感仍有差距（3D 卡片、粒子、光晕）
