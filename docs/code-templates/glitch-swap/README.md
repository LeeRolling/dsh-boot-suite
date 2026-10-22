# Glitch Swap（第一个「AI 写代码」模板）

来源：Claude 按《给Claude的生成提示词》任务卡 1 生成，经 3 轮渲染-看图-修改。

- `tokens.ts` / `Shot_GlitchSwap.tsx`：Remotion 组件（50fps，110 帧）
- 效果：S5 故障换字，`= VOGUE` → `= ?`
- 渲染命令（Windows）：

~~~
node node_modules\@remotion\cli\remotion-cli.js render src/index.ts GlitchSwap out/x.mp4 --codec=h264 --browser-executable="C:\Program Files\Google\Chrome\Application\chrome.exe"
~~~

## 已知差距

- 字体仍为系统 mono，参考是几何无衬线
- 光晕/模糊仍偏弱
- RGB 彩边位置已接近
