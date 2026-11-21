# THE PRAYPEACE ARCHIVES · 프레이피스 서고

EX LIBRIS · EST. 2021 — 수많은 세계, 수많은 삶, 그리고 우리가 만든 이야기.

프레이피스의 TRPG 세션 · 캐릭터 · 시나리오 · 추억을 모은 개인 서고. 주소: https://praypeace.github.io/

## 구성

| 경로 | 내용 |
|------|------|
| `index.html` · `css/archives.css` · `js/archives.js` | 서고 화면 (처음 · SESSION · CHARACTER · SCENARIO · MEMORY · 발자취) |
| `dice.html` | Oracle Dice — AI 세션용 주사위. 캐릭터 상세의 "판정 굴리기"로 판정을 넘겨받음 |
| `data/*.json` | **공개 데이터만.** `tools/build_public.py`가 비공개 원본에서 허용한 칸만 골라 만든다 |
| `tools/check_public.py` | 공개 데이터 검사(허용 칸 · 모양 · 참조 · 날짜 · 비공개 글 대조, `--nicknames`로 친구 닉네임 검사). 실패하면 배포하지 않음 |
| `tools/import_list.py` | 세션 목록 표(CSV) → 비공개 원본에 빠진 세션·시나리오·회차를 채움. 손으로 다듬은 기록은 건드리지 않음 |
| `tools/build_private.py` | 비공개 원본 → 관리자 작업함용 묶음. 대장 드라이브에 `praypeace-archives-private.json`으로 올림(저장소에 안 둠) |
| 로그인 | 캐릭터 서고와 같은 앱 스크립트 웹 앱. 친구(읽기) · 관리자(쓰기)는 서버가 정함. 작업함 승인은 서버에 저장되고, 방문객은 `?op=pa_pub`로 승인·공개된 것만 받음 |
| `tests/site.test.js` | 방문객 화면 시험(Playwright). `CA_DIR=<Character_Archive 경로> node tests/site.test.js` |

캐릭터는 지금의 캐릭터 서고(`/Character_Archive/characters.json`)를 그대로 읽는다. 그쪽의 자동 반영(원본 시트 → 매일 05시)이 이곳에도 바로 보인다.

## 지키는 것

- 친구 닉네임 · 녹화 링크 · 원본 파일 경로 · 관리 메모 · 승인 안 된 요약/결말은 이 저장소에 넣지 않는다.
- 요약 승인과 결말 공개는 따로. 결말은 기본 비공개.
- 완주는 대장이 확인한 회차만, 끝난 날이 있는 해에만 센다. 파일 날짜로 짐작한 날짜는 "추정"으로 표시한다.
- 빠른 깜빡임 · 섬광 금지. 움직임 줄이기 설정을 따르고, 배경 움직임은 끌 수 있다.
- 기존 캐릭터 서고의 기능과 주소(`#캐릭터id`)를 줄이지 않는다.

## 다음 단계

1. 관리자 로그인(웹 앱)과 서버에 저장하는 작업함
2. 세션 기록 212개 전체 반영
3. 기존 캐릭터 서고 기능 나머지(대표 그림 고르기 · 소개 카드 · 입장 연출 · 관련 인물 · 세션 로그) 옮기기
4. `/Character_Archive/` 옛 주소를 새 서고로 넘겨주기
