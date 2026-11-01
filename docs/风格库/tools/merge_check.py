# -*- coding: utf-8 -*-
"""校验 4 个批次的 style params jsonl，汇总权威统计并写 _汇总.json。"""
import json, glob, os, collections

d = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tier_name = {'可执行': '可执行', '意象': '意象'}
allrows = []
per = {}
for f in sorted(glob.glob(os.path.join(d, 'params', 'batch-*.jsonl'))):
    rows = []
    bad = 0
    for line in open(f, encoding='utf-8-sig'):
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except Exception:
            bad += 1
    per[os.path.basename(f)] = rows
    allrows += rows
    tiers = collections.Counter(r.get('tier') for r in rows)
    durs = [r['durationDeclared'] for r in rows if r.get('durationDeclared')]
    print(f"{os.path.basename(f)}: lines={len(rows)} bad={bad} groups={dict(collections.Counter(r.get('group') for r in rows))} tiers={dict(tiers)} durn={len(durs)} max={max(durs) if durs else None}")

ids = [r['id'] for r in allrows]
idx = json.load(open(os.path.join(d, 'style.index.json'), encoding='utf-8'))
idx_styles = idx['styles'] if isinstance(idx, dict) else idx
idx_ids = {s['id'] for s in idx_styles}
print(f"\nTOTAL rows={len(allrows)} unique={len(set(ids))} dups={[k for k, v in collections.Counter(ids).items() if v > 1]}")
print("coverage vs style.index:", len(idx_ids & set(ids)), "/", len(idx_ids), "missing:", sorted(idx_ids - set(ids))[:10], "extra:", sorted(set(ids) - idx_ids)[:10])
print("tier:", dict(collections.Counter(r.get('tier') for r in allrows)))

durs = [r['durationDeclared'] for r in allrows if r.get('durationDeclared')]
ds = sorted(durs, reverse=True)
print(f"\n声明时长非空 {len(durs)}/341；max={ds[0] if ds else None}；Top20={ds[:20]}")
if durs:
    s = sorted(durs)
    n = len(s)
    print(f"median={s[n // 2]}  p90={s[int(n * 0.9) - 1]}")
    print("分布:", dict(sorted(collections.Counter(durs).items())))

empty = [r['id'] for r in allrows if r.get('tier') == '意象' and not r.get('palette') and r.get('texture') in (None, '', '无') and not r.get('durationDeclared')]
print("空占位候选:", empty)
missing_fields = 0
for r in allrows:
    for k in ('id', 'group', 'title', 'scene', 'tier', 'palette', 'type', 'texture', 'motion', 'layoutRules', 'learnings', 'durationDeclared', 'assumptions'):
        if k not in r:
            missing_fields += 1
print("顶层字段缺失数:", missing_fields)

summary = {
    'total': len(allrows),
    'tier': dict(collections.Counter(r.get('tier') for r in allrows)),
    'duration_non_null': len(durs),
    'duration_max': ds[0] if ds else None,
    'duration_top20': ds[:20],
    'duration_dist': {str(k): v for k, v in sorted(collections.Counter(durs).items())},
    'empty_placeholders': empty,
    'per_batch': {k: len(v) for k, v in per.items()},
    'coverage': f"{len(idx_ids & set(ids))}/{len(idx_ids)}",
}
out = os.path.join(d, 'params', '_汇总.json')
with open(out, 'w', encoding='utf-8') as fh:
    json.dump(summary, fh, ensure_ascii=False, indent=1)
print("\nwrote", out)
