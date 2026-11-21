#!/usr/bin/env python3
"""세션 목록 표(CSV) → 비공개 원본(sessions·scenarios·playthroughs.json)에 빠진 세션을 채운다.

  python3 tools/import_list.py <세션목록.csv> <유튜브_녹화목록.csv> <characters.json> <원본 폴더>

- 이미 원본에 있는 세션(같은 번호, 번호 없으면 같은 원본 파일)은 건드리지 않는다. 손으로 다듬은 기록이 이긴다.
- 대장 PC는 캐릭터 서고의 '연대기'(세션 번호)와 표의 '대장 PC' 칸에서 찾는다. '?'가 붙은 짐작은 넣지 않는다.
- KP·PL 닉네임은 원본에도 옮기지 않는다(공개 저장소에 친구 닉네임 금지). 대장이 KP면 role=KP만 남긴다.
- 날짜는 유튜브 설명란 플레이 날짜(영상 1개일 때) → 파일 작성일 순. 둘 다 '추정'으로 보인다.
- 회차 상태는 '미확인'. 완주 여부는 대장이 작업함에서 확정한다.
"""
import csv, json, os, re, sys, collections

LIST, YT, CHARS, SRC = sys.argv[1:5]
ME = {'PP', '프레이피스', 'PrayPeace'}
load = lambda n: json.load(open(os.path.join(SRC, n + '.json'), encoding='utf-8'))
sessions, scenarios, pts, campaigns = load('sessions'), load('scenarios'), load('playthroughs'), load('campaigns')
rows = list(csv.DictReader(open(LIST, encoding='utf-8-sig')))
chars = json.load(open(CHARS, encoding='utf-8'))

# 세션 번호 → 대장 PC (캐릭터 서고 연대기)
by_no = collections.defaultdict(list)
for c in chars:
    for e in c.get('연대기') or []:
        if e and str(e[0]).isdigit() and c['id'] not in by_no[int(e[0])]:
            by_no[int(e[0])].append(c['id'])
name_id = {c['이름']: c['id'] for c in chars if c.get('이름')}

# 세션 번호 → 유튜브 설명란 플레이 날짜
yt = collections.defaultdict(list)
for y in csv.DictReader(open(YT, encoding='utf-8-sig')):
    if y['세션 번호'].isdigit() and re.fullmatch(r'\d{4}-\d\d-\d\d', y['플레이 날짜(설명란)'] or ''):
        yt[int(y['세션 번호'])].append(y['플레이 날짜(설명란)'])

RULE_WORDS = ['펄프 CoC', '펄프CoC', 'CoC', '언리미티드월드', 'UW', 'DnD', '피아스코', '크라임씬', '리얼월드', '너냐?!', '너나?!', '1시간히어로', '탐공사', '에모크로아', '시노비가미', '인세인', '던전월드', '던전 월드',
              '저녁노을어스름', '저녁노을 어스름', '조선아곤', '아곤', '둘이서 수사', '머더미스터리', '아리안로드', '카미가카리', '무협']
RULE_RE = re.compile(r'^(' + '|'.join(map(re.escape, RULE_WORDS)) + r')[\s_\-:]*')


RULE_NAME = {'펄프 CoC': 'CoC', '펄프CoC': 'CoC', '언리미티드월드': 'UW', '너나?!': '너냐?!', '던전 월드': '던전월드', '저녁노을 어스름': '저녁노을어스름'}


def rule_of(row):
    r, t = row['룰'].strip(), row['시나리오'].strip()
    if r and r != '기타':
        return r
    m = RULE_RE.match(t)
    return RULE_NAME.get(m.group(1), m.group(1)) if m else '기타'


# 친구 닉네임(KP·PL 칸)이 제목에 끼어든 경우 지운다. 닉네임 자체는 어디에도 저장하지 않는다.
NICK = {n.strip() for r in rows for n in [r['KP']] + r['PL(대장 외)'].split(',') if len(n.strip()) >= 2} - ME


def clean_title(t):
    t = t.strip().lstrip('-').strip()
    for n in NICK:  # "제목닉1,닉2]" 처럼 참가자 목록이 붙은 줄
        i = t.find(n + ',')
        if i > 0 and t.endswith(']'):
            t = t[:i]
    toks = [x for x in re.split(r'(\s+|_)', t) if x not in NICK]
    return ''.join(toks).strip(' _')


def scen_title(t):
    full = t.strip()
    t = RULE_RE.sub('', full) or full
    if t in ('단편', '1판') or re.fullmatch(r'추리물 \d판', t):
        t = full
    t = re.sub(r'\s*\((텍|하드모드|\d+시간|전투 개변)\)', '', t)
    return t.strip(' _-')


key = lambda t: re.sub(r'[\s_\-·:,.!?~\'"()]', '', t).lower()


def part_of(t, known=()):
    m = re.search(r'\s(\d)부$|\s(\d)$', t)
    if m:
        return re.sub(r'\s\d부$|\s\d$', '', t).strip(), int(m.group(1) or m.group(2))
    m = re.search(r'(\D)(\d)$', t)  # "강도가 되는거야2" — 앞부분이 이미 있는 시나리오일 때만
    if m and key(t[:-1]) in known:
        return t[:-1].strip(), int(m.group(2))
    return t, None


