---
name: ds-flow-fdm-print
description: FDM 임시치아 자동 출력 — 밤부 A1 mini. 한 사이클 통과(2026-10-13). 「비웠습니다」는 못 없앱니다
type: project
---

치과에 두는 **밤부 A1 mini** 로 임시치아를 뽑습니다. 주문 → 자동 출력
보내기 → 「비웠습니다」 → 에이전트가 집어가 자르고 보내고 뽑습니다.

**2026-10-13 한 사이클 통과.** 15:17 접수 → 15:32 완료, 사람이 누른 것은
단추 둘뿐. 다만 **딱 한 번**입니다 — 며칠 실제로 돌려 봐야 압니다.

## ★★ 「비웠습니다」 단추 — 지금은 못 없앱니다 (길은 있음)

프린터가 아는 것은 "뽑기가 끝났다"(gcode_state FINISH) 까지입니다.
**판이 비었는지는 모릅니다** — 끝나고도 물건은 붙어 있습니다.
끝나고 화면에 뜨는 안내(Reprint·OK·Guide)는 **프린터 안에서만** 살고
LAN 으로 안 나옵니다. 칸 **98개를 전부** 견줬고, OK 를 눌러도 한 칸도
안 바뀌었습니다. 신호가 없으니 막는 데도 못 씁니다.
→ 없애면 물건이 붙은 판에 다음 작업이 올라가 **노즐이 들이받습니다.**

★ **카메라는 있습니다** (2026-10-14). `ipcam_dev=1`, LAN 6000 포트로 열리고
  크라운도 보입니다(`printer_eye.py`). 다만 **베드가 움직입니다** — 끝나면
  판이 앞으로 나와서 '같은 네모를 잘라 견준다' 가 성립하지 않습니다
  (출력 직후 0.399, 바탕 잡음 0.005, 손바닥만 한 물건 0.020).
  판 자세를 맞추는 일이 반나절. 건수가 늘면 그때.

## 자동 임시치아 — 사람 손 셋 (2026-10-14 전 구간 통과)

    스캔 올리기          자동
    주문 등록            사람  ← 손님의 뜻. 그대로 둡니다
    덴트버드 설계·내보내기  사람  ← 남의 서비스 (Free 월 3건)
    STL 고르기           **없앴습니다** (temp_watch.py)
    자르기·올리기         자동
    「비웠습니다」         사람  ← 아래 참고
    출력·완료            자동

내려받기 폴더에 crown 파일이 떨어지면 치식을 읽고(.constructionInfo),
그 치식으로 기다리는 주문을 찾아, 자르고 올립니다. **애매하면 안 보냅니다** —
같은 치식 주문이 둘이거나 치식을 못 읽으면 멈추고 적습니다.

★★ **각도는 `orient.py` 한 곳에서만** — x135 / y0 입니다. 옛 글에 남은
  x150/y140 은 **버린 값**(크라운 안쪽에 서포트가 붙음, 내면 처짐 35.9 대 0).
  2026-10-14 에 그걸 베껴 적어 한 판을 틀린 각도로 뽑았습니다.

★ 덴트버드 Free 는 **재내보내기가 무제한**입니다 — 이미 내보낸 케이스는
  몇 번이든 다시 받을 수 있어, 시험하는 동안 월 3건이 안 깎입니다.
  웹에 `data-testid` 가 다 붙어 있어 매크로를 걸 수 있습니다
  (`dentbird_web.py`, 전용 크롬 프로필 — 비밀번호는 안 적습니다).

## 덴트버드 매크로 — 싱글 크라운 끝까지 (2026-10-15, 윤기두 16번)

사용자 목표: **싱글 크라운 하나를 완벽하게 → 그다음 브릿지·임플란트.**

길 (`dentbird_macro.py`, `DESIGN.md` 15번 글): 신규 → Dentbird Crown →
`#file-input`(숨은 입력칸, 창 안 뜸) → `import-next-btn` → AI 분석 →
**상태 목록에서 치식 전부** → `generate-crown-btn` → '생성됨' →
`appbar-export-btn` → **iframe 안의** 데이터 선택 창 → 내보내기.

★★★ 덴트버드에서 배운 함정들 (전부 실제로 밟음):
- `tooth-info-setter` 칸엔 **맨 앞 치아 하나만** 적힘 — 24·25·26 을 24 로 읽을 뻔
- 생성이 **그냥 실패**하는 날 있음("알 수 없는 오류") → 한 번만 다시
- 화면이 덜 뜨면 생성 단추가 **가로막힘**(disabled 아님) → 몇 번 더 누름
- 내보내기 창이 **iframe 안** — 바깥 문서에서 안 보임
- 크롬이 **'여러 파일 다운로드'** 를 막아 크라운만 오고 정보 파일이 안 옴
  → 전용 프로필에서 허용함(고정됨)
- ★★★ 짝 없는 크라운에 **남의 .constructionInfo** 를 붙이던 것 —
  다른 환자 37번으로 읽음. 이제 짝(앞머리)만, 없으면 **파일 이름**(`_16-16-crown`)

