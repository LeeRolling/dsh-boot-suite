# -*- coding: utf-8 -*-
"""解析 341 风格提示词 → style.index.json + 统计.md（不调模型）"""
import json, re
from pathlib import Path

ROOT = Path(r"E:\代码动画_341种风格提示词_免费\代码动画_341种风格提示词_免费\代码动画")
OUT = Path(r"F:\Lee的GitHub仓库\DeepSeek harness 开机动画\01-源码\docs\风格库")
OUT.mkdir(parents=True, exist_ok=True)

GROUPS = {
    "A-G_代码样片": "A-G", "H_现成版式": "H", "K_卡通画风": "K",
    "L_Lemo-Opuscar": "L", "M_动态风格": "M", "O_奥斯卡98部": "O",
    "R_照参考学来的": "R", "V_mg-styles-15": "V",
    "X_code-video": "X", "Z_中国风": "Z",
}
style_root = ROOT / "风格提示词"

DUR_RE = re.compile(r"(?<![\d.])(\d+(?:\.\d+)?)\s*(分钟|分|秒钟|秒|s|sec)")
MS_RE = re.compile(r"(?<![\d.])(\d{1,2}):([0-5]\d)(?![\d:])")
RES_RE = re.compile(r"(\d{3,4})\s*[x×]\s*(\d{3,4})")


def sections(text):
    secs, cur, buf = {}, None, []
    for line in text.splitlines():
        if line.startswith("#"):
            if cur is not None:
                secs[cur] = "\n".join(buf).strip()
            m = re.match(r"#+\s*(.+)", line)
            cur = m.group(1).strip() if m else None
            buf = []
        else:
            buf.append(line)
    if cur is not None:
        secs[cur] = "\n".join(buf).strip()
    return secs


def find_durs(text):
    out = []
    for m in DUR_RE.finditer(text):
        v = float(m.group(1))
        unit = m.group(2)
        sec = v * 60 if unit in ("分钟", "分") else v
        ctx = text[max(0, m.start() - 35):m.end() + 35].replace("\n", " ")
        out.append({"sec": round(sec, 2), "raw": m.group(0).strip(), "ctx": ctx})
    for m in MS_RE.finditer(text):
        sec = int(m.group(1)) * 60 + int(m.group(2))
        ctx = text[max(0, m.start() - 35):m.end() + 35].replace("\n", " ")
        out.append({"sec": sec, "raw": m.group(0), "ctx": ctx})
    return out


rows = []
for gdir, gkey in GROUPS.items():
    for p in sorted((style_root / gdir).glob("*.md")):
        text = p.read_text(encoding="utf-8", errors="replace")
        name = p.stem
        m = re.match(r"^([A-Z]{1,2}\d{1,3})[_\s\-]+(.*)$", name)
        sid = m.group(1) if m else name
        title = (m.group(2).strip() if m else name) or name
        secs = sections(text)
        durs = find_durs(text)
        durs_sorted = sorted(durs, key=lambda d: -d["sec"])
        max_sec = durs_sorted[0]["sec"] if durs_sorted else None
        # 关键词/要点
        kw = ""
        for k, v in secs.items():
            if "关键" in k or "要点" in k or "标签" in k:
                kw = v[:300]
                break
        prompt_text = ""
        for k, v in secs.items():
            if "提示词" in k:
                prompt_text = v[:400]
                break
        if not prompt_text:
            prompt_text = "\n\n".join(secs.values())[:400]
        rows.append({
            "id": sid, "group": gkey, "file": p.name, "title": title,
            "chars": len(text),
            "still": p.with_suffix(".jpg").exists(),
            "code_blocks": text.count("```") // 2,
            "sections": list(secs.keys()),
            "durations": durs_sorted[:6],
            "max_sec": max_sec,
            "resolutions": sorted(set(f"{a}x{b}" for a, b in RES_RE.findall(text))),
            "external": sorted(set(re.findall(r"https?://[^\s'\"\)]+", text)))[:5],
            "keywords": kw,
            "excerpt": prompt_text,
        })

# 示例目录（两组实测的提示词）
examples = []
for p in sorted((ROOT / "示例").rglob("*.md")):
    if "第三方许可" in str(p):
        continue
    text = p.read_text(encoding="utf-8", errors="replace")
    examples.append({"file": str(p.relative_to(ROOT)), "chars": len(text),
                     "excerpt": text[:400]})

data = {"root": str(ROOT), "total": len(rows), "styles": rows, "examples": examples}
(OUT / "style.index.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")

# ---------- 统计 ----------
from collections import Counter
by_group = Counter(r["group"] for r in rows)
still_by_group = Counter(r["group"] for r in rows if r["still"])
code_by_group = Counter(r["group"] for r in rows if r["code_blocks"])
all_durs = [(d["sec"], r["id"], r["title"], d["raw"]) for r in rows for d in r["durations"]]
all_durs.sort(key=lambda x: -x[0])
longest_item = [(r["max_sec"], r["id"], r["title"]) for r in rows if r["max_sec"]]
longest_item.sort(key=lambda x: -x[0])
buckets = Counter()
for r in rows:
    s = r["max_sec"]
    if s is None:
        buckets["无时长声明"] += 1
    elif s < 15:
        buckets["<15s"] += 1
    elif s < 30:
        buckets["15-30s"] += 1
    elif s < 60:
        buckets["30-60s"] += 1
    elif s < 120:
        buckets["60-120s"] += 1
    elif s < 300:
        buckets["120-300s"] += 1
    else:
        buckets[">=300s"] += 1

lines = []
lines.append("# 341 风格提示词 · 结构化统计\n")
lines.append(f"- 根目录：`{ROOT}`")
lines.append(f"- 风格总数：**{len(rows)}**；带静帧：**{sum(1 for r in rows if r['still'])}**")
lines.append(f"- 分组：" + "，".join(f"{g} {n}" for g, n in sorted(by_group.items())))
lines.append(f"- 带代码块风格：{sum(1 for r in rows if r['code_blocks'])}")
lines.append(f"- 含外部链接风格：{sum(1 for r in rows if r['external'])}\n")
lines.append("## 时长声明分布（按每篇最长声明）\n")
for k in ["无时长声明", "<15s", "15-30s", "30-60s", "60-120s", "120-300s", ">=300s"]:
    if buckets.get(k):
        lines.append(f"- {k}: {buckets[k]}")
lines.append("\n## 声明时长最长的 20 个风格\n")
lines.append("| id | 风格 | 声明 |\n|---|---|---|")
for sec, sid, title in longest_item[:20]:
    lines.append(f"| {sid} | {title} | {sec:g}s（{sec/60:.2f}min） |")
lines.append("\n## 全部时长声明中最大的 20 条（含上下文）\n")
for sec, sid, title, raw in all_durs[:20]:
    lines.append(f"- {sec:g}s · {sid} {title} · 「{raw}」")
lines.append("\n## 分辨率提及统计\n")
res = Counter(x for r in rows for x in r["resolutions"])
for k, n in res.most_common(12):
    lines.append(f"- {k}: {n}")
lines.append("\n## 分组明细\n")
lines.append("| 组 | 数量 | 带静帧 | 带代码 |\n|---|---|---|---|")
for g in ["A-G", "H", "K", "L", "M", "O", "R", "V", "X", "Z"]:
    lines.append(f"| {g} | {by_group[g]} | {still_by_group[g]} | {code_by_group[g]} |")
(OUT / "统计.md").write_text("\n".join(lines), encoding="utf-8")
print("OK", len(rows), "styles ->", OUT / "style.index.json")
print("max declared duration:", all_durs[0][:2] if all_durs else None)