have_no = {s['no'] for s in sessions if s.get('no') is not None}
have_file = {os.path.basename((s.get('source') or {}).get('file', '')) for s in sessions}
sc_by_key = {key(sc['title']): sc for sc in scenarios}
for s in sessions:  # 손 기록 세션 제목으로도 시나리오를 찾게
    if s.get('scenarioId'):
        sc_by_key.setdefault(key(part_of(scen_title(s['title']))[0]), next(x for x in scenarios if x['id'] == s['scenarioId']))
pt_ids = {p['id'] for p in pts}
last_pt = {}  # 시나리오 id → (마지막 회차 id, 마지막 부)
added = collections.Counter()
xn = 0
for row in rows:
    no = int(row['번호']) if row['번호'].strip().isdigit() else None
    title = clean_title(row['시나리오'])
    if row['룰'].strip() == 'UW' and not title.startswith(('UW', '무협')):
        title = 'UW ' + RULE_RE.sub('', title)
    fname = os.path.basename(row['원본 파일'].replace('\\', '/').split(' (+')[0].strip()) if row['원본 파일'] else ''
    if not title or '캐릭터 배경' in title:
        continue
    if (no is not None and no in have_no) or (fname and fname in have_file) or (no is None and '뜯어먹힌' in title):
        continue
    if no is None:
        xn += 1
    sid = f's-{no:03d}' if no is not None else f's-x{xn:02d}'
    rule = rule_of(row)
    base, part = part_of(scen_title(title), sc_by_key)
    k = key(base)
    sc = sc_by_key.get(k)
    chapter = None
    if not sc and re.search(r'\s-\s?\S', base):  # "니알라토텝의 가면들 -뉴욕" → 같은 캠페인 시나리오의 한 장
        head = key(re.split(r'\s-\s?', base)[0])
        sc = sc_by_key.get(head)
        chapter = sc and min((p for p in pts if p['scenarioId'] == sc['id']),
                             key=lambda p: min((abs((x.get('no') or 0) - (no or 0)) for x in sessions if x.get('playthroughId') == p['id']), default=999))
    if not sc:
        sc = {'id': 'sc-' + (f'{no:03d}' if no is not None else f'x{xn:02d}'), 'title': base, 'rule': rule, 'source': '미확인'}
        for cp in campaigns:  # "유랑야담 응천부" → 유랑야담 캠페인
            ck = key(re.sub(r'\s*(장기팀|캠페인)$', '', cp['title']))
            if len(ck) >= 3 and k.startswith(ck):
                sc['campaignId'] = cp['id']
        scenarios.append(sc); sc_by_key[k] = sc; added['scenario'] += 1
    # 회차: 같은 시나리오의 다음 부(part)면 같은 회차, 아니면 새 회차(다시 한 판)
    prev = last_pt.get(sc['id'])
    if chapter:
        ptid = chapter['id']
        part = 1 + sum(1 for x in sessions if x.get('playthroughId') == ptid and (x.get('no') or 0) < (no or 0))
    elif prev and part and prev[1] and part == prev[1] + 1:
        ptid = prev[0]
    else:
        n = 1
        while f'pt-{sc["id"][3:]}-{n}' in pt_ids:
            n += 1
        ptid = f'pt-{sc["id"][3:]}-{n}'
        pts.append({'id': ptid, 'scenarioId': sc['id'], 'status': '미확인', 'by': 'AI 추정', 'note': '세션 목록 표에서 자동으로 만든 회차'})
        pt_ids.add(ptid); added['playthrough'] += 1
    last_pt[sc['id']] = (ptid, part or 1)
    pcs = list(by_no.get(no, [])) if no is not None else []
    for n in re.split(r'[,/]', row['대장 PC']):
        n = n.strip()
        if n and not n.endswith('?'):
            p = name_id.get(n, None)
            if p and p not in pcs:
                pcs.append(p)
            elif not p and n not in [x.get('name') for x in pcs if isinstance(x, dict)]:
                pcs.append({'name': n, 'note': '서고에 없음'})
    d = row['날짜(파일 작성일 기준)'].strip()
    ytd = yt.get(no) if no is not None else None
    if ytd and len(set(ytd)) == 1:
        date = {'v': ytd[0], 'prec': 'day', 'src': '영상 설명란(추정)'}
    elif re.fullmatch(r'\d{4}-\d\d-\d\d', d):
        date = {'v': d, 'prec': 'day', 'src': '파일 작성일'}
    else:
        date = {'v': None, 'prec': 'unknown', 'src': None}
    s = {'id': sid, 'no': no, 'part': part, 'title': title, 'scenarioId': sc['id'], 'playthroughId': ptid, 'rule': rule,
         'date': date, 'role': 'KP' if row['KP'].strip() in ME else 'PL', 'pcs': pcs}
    if sc.get('campaignId'):
        s['campaignId'] = sc['campaignId']
    if row['원본 파일']:
        s['source'] = {'file': fname}
    if row['녹화'] == '있음':
        s['recording'] = True
    s = {k: v for k, v in s.items() if v is not None}
    sessions.append(s); added['session'] += 1

left = [s['title'] for s in sessions if any(n in re.split(r'[\s_,\]\[]+', s['title']) for n in NICK)]
if left:
    sys.exit(f'제목에 닉네임이 남은 세션 {len(left)}개 — 손으로 고쳐 주세요')
for n, data in (('sessions', sessions), ('scenarios', scenarios), ('playthroughs', pts)):
    with open(os.path.join(SRC, n + '.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write('\n')
print(f'더함: 세션 {added["session"]} · 시나리오 {added["scenario"]} · 회차 {added["playthrough"]} → 세션 {len(sessions)} · 시나리오 {len(scenarios)} · 회차 {len(pts)}')