★ 지켜보기 둘이 **서로 살림** (재부팅 뒤 하나만 뜬 일). 자물쇠로 겹침 방지.

## 시간 — 어디로 가는가 (실측)

준비가 출력보다 길었습니다. 프린터가 단계(stg_cur)를 말해 주게 해서 쟀고,
**토출 보정이 183~260초**였습니다. 밤부가 시작 G코드에 주석으로 둔
`;M1002 set_flag extrude_cali_flag=1` 을 0 으로 바꿔 끕니다 — 남의 코드를
지우지 않고 그쪽 손잡이를 씁니다. 출력 명령의 `flow_cali: false` 는
A1 mini 가 **무시합니다**(실측).
→ 준비 6분 35초 → **2분 25초**.

★ 보정을 건너뛰면 그 안에 든 **노즐 미는 줄**도 같이 빠집니다. 첫 층이
  비어 나오지 않게 **스커트 한 바퀴**로 대신합니다.

★ 추측을 세 번 틀렸습니다 — 판 고르기 때문(아님) · 노즐이 식기를
  기다려서(아님) · 안내 화면이 신호가 됨(아님). **재고 나서 말할 것.**

## 오르카 프로파일 (orca_profile.py 가 임자)

값은 **전부 문자열**입니다. 숫자로 넣으면 **조용히 버려집니다** —
layer_height 를 0.12(실수)로 넣고 0.2mm 로 잘린 적이 있습니다.
지금은 타입이 다르면 예외를 던집니다. `inherits` 는 펴서 넘겨야 합니다.
프로파일은 `%APPDATA%\OrcaSlicer\system` 쪽을 씁니다(Program Files 아님).

## 아직 안 한 것

- 한 판에 같은 케이스 여러 개 (사용자가 미룸)
- 끝났을 때 폰 알림 (사용자가 "알림은 그만붙이고")

## 2026-10-19 실전 재점검에서 잡은 것
- **덴트버드 UI 바뀜**: 생성 직후 도구막대(toolbar-tool-inner 등)가 안 뜨고 **크라운을 골라야(이름표·치식 칸·상태 카드 클릭) 2.5초 뒤에 뜸**. `_crown_toolbar` 를 셋 번갈아 누르며 20초 기다리게 고침 → 설계값 적용 통과(16:24).
- **전용 크롬 '여러 파일 다운로드' 허용** 필요 — 프로필이 새로 생기면(재로그인 등) 다시 막힘. chrome://settings/content/automaticDownloads 에 ai.dentbird.com 허용. 일꾼이 내보내기 전에 미리 검사해 "허용해 주세요" 로 멈춤.
- 멈춘 까닭 → 치과 말: `stallAdvice`(domain/auto-print). 치과 ✕ = FlowTemp 그만두기(멈춤·실패도) + 주문서 FlowTemp 줄 삭제.
- 덴트버드 전용 계정 결제는 연 90만(Starter, 월 30건), 환불 없음 — 서버 PC 뒤에 결제.

## 이름은 FlowTemp 로 확정 (사용자 결정 2026-10-19)
- TemFlow 와 저울질 뒤 **FlowTemp 그대로**. 앞 브랜드+뒤 기능(Flow+Temp) 틀 — 다음 제품도 Flow○○. 부르는 말은 "템프"면 됨. 다시 묻지 말 것.

## FlowTemp 과금 = 1안 (사용자 결정 2026-10-15)
- **같은 치아의 최종 크라운과 함께 주문할 때만** 넣음. 돈은 크라운으로 받음 (FlowTemp 는 0원 취급).
  규칙: domain/duplicate `AUTO_PARTNER_TYPES=['crown']`, `unpairedAutoTooth`. **폰틱 크라운도 짝(2026-10-19 뒤집음 — "FlowTemp 도 폰틱이 존재해", 임시 브릿지는 가운데 폰틱까지 한 덩어리)**. FlowTemp 재료 has_pontic 켬(migration 20261019130000, 값 0). 임플란트 열 때 거기에 추가.
  주문등록 「FlowTemp 함께」 스위치(폰틱 옆, 2026-10-19): 켜면 크라운(폰틱 포함) 찍을 때 같은 치아에 FlowTemp 도, 다시 누르면 같이 빠짐, 끄면 FlowTemp 만 빠짐. `teethNeedingCompanion`. FlowTemp 보는 치과에만 뜸.
- 같은 주문이라 **FlowTemp STL 은 order_files kind='etc'** 로 남김 — 'design' 이면 크라운 디자인으로 세지고 기공소에 임시치아 STL 이 감.
- exocad 주문서에서 auto_pipeline 품목은 뺌.
- 주문 상태는 크라운 것. FlowTemp 진행은 auto_jobs 로만 → "주문상태를 출력에 맞추기(4번)" 는 1안에선 필요 없어짐.
- **아직 시험 중** (사용자 2026-10-15): 덴트버드 디자인 오류, 교합/컨택 파라미터, 재출력 규칙이 안 정해짐.
  치과 목록에서 감춤(is_internal) 유지 — sees_internal 은 시험 치과 '치ㅣ' 하나뿐. **메이트에 열지 말 것.**

