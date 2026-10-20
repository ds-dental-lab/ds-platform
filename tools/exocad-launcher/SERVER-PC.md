# 서버 PC — 항상 켜 두는 설계 PC (2026-10-20)

| | 디자인 PC (지금 PC) | 서버 PC (새 PC, i7-8700) |
|---|---|---|
| 맡는 것 | exocad · **exocad 지켜보기** · Claude · 치ㅣ 에이전트(프린터) | **설계 일꾼 · 임시치아 지켜보기** · 덴트버드 크롬 · 오르카 |
| 시작프로그램 | `install_watch.py --only exocad_watch` | `install_watch.py --only design_worker temp_watch` |

★ 같은 일을 두 PC 가 맡으면 한 건을 둘이 집습니다. 옮긴 뒤 디자인 PC 쪽은 꼭 뺍니다.

## 서버 PC 에서 (윈도우 11 설치 직후)

1. 저장소의 `tools/exocad-launcher/setup_server.cmd` 를 USB 로 옮겨 두 번 누릅니다.
   - winget 으로 Git · Python 3.13 · Chrome · OrcaSlicer 를 넣고
   - `C:\DenFlow\ds-platform` 에 저장소를 받고 (GitHub 로그인 창이 뜹니다)
   - `setup_server.py` 가 이어서 묻습니다: 오르카 첫 실행 → 설계 PC 연결 코드 → 덴트버드 크롬 로그인 → 시작프로그램
2. 윈도우 설정
   - 전원: 화면 끄기·절전 **안 함**
   - 자동 로그인: `netplwiz` → "사용자 이름과 암호를 입력해야" 끄기
   - 원격 접속 하나 (크롬 원격 데스크톱 등)
3. 재부팅 → 덴플로우 **기기 상태** 에 설계 PC 가 살아 있는지 봅니다.
   빠진 것이 있으면 `python setup_server.py --check` 가 알려 줍니다.

## 디자인 PC 에서 (서버 PC 가 뜬 뒤)

```
cd C:\Users\DS\Desktop\ds-platform\tools\exocad-launcher
python install_watch.py --off --only design_worker temp_watch
```
작업 관리자에서 돌고 있는 `design_worker` · `temp_watch` 의 pythonw 를 끝냅니다. exocad 지켜보기는 그대로 둡니다.

## 확인

- 치ㅣ 로 FlowTemp 시험 주문 한 건 → 서버 PC 의 설계 일꾼이 받아 가는지 (디자인 PC 는 조용해야 함)
- 덴트버드 무료 건수가 0 이면 내보내기 앞에서 섭니다 — 11/06 뒤나 유료 계정으로 끝까지
