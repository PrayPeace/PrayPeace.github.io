#!/usr/bin/env python3
"""비공개 원본 → 공개 데이터(data/*.json).

허용한 칸만 골라 담는다(허용 목록 방식). 원본의 관리 메모·원본 파일 경로·AI 초안·
승인 안 된 결말·회차 메모는 아예 옮기지 않는다.

  python3 tools/build_public.py <원본 폴더> [<출력 폴더=data>]

원본 폴더: sessions.json · scenarios.json · campaigns.json · playthroughs.json · reviews.json
reviews.json은 관리자 작업함의 검토 기록이다.
  sum:<세션id>  {st, pub}      pub = 승인한 요약 글(방문객이 보는 글)
  end:<세션id>  {st, vis}      st=='ok' 이고 vis=='공개' 일 때만 결말을 싣는다
  pt:<회차id>   {status, endedAt}  대장이 확정한 회차 상태
"""
import json, os, sys

SRC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', 'data')
load = lambda n: json.load(open(os.path.join(SRC, n), encoding='utf-8'))
sessions, scenarios, campaigns, pts = (load(n + '.json') for n in ('sessions', 'scenarios', 'campaigns', 'playthroughs'))
try:
    RV = load('reviews.json')
except FileNotFoundError:
    RV = {}

SURE = ('기록 본문', '대장 확인', '실제')


def approved_summary(s):
    r = RV.get('sum:' + s['id'])
    if r is not None:
        return r.get('pub')
    sm = s.get('summary') or {}
    return sm.get('text') if sm.get('status') == 'approved' else None


def public_ending(s):
    e = s.get('ending')
    if not e:
        return None
    r = RV.get('end:' + s['id']) or {}
    st, vis = r.get('st', e.get('status')), r.get('vis', e.get('vis', '비공개'))
    return e['text'] if st in ('ok', 'approved') and vis == '공개' else None


def pub_date(d):
    if not d or not d.get('v'):
        return {'v': None, 'prec': 'unknown', 'sure': False}
    return {'v': d['v'], 'prec': d['prec'], 'sure': any(k in (d.get('src') or '') for k in SURE)}


out_sessions = []
for s in sessions:
    o = {k: s[k] for k in ('id', 'no', 'part', 'title', 'scenarioId', 'playthroughId', 'campaignId', 'rule', 'role', 'aborted') if s.get(k) is not None}
    o['pcs'] = [p if isinstance(p, str) else {'name': p['name']} for p in s.get('pcs') or []]
    o['date'] = pub_date(s.get('date'))
    o['hasSource'] = bool((s.get('source') or {}).get('file'))
    sm, en = approved_summary(s), public_ending(s)
    if sm:
        o['summary'] = sm
    if en:
        o['ending'] = en
    out_sessions.append(o)

out_scen = [{k: sc[k] for k in ('id', 'title', 'rule', 'era', 'source', 'sourceSure', 'campaignId', 'author', 'players', 'time', 'genre', 'owned', 'wish') if sc.get(k) is not None} for sc in scenarios]
out_camp = [{'id': c['id'], 'title': c['title']} for c in campaigns]
out_pts = []
for p in pts:
    r = RV.get('pt:' + p['id'])
    if r:
        st, end = r['status'], r.get('endedAt')
    elif p.get('by') == '대장 확인':
        st, end = p['status'], p.get('endedAt')
    else:
        st, end = '미확인', None
    o = {'id': p['id'], 'scenarioId': p['scenarioId'], 'status': st}
    if end:
        o['endedAt'] = end
    out_pts.append(o)

os.makedirs(OUT, exist_ok=True)
for name, data in (('sessions', out_sessions), ('scenarios', out_scen), ('campaigns', out_camp), ('playthroughs', out_pts)):
    with open(os.path.join(OUT, name + '.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write('\n')
print(f'공개 데이터: 세션 {len(out_sessions)} · 요약 {sum("summary" in s for s in out_sessions)} · 결말 {sum("ending" in s for s in out_sessions)} · 시나리오 {len(out_scen)} · 회차 {len(out_pts)}')