## 덴트버드 창은 가려지면 멈춤 (2026-10-15 실측)
- 창이 다른 창 뒤에만 있어도 크롬이 hidden → rAF 0번, 타이머 1초 1번. WebGL 이라 분류·분석도 멈춤 ("클릭해야 움직였다").
- 해결: dentbird_web.attach() 가 `keep_awake` (CDP Emulation.setFocusEmulationEnabled + Page.setWebLifecycleState active) 를 매번 검. 최소화한 채로 rAF 238/2초 확인. 띄울 때 occlusion 끄는 플래그도 추가(다음 실행부터).
- 매크로 첫 한 번에 통과: 한복계1 17번(ORD-261015-011, 크라운+FlowTemp), 411초, 내보내기 직전까지.

## 치과가 진행을 봄 (2026-10-15, 아이디어 1·2·4번)
- 주문 넣을 때 auto_jobs 를 엶(syncAutoJob) → '디자인' 칸부터 보임. 고치다 FlowTemp 빼면 waiting_design 일 때만 지움.
- 잔걸음 auto_jobs.design_stage (uploading·analyzing·generating·exporting·stalled) — 매크로 `--order <id>` 가 /api/device/auto-print/stage 로 적음. design_note(멈춘 까닭)는 센터 화면에만.
- 트리거 auto_jobs_signal → realtime.send('order:{id}') — **실측으로 신호 2번 받음**. pulse 도 auto_jobs.updated_at 봄.
- 알림은 둘뿐(alertOnMove): →queued '출력판을 비워 주세요', →done '꺼내 주세요'. 치과에만, 종+웹푸시. **실전 미확인**.
- 마이그레이션이 코드보다 먼저여야 함 (COLUMNS 가 design_stage 를 읽음).
- 덴트버드 무료 내보내기 2026-10 분 다 씀 → 다음 실전은 11/06 이후 또는 유료.

## 치과 책갈피 (2026-10-15)
- src/components/layout/FlowTempDock.tsx — 치과 layout 에 붙음. 진행 중인 게 없으면 탭도 없음. 색 = 가장 급한 줄(오류>할일>지연>진행>완료), 위아래 끌기(10~85%, localStorage), 글씨 가로 두 줄 'Flow/Temp'. 펼치면 환자·#치식·상태·막대·「비웠습니다」 바로. 6초/30초 폴링. 완료는 6시간.
- 상태 문구는 domain/auto-print boardRow 한 곳. 놀이터 /playground/flowtemp-dock (가짜 6건).
- **보류 (사용자 2026-10-15): 폰(/m) 버전은 "필요한 순간 있을 때" 진행.** 폰은 옆 탭 말고 아래에서 올라오는 띠가 맞다고 제안했음. 센터용(오류 건만)도 아직 안 함.

## 설계 PC 일꾼 + 덴트버드 설계값 (2026-10-15)
- design_worker.py — /api/device/auto-print/next-design 로 일감을 잡음(updated_at 낙관적 잠금, stalled 는 안 줌, 30분 묵으면 다시 줌) → 스캔 받기·풀기 → design_scans.pick(역할 이름 우선, 없으면 치식으로 턱) → 매크로 → dentbird_params.apply_all → 내보내기 → 10분 동안 올라오는지 확인. 싱글만. 건수 0 이면 안 누름.
- **실측: 한복계2 17 — 잡고 내보내기 직전까지 1분 33초** (창 깨우기 뒤 분류 11초·생성 19초). 치식 다른 주문(12 vs 17)은 대조에서 멈추고 '확인 중' 기록 — 안전장치 확인.
- 설계값(dentbird_params, 사용자 고정 2026-10-15): 내면 3D프린팅·최소두께 **.45 (0.8 과 출력 비교 뒤 확정 2026-10-19)**·시멘트갭 .04·적응형/마진씰 0·마진폭 .15·각도 0·블록아웃 / 교합 .2·인접 -.02 **모양 유지**·치은 0(cut) / 외형 '최소 두께 부족'이면 보정.
  배운 것: 숫자는 **엔터**로 넣어야 먹음(Tab 이면 각도가 45 로 돌아감), 도구 단추는 토글, 보정은 진행 표시 없이 돎, 고친 뒤 내보내기 단추 ~18초 잠김.
- 주문을 고치면 stalled 디자인 자동 해제(syncAutoJob) — 사용자 "센터가 왜 관여를 하는가". 센터 「디자인 다시 걸기」는 덴트버드 쪽 문제용으로 남김(치과엔 안 보임).
- **덴트버드 한 계정 한 곳 로그인** — 다른 브라우저에서 로그인하면 전용 창이 끊기고 멈춘 탭이 남아 붙기가 걸림 → 전용 크롬만 껐다 켜면 로그인 유지된 채 복구.
- 남은 것: 덴트버드 건수(Free 0/3, 11/06), 일꾼 시작프로그램 등록(사용자 허락 필요), 에이전트 재빌드(dist-embed 는 10/08 — print_loop·printer_send 옛것).

