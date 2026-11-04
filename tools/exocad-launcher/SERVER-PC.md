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


## 덴트버드 밤작업 (2026-11-04)

- 폴더: 서버PC `C:\DenFlow\덴트버드_밤작업` 을 네트워크 공유. 디자인PC 바탕화면에는 이 공유 폴더의 바로가기만 둡니다. 파일은 서버PC 디스크에 있으므로 밤에 디자인PC 를 꺼도 됩니다.
- 공유 접속은 서버PC 의 공유 전용 로컬 계정(비밀번호 있음)으로 합니다. 서버PC 의 자동 로그인 계정 hep78 은 비밀번호가 없어서, 윈도우 11 이 다른 PC 에서의 접속을 막습니다. 비밀번호는 사용자가 정하고 디자인PC 에서 처음 열 때 한 번 넣습니다(자격 증명 기억).
- 시작: 설계 일꾼이 21시~06시에 일감이 없을 때, 폴더에 새 dxd·스캔 폴더가 있으면 batch_review.py 를 하룻밤 한 번 띄웁니다(최대 30건). python.exe 로 띄워 update_server.cmd 의 pythonw 끄기에 안 걸립니다.
- 순서: 덴플로우 주문이 먼저. 밤 실행 중에도 일꾼이 주문을 묻고, 와 있으면 worker_wants 표시를 남깁니다. 밤 실행은 건 사이에 보고 크롬을 내준 뒤 일꾼이 끝나면(최대 30분) 이어서 합니다.
- 복사 중인 파일: 2분 안에 바뀐 파일은 건너뜁니다(다음 밤에).
- 디스크: 바꾼 스캔은 건마다 지웁니다. 끝난 dxd 는 `_끝남` 으로 옮기고 14일 뒤 지웁니다. 기록·그림·검토표는 남깁니다.
- 덴트버드 로그인: 한 계정은 한 곳에서만 유지됩니다. 디자인PC 에서 같은 계정으로 덴트버드를 열면 서버PC 가 끊깁니다(2026-11-03 15:54 실제로 끊겨 주문 설계가 멈춤).
