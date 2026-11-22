#!/usr/bin/env python3
"""비공개 원본 → 관리자 작업함용 묶음 하나(JSON). 깃허브에 올리지 않는다.

  python3 tools/build_private.py <원본 폴더> <출력 파일>

출력 파일은 대장 드라이브에 'praypeace-archives-private.json' 이름으로 올린다.
웹 앱(pa_get)이 관리자에게만 이 내용을 준다. 요약·결말 초안, 관리 메모, 회차 메모가 들어 있다.
"""
import json, os, sys

SRC, OUT = sys.argv[1:3]
load = lambda n: json.load(open(os.path.join(SRC, n + '.json'), encoding='utf-8'))
o = {'sessions': {}, 'playthroughs': {}}
for s in load('sessions'):
    x = {k: s[k] for k in ('summary', 'ending', 'notes') if s.get(k)}
    pcs = [p for p in s.get('pcs') or [] if isinstance(p, dict) and p.get('note')]
    if pcs:
        x['pcNotes'] = pcs
    if x:
        o['sessions'][s['id']] = x
for p in load('playthroughs'):
    x = {k: p[k] for k in ('status', 'by', 'note', 'endedAt') if p.get(k)}
    if x.get('by') == 'AI 추정' and x.get('note') == '세션 목록 표에서 자동으로 만든 회차':
        continue  # 자동으로 만든 빈 회차는 공개 데이터의 '미확인'과 같음
    o['playthroughs'][p['id']] = x
# 추억 후보(명대사·주사위·웃긴 장면·감동 장면): 대장이 작업함에서 승인한 것만 추억관에 걸린다
mp = os.path.join(SRC, 'memories.json')
if os.path.exists(mp):
    o['memories'] = {m['id']: {k: m[k] for k in ('sessionId', 'kind', 'who', 'text', 'friends', 'status', 'vis') if k in m}
                     for m in json.load(open(mp, encoding='utf-8'))}
json.dump(o, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f"비공개 묶음: 세션 {len(o['sessions'])} · 회차 {len(o['playthroughs'])} · 추억 후보 {len(o.get('memories', {}))} · {os.path.getsize(OUT)} 바이트")