## 에이전트 1.3.3 — 배포 보류 (사용자 결정 2026-10-15)
- 판 번호는 1.3.2 그대로(서버와 같아야 하는 테스트 있음 — 한 번 깼다 되돌림). 배포할 때 scan_agent·domain 둘 다 1.3.3 으로. 출력 쪽 개선(남은 시간·층 보고)은 코드에 이미 있음. 빌드(dist-embed)해 이 PC(치ㅣ)에서 돌림. 제가 따로 띄우던 print_loop.py 는 끔.
- **domain/agent AGENT_VERSION 은 1.3.2 그대로, release.py --upload 안 함** — 올리면 메이트(DESKTOP-NMC357C, 1.3.1) 등 모든 치과에 '새 판' 알림. **실제 치과에 FlowTemp 를 열 때 같이 배포.**
- 설계 PC: 시작프로그램 vbs 셋(exocad 지켜보기·임시치아 지켜보기·설계 일꾼)이 서로 살림. **이 PC 를 서비스 중 켜 둬야 함**(절전 끄기·Windows 로그인 유지·덴트버드 전용 창 로그인). 나중 대안: 전용 미니PC 또는 클라우드 Windows.

## 점검 — 끊기고 멈췄을 때 (2026-10-16, 사용자 "꼼꼼하게")
- 재부팅 뒤 셋 중 하나만 뜸 + exocad 지켜보기가 치과 열쇠를 잡음 → beat/revive 를 루프 맨 앞으로, 설계 열쇠 보이면 갈아탐, vbs 45초 지연 + vbs-starts.txt. 에이전트는 '자동 시작' 체크로 Startup 에 .lnk (dist-embed 를 가리킴 — 재빌드 전에 에이전트를 끌 것).
- 서버: pg_cron `auto_jobs_watchdog` 5분 — 30분 소식 없는 sending/printing → failed(+종), exporting 30분 → stalled(+센터 종). **migration 20261016100000 은 사용자 db push 필요.**
- canHandDesign: exporting 은 묵어도 다시 안 줌(건수 이중 사용). stage API `release:true` 로 내려놓기. match API `orderId` 이름표.
- 일꾼: SessionLost(로그인 풀림·'Multiple login detected'·'새 로그인 시도가 감지되었습니다'·'An unknown error') → 안 잡음/내려놓고 5분 쉼. 창 점검 5분에 한 번(attach). Transient(스캔 받다 끊김) → 내려놓음. 내보내기 직전 export_tag(expected-export.json).
- 지켜보기: seen = 이름|mtime|크기 (덴트버드는 같은 이름으로 내보냄), 이름표 뒤 파일은 켤 때도 집음, 올리기 3번, 실패 시 주문에 stalled.
- 출력 담당: 단계 보고 실패하면 pending 에 보관 → tick 마다 flush. REJECTED 문구만 버림(DB 탈도 400 이라).
- 알림: 치과 쪽 출력 실패 → 치과, 디자인 멈춤 → 센터. 화면: 치과 PC 꺼짐(last_seen 3분) → '치과 PC 꺼짐', 센터엔 설계 PC 꺼짐.
- **덴트버드는 한 계정 한 곳** — 2026-10-16 아침에도 다른 기기 로그인으로 끊김. 매크로 전용 계정을 따로 두는 게 근본 해결(요금제 확인 필요).

## 시작프로그램이 조용히 못 띄우던 것 (2026-10-16, 진짜 원인 둘)
- ① 셀레니움 attach 가 띄운 **크롬드라이버가 일꾼의 crash.txt 손잡이를 물려받아** 고아로 남아 쥠 → 다음 cmd `>> crash.txt` 실패 → 파이썬 실행조차 안 됨, 흔적 없음. (Restart Manager RmGetList 로 범인 확인.) 고침: Service(log_output=DEVNULL), spawn.detached 로 크롬·런처·wscript, 일꾼 켤 때 reap_drivers.
- ② cmd 의 `>>` 는 파일을 혼자 씀 → 하나가 쓰는 중이면 두 번째 반복기는 파이썬을 못 띄워 '이미 떠 있음' 도 못 받고 영원히 돎(여섯까지 늘었음). 고침: vbs 가 pythonw 직접, 파이썬이 log_to_crash 로 나눠 씀, 이미 떠 있으면 종료 3 → vbs Quit.
- 내 작업 창(격리)에서 만든 파일은 S-1-15-3 ACE 가 붙지만 **밖에서도 똑같이 보임**(확인함) — 그건 원인 아니었음.
- 아직 모름: exocad 지켜보기가 가끔 design_agent.json 을 못 읽음(1~2분 뒤 갈아탐). 이제 실제 OSError 를 crash.txt 에 남김.
- attach: 다시 로그인 뒤 생기는 type=other 대상이 붙기를 2분 걸리게 함 → /json/list 의 dentbird page id 로 먼저 switch.

