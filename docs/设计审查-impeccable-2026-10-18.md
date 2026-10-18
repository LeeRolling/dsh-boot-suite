# 设计审查 · impeccable 自动检测（2026-10-18）

工具：`npx impeccable detect`（61 条确定性规则，不需要 LLM / API key）
版本：impeccable@4.6.0

## 首轮（编辑器 + 预览页）

| 文件 | 发现 | 说明 |
|---|---|---|
| `tools/editor.html` | 1 | 主按钮 hover 态：白字在 `#4a73ff` 上 **4.05:1**，不达 4.5:1 |
| `preview/index.html` | 18 | 白底灰字 `#8a8b93` 只有 3.4:1；`#a9aaae` 2.0:1；11px 小字 ×5；零偏移辉光 ×1；装饰条纹 ×1 |

## 已修

- 编辑器主按钮 hover 改为 `#3f68f5`（白字 4.66:1）
- 预览页灰字 `#8a8b93` → `#6a6b72`（5.4:1），`#a9aaae` → `#6f7076`

## 复测

19 → **8** 条，全部落在 `preview/index.html`：

- advisory 对比度 1 条（4.3:1，接近阈值）
- 11px 小字 5 条（预览页的说明文字，属刻意紧凑）
- 零偏移 text-shadow 辉光 1 条（装饰，故意）
- repeating-gradient 条纹 1 条（装饰，故意）

编辑器本体：**0 条**。

## 结论

**有用，但不必装进 DSH**：

- 它的强项是"确定性检测"，适合当**发布前检查**，一条命令的事
- 24 个命令 / `.dsh/skills` 安装那套，对我们的收益不如 `detect` 本身大
- 建议：把 detect 写进发布流程（见 `package.json` 的 `ui:detect`），暂不安装 skill
