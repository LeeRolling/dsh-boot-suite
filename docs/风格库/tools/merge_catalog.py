# -*- coding: utf-8 -*-
"""把 4 批精读参数合并进风格目录（style.index.json 结构信息 + batch 参数）。"""
import json, os, glob, collections

d = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
idx = json.load(open(os.path.join(d, 'style.index.json'), encoding='utf-8'))
styles = idx['styles'] if isinstance(idx, dict) else idx

params = {}
for f in sorted(glob.glob(os.path.join(d, 'params', 'batch-*.jsonl'))):
    for line in open(f, encoding='utf-8-sig'):
        line = line.strip()
        if line:
            r = json.loads(line)
            params[r['id']] = r

catalog = []
for s in styles:
    sid = s['id']
    p = params.get(sid, {})
    catalog.append({
        'id': sid,
        'group': s.get('group') or p.get('group'),
        'title': s.get('title') or p.get('title'),
        'folder': s.get('folder'),
        'still': s.get('still'),
        'scene': p.get('scene') or s.get('scene'),
        'usage': s.get('usage'),
        'tier': p.get('tier'),
        'durationDeclared': p.get('durationDeclared'),
        'palette': p.get('palette'),
        'type': p.get('type'),
        'texture': p.get('texture'),
        'motion': p.get('motion'),
        'layoutRules': p.get('layoutRules'),
        'learnings': p.get('learnings'),
        'assumptions': p.get('assumptions'),
        'durText': s.get('dur_text') or s.get('durText'),
        'durHints': s.get('durationHints') or s.get('duration_hints'),
        'src': s.get('src'),
    })

out = os.path.join(d, 'style.catalog.json')
with open(out, 'w', encoding='utf-8') as fh:
    json.dump({'version': 1, 'total': len(catalog), 'styles': catalog}, fh, ensure_ascii=False)

tiers = collections.Counter(c['tier'] for c in catalog)
durs = [c['durationDeclared'] for c in catalog if c['durationDeclared']]
top = collections.Counter(durs).most_common(12)
print('catalog:', len(catalog), 'tiers:', dict(tiers), 'dur_nonnull:', len(durs), 'max:', max(durs) if durs else None)
print('top durations:', top)
print('missing params:', [c['id'] for c in catalog if not c['tier']])
# 各组 tier/时长摘要
by = collections.defaultdict(lambda: {'n': 0, 'exec': 0, 'max': 0})
for c in catalog:
    g = c['group']; by[g]['n'] += 1
    if c['tier'] == '可执行': by[g]['exec'] += 1
    if c['durationDeclared']: by[g]['max'] = max(by[g]['max'], c['durationDeclared'])
print('groups:', {k: dict(v) for k, v in sorted(by.items())})
print('wrote', out, os.path.getsize(out))