## 서버 PC로 옮기기 (사용자 2026-10-16 — "마침 미니 PC 가 있긴 해, 나중에 옮길게")
- 옮길 것: 설계 일꾼 + 임시치아 지켜보기 + 덴트버드 전용 크롬. **exocad 지켜보기는 디자이너 PC(이 PC)에 남김.** 치과 에이전트는 프린터 있는 치과 PC.
- 준비물: 내장그래픽 i5/R5급·16GB·SSD·유선랜·**HDMI 더미 플러그**(모니터 없으면 WebGL 꺼질 수 있음)·(UPS)
- 윈도우: BIOS AC Power Recovery=On, **자동 로그인**(서버 전용 윈도우 계정), 절전 안 함, 업데이트 재시작 새벽, 원격 접속(크롬 원격 데스크톱)
- 계정: **덴트버드 서버 전용 계정(유료)** — 한 계정 한 곳 로그인 문제를 없앰. 덴플로우 '설계 PC 연결' 코드.
- 설치: 크롬, OrcaSlicer 2.4.2(한 번 실행), Python 3.13 + selenium·numpy·pillow, tools/exocad-launcher, link_design.py, dentbird_web 로그인, install_watch(exocad 지켜보기는 빼고), 시험 주문 → 재부팅 확인.
- 미니 PC 사양을 받으면 맞는지 봐 주기로 함.
- **확정(사용자 2026-10-19): 지금 이 PC(DESKTOP-9J707DH)는 디자인 PC로 쓰고, 다른 PC를 항상 켜 두는 서버로 둠.** 그러니 설계 일꾼·임시치아 지켜보기·덴트버드 크롬·설계 PC 열쇠는 그 PC로 옮기고, 이 PC에는 exocad 지켜보기만 남겨야 함. 이 PC의 시작프로그램 vbs 셋 중 둘(임시치아·설계 일꾼)은 그때 빼야 함 — preflight(STARTUP_VBS)도 역할별로 갈라야 함(지금은 셋 다 있어야 정상으로 봄). 기기 상태판엔 '설계 PC' 하나로 뜨므로 서버 PC 등록 시 이름 구분 필요.

