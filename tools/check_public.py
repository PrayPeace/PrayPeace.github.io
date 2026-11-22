#!/usr/bin/env python3
"""공개 데이터 검사. 하나라도 '문제'가 있으면 0이 아닌 값으로 끝나 배포하지 않는다.

  python3 tools/check_public.py [<데이터 폴더=data>] [--private <원본 폴더>] [--characters <characters.json>]

1. 허용 목록 밖의 칸이 있는가 (메모·원본 경로·초안이 새어 나가지 않게)
2. 화면 코드가 기대하는 모양인가 (summary·ending은 문자열, date는 {v,prec,sure})
3. 참조가 맞는가 (시나리오·회차·캠페인·캐릭터 id, 회차와 시나리오가 같은지, id 중복)
4. 날짜가 실제로 있는 날인가
6. --nicknames <세션목록.csv>나 환경 변수 NICKNAMES(GitHub 비밀값)가 있으면 KP·PL 칸의 친구 닉네임이 공개 파일에 낱말로 들어 있지 않은가
5. --private를 주면 원본의 비공개 글(관리 메모·파일 경로·승인 안 된 요약/결말)이 공개 파일 어디에도 없는가
"""
import datetime, json, os, re, sys

args = sys.argv[1:]
opt = lambda k: args[args.index(k) + 1] if k in args else None
DATA = args[0] if args and not args[0].startswith('--') else 'data'
load = lambda d, n: json.load(open(os.path.join(d, n), encoding='utf-8'))
S, SC, CP, PT, META = (load(DATA, n + '.json') for n in ('sessions', 'scenarios', 'campaigns', 'playthroughs', 'meta'))
problems, notes = [], []
bad = problems.append

ALLOW = {
    'sessions': {'id', 'no', 'part', 'title', 'scenarioId', 'playthroughId', 'campaignId', 'rule', 'role', 'aborted', 'pcs', 'date', 'hasSource', 'summary', 'ending'},
    'scenarios': {'id', 'title', 'rule', 'era', 'source', 'sourceSure', 'campaignId', 'author', 'players', 'time', 'genre', 'owned', 'wish'},
    'campaigns': {'id', 'title'},
    'playthroughs': {'id', 'scenarioId', 'status', 'endedAt'},
}
for name, rows in (('sessions', S), ('scenarios', SC), ('campaigns', CP), ('playthroughs', PT)):
    for r in rows:
        extra = set(r) - ALLOW[name]
        if extra:
            bad(f'{name} {r.get("id")}: 허용하지 않은 칸 {sorted(extra)}')

ids = [x['id'] for x in S + SC + CP + PT]
dup = {i for i in ids if ids.count(i) > 1}
if dup:
    bad(f'id 중복: {sorted(dup)}')
sc_ids, cp_ids, pt_by = {x['id'] for x in SC}, {x['id'] for x in CP}, {x['id']: x for x in PT}
chars = None
if opt('--characters'):
    chars = {c['id'] for c in json.load(open(opt('--characters'), encoding='utf-8')) if c.get('이름')}

for s in S:
    sid = s['id']
    for k in ('summary', 'ending'):
        if k in s and not (isinstance(s[k], str) and s[k].strip()):
            bad(f'{sid}: {k}는 비어 있지 않은 글이어야 함')
    if s['scenarioId'] not in sc_ids:
        bad(f'{sid}: 없는 시나리오 {s["scenarioId"]}')
    p = pt_by.get(s['playthroughId'])
    if not p:
        bad(f'{sid}: 회차 상태 기록 없음 {s["playthroughId"]}')
    elif p['scenarioId'] != s['scenarioId']:
        bad(f'{sid}: 회차 {p["id"]}의 시나리오({p["scenarioId"]})와 세션의 시나리오({s["scenarioId"]})가 다름')
    if s.get('campaignId') and s['campaignId'] not in cp_ids:
        bad(f'{sid}: 없는 캠페인 {s["campaignId"]}')
    for pc in s.get('pcs', []):
        if isinstance(pc, str):
            if chars is not None and pc not in chars:
                bad(f'{sid}: 캐릭터 서고에 없는 id {pc}')
        elif set(pc) != {'name'}:
            bad(f'{sid}: 서고 밖 PC는 이름만 담아야 함 {sorted(pc)}')
    d = s.get('date') or {}
    if set(d) != {'v', 'prec', 'sure'}:
        bad(f'{sid}: date 모양이 {{v,prec,sure}}가 아님')
    elif d['prec'] != 'unknown':
        fmt = {'day': '%Y-%m-%d', 'month': '%Y-%m', 'year': '%Y'}.get(d['prec'])
        try:
            datetime.datetime.strptime(d['v'], fmt)
        except Exception:
            bad(f'{sid}: 있을 수 없는 날짜 {d["v"]} ({d["prec"]})')