## 서버 PC 이관 준비 (2026-10-20)
- 역할 나눔: **디자인 PC** = exocad·exocad_watch·Claude·치ㅣ 에이전트(프린터) / **서버 PC**(i7-8700·B360M·24GB) = design_worker·temp_watch·덴트버드 크롬·오르카.
- `install_watch.py --only <이름들>` 로 맡을 것을 고르고 `%APPDATA%\DenFlow\watchers.json` 에 적음. `watch_common.expected_watchers/expected_scripts` 가 그것을 읽어 preflight 와 _health.watchers 가 **맡은 것만** 봄(서버에 exocad 없다고 경고 안 함). 파일 없으면 셋 다(예전 그대로).
- 서버 PC 설치: `tools/exocad-launcher/setup_server.cmd`(winget: Git·Python3.13·Chrome·Orca → C:\DenFlow\ds-platform clone → pip) → `setup_server.py`(오르카 첫 실행·설계 PC 연결 코드·덴트버드 크롬 로그인+다운로드 허용·시작프로그램 둘·점검). 안내문 `SERVER-PC.md`.
- 서버가 뜬 뒤 디자인 PC 에서 `install_watch.py --off --only design_worker temp_watch` + pythonw 끝내기 (사용자 손 — 문지기 훅이 내가 못 하게 막음).
- **이관 완료 (2026-10-21 오전)**: 서버 PC = 호스트 **FT**(로컬 계정 FlowTemp, 저장소 C:\DenFlow\ds-platform, Python 3.13, 덴플로우에 "설계 PC (FT)"). 디자인 PC(DESKTOP-9J707DH)는 design_worker·temp_watch 뺌 → exocad_watch 가 상태 보고(심장)를 대신 보냄(`exocad_watch._health_here`, doing "exocad 대기"). 기기 상태에 두 줄 다 살아 있음 확인. 서버 PC 윈도우 11 Home — 원격은 크롬 원격 데스크톱으로 넣을 것(미설치).
- 서버 PC 혼자 돌게 한 설정(2026-10-21): 전원 절전 안 함 · 로그인 옵션 "다시 로그인" 안 함 · **자동 로그인은 netplwiz 체크 칸이 숨겨져 있음** → 관리자 cmd 로 `reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\PasswordLess\Device" /v DevicePasswordLessBuildVersion /t REG_DWORD /d 0 /f` 뒤 netplwiz 에서 체크 해제(재부팅 때 잠금 화면에서 멈춰 일꾼이 안 떴던 것) · BIOS Restore after AC Power Loss = Power On · 크롬 원격 데스크톱 설치. 재부팅 뒤 손 안 대고 신호 재개 확인.
- **서버 PC 첫 건(zzz #27, 2026-10-21 11:15) 멈춤**: "크라운을 골라도 도구 막대가 안 뜹니다". 생성까지는 갔음(최소화 상태에서 WebGL 이 아예 선 것은 아님). 의심: 최소화된 창(내장 그래픽) 또는 화면 크기. 고침: ① open_browser(background) 가 **더는 최소화 안 함** ② keep_awake 가 붙을 때마다 CDP Browser.setWindowBounds 로 최소화를 풂(`unminimize`, 활성화 안 함) ③ 도구 막대 기다림 20→40초, 실패하면 `window_report`(창 상태·visibilityState·innerWidth×Height)와 `snapshot`(logs/dentbird-toolbar-*.png) 을 멈춤 글에 붙임. 임시 크롬(9334)으로 되돌리기·rAF(최소화 243/2초)·그림 저장 확인.
- 치과 책갈피 카드: 진행 문장을 본문 크기(13px 굵게 진한 색)로, 주문번호(ORD-) 줄 뺌 (사용자 2026-10-21).

## 센터 손 없이 — 멈춤을 기계가 처리 (사용자 결정 2026-10-21 "센터에서 손이 안 갔으면 해")
- 전제: **FlowTemp 는 되면 좋은 덤.** 안 되면 치과가 평소대로 임시치아, 크라운 주문은 그대로. 센터는 건별로 손대지 않음.
- 규칙(domain/auto-print): `stallKind(note)` = unsupported·unreadable·scan·credits·setup·transient → `designVerdict(note, tries)` = give_up / wait_scan / hold / retry(≤1회, 5분 뒤 `canHandDesign` 이 다시 집음). 서버 `setDesignStage` 가 멈춤 보고를 받을 때 판정.
- give_up → design_stage **'ended'**, FlowTemp 줄 삭제(`removeAutoItems`), 치과 알림 `design_ended`. 치과 말 `GIVE_UP_MESSAGE` = "이번 건은 임시치아를 미리 준비해 드리기 어렵습니다. 평소대로 진행해 주세요." (사용자 "우회적으로"). 책갈피 회색 tone 'info' '평소대로', ✕ 로 치움. 다시 걸기 불가.
- wait_scan → design_wait='scan' + 치과 알림 `design_scan`("스캔 파일을 다시 올려 주세요"), **스캔 다시 올리면 DB 트리거 `auto_jobs_scan_resume`(order_files) 가 다시 엶**.
- hold(건수·설정·로그인·안 올라옴) 만 센터 알림(전처럼). 포기가 24시간 안 3건 잇따르면 센터에 한 번 알림(`publishDesignStreak`).
- 마이그레이션 `20261021120000_flowtemp_zero_touch.sql`(design_tries·design_wait·ended·트리거) — **사용자가 db push**. 테스트 83.
- 아직 안 한 것: 덴트버드 보내기 전 스캔 사전 검사(파일 없음·한쪽 악 없음), 센터 STL 올리기 단추. 실제 실패율은 11/06 뒤 10~20건으로 재고 치과 공개 결정.
- **서포트 접촉면 손봄 (2026-10-21, 사용자 "출력물과 서포트 사이가 지저분")**: orca_profile.DENTAL — 옆 간격 0.18→0.35, 접촉면 간격 0.4→0.2, 접촉 층 top 3/bottom 2, 무늬 rectilinear_interlaced, 접촉면 속도 60→40. z 띄움 0.18 은 그대로. 로컬 자르기 확인(tetetet 16번: 62층 13m11s). **뽑아서 확인 전.** 시험 주문은 다 지워져 있음 — 치ㅣ 주문(16 크라운+FlowTemp) 넣고 서버 PC 내려받기 폴더에 `tetetet_16-16-crown.stl` 넣으면 temp_watch 가 집음.
- **출력 시간 (사용자 2026-10-21 "시간이 좀 더 줄었으면")**: 실측 치ㅣ 출력시험 — 비움 12:37:33 → 프린터 시작 12:38:25 → 끝 12:46:28 (**프린터 8분 3초**). 오르카 예상 13m11s 중 **7분은 시작·마무리 G코드**(2mm 정육면체도 7m44s). 속도 설정은 거의 안 먹힘(겉벽 25→35 −31초, 서포트·속채움·접촉면 속도 0~5초, 층 0.16→0.20 −1m15s). 시작 G코드 손잡이 셋째 `SKIP_LEVELING`(orca_profile, `;M1002 set_flag g29_before_print_flag=1`→0) 넣음 — 베드 레벨링과 그 뒤 재원점 건너뜀, 기계에 저장된 바닥 지도 사용. **실제 몇 분 주는지는 다음 출력으로 잴 것.** 첫 층 안 붙으면 SKIP_LEVELING=False. 남은 큰 덩어리는 가열(바닥 55·노즐)과 노즐 닦기.
- **둘째 출력(2026-10-21 13:14→13:21:52, 7분 26초)**: 바닥 다지기 건너뛰기로 **37초** 줆(8:03→7:26). 첫 층 정상. 프린터 화면의 '출력 끝(OK)' 창이 떠 있어도 새 출력은 그대로 시작됨(실측). 썸네일: `slice_job.brand` 가 plate_1.png/plate_1_small.png 를 넣음 — 로고는 넣었다가 뺌("절전 모드 때나") → 놓인 크라운 모습 → **최종: 위에 가로 로고 띠(마크+DenFlow 작게) + 아래 놓인 크라운**(사용자 '진행률은 보여야지… 간결하게 위쪽에', 8dd0509). **대기·절전 화면은 바꿀 길 없음.**
- **셋째 출력(2026-10-21 13:31:32→13:38:47, 7분 15초)** — MQTT `stg_cur` 단계 기록으로 확인: 바닥 예열(+2s) → XY 기계 점검(+20s) → 노즐 닦기(+47s) → 바닥 예열(+73s) → 원점 잡기(+81s) → **출력 중(+2분 17초, 1층)** → 끝(+7분 15초). **바닥 다지기(stg_cur 1)는 안 나옴 → SKIP_LEVELING 이 먹음.** 10/10 실측 앞단 3분 1초 → 2분 17초. 크라운 자체 4분 38초(62층). 남은 앞단은 가열·기계 점검·노즐 닦기(기계 고정). 더 줄일 자리는 층 0.20 뿐(−1분). 셋 다 첫 층 정상·품질 OK. 단계 기록 스크립트는 세션 스크래치(stage_log.py, 한 번 듣고 끝남 — 상시 아님).
- 오르카 자르기 변경(서포트·SKIP_LEVELING·썸네일)은 **서버 PC 가 `git pull` + pythonw 재시작해야 적용** — 셋째까지는 이 PC 에서 print_once.py 로 넣었음.
- **출력판 자리 돌리기 (2026-10-21, 사용자 "안 비웠는데 비웠습니다 누르면?")**: A1 mini 는 판에 뭐가 남았는지 모름 → 「비웠습니다」는 사람 확인뿐. 그래서 `plate_slot.py` 가 크라운을 여섯 자리(x 55/90/125 × y 70/110, 이어지는 둘은 ≥35mm 떨어짐)를 돌아가며 놓고, 시작 때 앞쪽(Y-2.5, X68→115)에 긋는 **과잉 압출 선도 세 자리**(가운데·왼쪽 -45·오른쪽 +45)로 돌림(사용자 "저번엔 겹쳐져서 나온 것 같았어"). 차례는 서버 PC 의 `%APPDATA%\DenFlow\plate_slot.json`(서버는 모름). **오르카 CLI 가 STL 을 판 가운데로 옮겨 버려서(arrange) `--arrange 0` 을 넣어야 자리가 살아남음** — 실측으로 잡음. 로그에 "자리 3/6 (앞오른쪽)" 로 찍힘. 여섯 번 연속 안 비워야 겹침. 서버 PC 는 또 pull+재시작 필요.
- **과금 2안 + 요금제 길 (사용자 결정 2026-10-21)**: FlowTemp 값은 둘 — 크라운을 주는 치과 0원(1안), 스캐너 계약 등으로 크라운을 못 주는 치과는 **건당 요금**(사용자 6,500원 생각, 내 권고 8,000~10,000). 설계 서비스는 연 90만(월 30건)으로 시작 → 치과 늘면 **무제한(연 440만, VAT 포함)** 으로. 440만은 고정비라 월 57건(6,500원 기준) 넘어야 건당 요금만으로 본전 — 묶음 치과의 크라운 마진이 고정비를 깔고, 건당 치과는 그 위에 얹는 그림. "무제한" 이라는 말은 치과에 안 씀. 세금(면세 기공물인지)은 세무사 확인 전.
- **프린터 주소 훑기 (1.3.10, 2026-10-21, 사용자 현장 경험 '공유기 여러 대면 껐다 켜면 다른 데 붙음')**: `printer_sweep.py` — 방송(SSDP) 못 들으면 지난 주소 확인 → PC 대역(/24)을 8883 로 훑어 후보 → 접속 코드로 MQTT 붙어 **그 시리얼 보고가 오는지**로 확정. resolve(출력 때)·프린터 찾기 단추·설치 점검 셋 다 이 길을 탐. 실측 이 PC: 전체 훑기 3.8초, 지난 주소 1.9초. 대역이 다르면(이중 공유기) 못 찾음 → 설치 상자에 작은 공유기(프린터 전용 망) 권고.
- **치과 망 재점검 (2026-10-21, 사용자 "점검하고 또 점검")**: 시험 프린터 펌웨어 **A1 mini OTA 01.03.30.01** — 새 프린터는 01.04 이상이라 외부 프로그램(MQTT/FTP) 접근에 **개발자 모드(LAN 설정)** 를 켜야 하고 자동 업데이트가 설정을 되돌릴 수 있음. 우리는 그 설정을 겪어 본 적 없음 → 새 프린터 첫 시험 항목. 출력 중 소식 끊김(SILENT 180초) 때 전에는 바로 '실패' → `REFIND_TRIES=2` 로 방송→지난 주소→대역 훑기로 다시 찾아 붙고(최대 6분) 그래도 없으면 알림(printer_send._refind). 그 외 길: 에이전트→denflow.kr/저장소는 443 만, 서명 URL 2시간, 파일 PUT 30분 제한, 자국 묻기 20초 폴링(웹소켓 없어도 됨), 푸시는 FCM(치과 망 무관). 다른 대역(이중 공유기·손님망)은 여전히 못 찾음 → 설치 상자 작은 공유기.
- **시연(10/27)은 지금 프린터(01.03.30)로. 인증 필라멘트(치과용 PLA 200g, 11만원) 구매함 (2026-10-21)**. 지금 자르기는 "Bambu PLA Basic @BBL A1M" 바탕에 노즐 205/215(첫 층)·바닥 55·flow 0.96. 인증 재료 오면: ① 라벨 권장 온도와 비교해 DENTAL_FILAMENT 맞춤 ② 200g 스풀이 거치대·건조기 바퀴에 맞는지 ③ 같은 크라운 5~10번 연속 — 끊김·막힘 수 세기. 그 전까지 시험 출력은 일반 PLA.
- **FlowTemp 값 확정 (사용자 2026-10-21): 임시치아 1개 8,000원, 그 치아 크라운을 함께 주문하면 0원.** 둘 다 열어 둠(요금제 둘이 아니라 값 하나+규칙 하나). 전 회사 값 6,400/4,400 을 원장들이 알아서 10,000 은 저항. 건당 치과는 설계 상한(월 30건) 안에서 두 곳까지. 코드: 짝 없는 FlowTemp 를 막던 것 → 값 매기기로 (짝 있으면 0, 없으면 제품가).
- **과금 2안 코드 (2026-10-21)**: 짝 없는 FlowTemp 저장 차단 **해제**(services/order validateOrder) → 정산(repositories/billing)에서 `pairedAutoTeeth` 로 같은 치아 크라운 있으면 0원·줄 이름에 "(크라운 함께)", 없으면 제품가. 임시치아만 있는 주문은 출력 done 때 `completeAutoOnlyOrder` 가 **바로 완료+shipped_at** (안 그러면 접수에 영영 남고 배송일 기준 정산에서 빠짐). 제품 '판매 가격' **8,000 넣음(폰틱도 8,000, 2026-10-21 18:40, 커밋 1b0aa39 푸시됨)**. 치과 화면 안내문은 값을 안 적음.
- **dxd 는 FlowTemp 에 못 씀 (2026-10-22 확인)**: dxd 는 zip 이고 안의 UpperJaw·LowerJaw 가 exocad 전용 형식(STL·PLY 아님, 머리글이 난수). 설계 일꾼은 dxd 만 있으면 "STL 로 내보내 다시 올려 주세요" 로 멈춤(design_scans.candidates). **메딧 기본 이름 '-maxillary/-mandibular' 를 못 알아보던 버그 고침**(어근 maxill·mandib) — 고치기 전엔 메딧 치과 전부 아래턱 못 찾아 멈췄을 것. **obj 받음**(메딧 기본 형식) → 올리기 전 `to_stl` 로 STL 변환(설계 서비스의 obj 지원에 안 기댐). 서버 PC pull+재시작 필요.
- **시로나 dxd → FlowTemp 길 (2026-10-22)**: dxd 안 턱은 **RSA1024 암호화**(client "SIR") — 우리가 못 풂. 크라운 런처가 2026-09-10 부터 쓰던 `dscore.convert`(DS Core 에 dxd 올려 exocad 용 ply 받기)를 설계 일꾼에도 붙임: `design_scans.ensure_meshes` — stl/ply/obj 없고 dxd 만 있으면 DS Core 왕복(3~5분) 뒤 `<주문>-upperjaw.ply/-lowerjaw.ply`. 잇몸(gingiva)·삭제 전(preop/situ) 스캔은 후보에서 뺌. **서버 PC 에 DS Core 계정 필요** — `setup_server.py --dscore`(콘솔 입력, settings.json 에만). 같은 DS Core 계정을 디자인 PC 와 나눠 써도 되는지는 **시험 전** (튕기면 기공소 아래 사용자 추가). 치과는 dxd 한 번만 내보냄 — 크라운은 dxd(색), 임시치아는 ply.
- **DS Core 한 번만 (2026-10-22)**: 서버 PC 가 FlowTemp 때문에 dxd→색 붙은 ply 로 바꾸면 `deliver.upload_scans` 가 그 ply 를 **주문에 스캔(kind scan)으로 되돌려 올림**(deliver API `scan:true` 모드, 주문 열쇠는 10분짜리라 match API 로 새로 받음). 디자인 PC 크라운 런처는 주문에 상·하악(UPPER/LOWER 이름)이 이미 있으면 DS Core 변환을 **건너뜀**(dxd 는 폴더에 둠). DS Core "exocad 용" ply 는 점 색이 들어 있어 exocad 에서 색이 남(그냥 ply 내보내기는 색 없음 — 사용자 확인).