for sc in SC:
    if sc.get('campaignId') and sc['campaignId'] not in cp_ids:
        bad(f'{sc["id"]}: 없는 캠페인')
for p in PT:
    if p['scenarioId'] not in sc_ids:
        bad(f'{p["id"]}: 없는 시나리오')
    if p['status'] not in ('예정', '진행 중', '완주', '중단', '미확인'):
        bad(f'{p["id"]}: 알 수 없는 상태 {p["status"]}')
    if p.get('endedAt'):
        try:
            datetime.date.fromisoformat(p['endedAt'])
        except Exception:
            bad(f'{p["id"]}: 끝난 날 형식 오류')
for k in ('schema', 'charactersUrl', 'charImgBase'):
    if k not in META:
        bad(f'meta.json: {k} 없음')

if opt('--private'):
    P = opt('--private')
    blob = ''.join(open(os.path.join(DATA, f), encoding='utf-8').read() for f in os.listdir(DATA) if f.endswith('.json'))
    try:
        RV = load(P, 'reviews.json')
    except FileNotFoundError:
        RV = {}
    for s in load(P, 'sessions.json'):
        secret = []
        if s.get('notes'): secret.append(('관리 메모', s['notes']))
        if (s.get('source') or {}).get('file'): secret.append(('원본 파일 경로', s['source']['file']))
        sm = s.get('summary') or {}
        pub = (RV.get('sum:' + s['id']) or {}).get('pub') if 'sum:' + s['id'] in RV else (sm.get('text') if sm.get('status') == 'approved' else None)
        if sm.get('text') and sm['text'] != pub: secret.append(('승인 안 된 요약', sm['text']))
        e, r = s.get('ending'), RV.get('end:' + s['id']) or {}
        if e and not (r.get('st', e.get('status')) in ('ok', 'approved') and r.get('vis', e.get('vis')) == '공개'): secret.append(('공개 안 된 결말', e['text']))
        for label, text in secret:
            if text and json.dumps(text, ensure_ascii=False)[1:-1] in blob:
                bad(f'{s["id"]}: {label}이 공개 파일에 들어 있음')
    for p in load(P, 'playthroughs.json'):
        if p.get('note') and p['note'] in blob:
            bad(f'{p["id"]}: 회차 메모가 공개 파일에 들어 있음')
    notes.append('비공개 원본과 대조함')

# 닉네임 목록: --nicknames <세션목록.csv> 또는 환경 변수 NICKNAMES(쉼표로 나눔, GitHub 비밀값). 목록은 저장소에 두지 않는다.
nick = set()
if opt('--nicknames'):
    import csv
    rows = list(csv.DictReader(open(opt('--nicknames'), encoding='utf-8-sig')))
    nick |= {n.strip() for r in rows for n in [r.get('KP', '')] + r.get('PL(대장 외)', '').split(',') if len(n.strip()) >= 2}
if os.environ.get('NICKNAMES'):
    nick |= {n.strip() for n in os.environ['NICKNAMES'].split(',') if len(n.strip()) >= 2}
nick -= {'PP', '프레이피스', 'PrayPeace'}
if nick:
    blob = ''.join(open(os.path.join(DATA, f), encoding='utf-8').read() for f in os.listdir(DATA) if f.endswith('.json'))
    words = set(re.split(r'[\s_,"\[\]:{}\-.()·/]+', blob))
    for n in sorted(nick & words):
        bad('친구 닉네임으로 보이는 낱말이 공개 파일에 있음 (낱말은 여기 적지 않음)')
    notes.append('닉네임 검사함')

print(f'세션 {len(S)} · 시나리오 {len(SC)} · 캠페인 {len(CP)} · 회차 {len(PT)} · ' + (' · '.join(notes) or '원본 대조 안 함'))
if problems:
    print('문제 %d개:' % len(problems))
    for p in problems:
        print(' -', p)
    sys.exit(1)
print('통과')
