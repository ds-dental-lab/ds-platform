# Denflow → exocad 연동 설계서 (v2 · 런처 방식)

> 대상: Denflow 코드베이스를 담당하는 Claude Code 세션, 그리고 PC 쪽 런처를 만드는 사람
> 목적: Denflow 주문 목록에서 버튼 하나로 exocad 주문서까지 만들어지는 기능
> 상태: 2026-09-09 설계. **exocad 검증 통과**. **Denflow 쪽 완료**(커밋 031262f). **런처 1단계 완료·실제 주문 1건 통과(2026-09-10 ORD-260910-001)**. **dxd 자동화 완료(2026-09-10 오후, dscore.py — DS Core 브라우저 자동화, 실제 116MB dxd 로 통과)**. **sqlite 직접 등록 완료(2026-09-10 오후, exocad_db.py) — 가져오기 클릭 없음. exocad 가 열려 있어도 목록에 바로 뜸(검증: 치식·스캔·디자인 진입).**
> v1(상주 에이전트 + 큐 폴링)에서 바뀐 점은 맨 아래 §8.
> (원본은 Desktop 에 있었으나 2026-09-10 사라져 저장소로 옮김)

---

## 1. 목표 흐름

```
[Denflow 웹 (센터 주문 상세)]        [기공소 PC — 런처]                       [exocad]
"exocad 로 보내기" 버튼 ──────▶ 브라우저가 denflow://exocad/<주문ID>?t= 를 열고
                               윈도우가 런처를 띄움 (버튼 누를 때만 실행)
                               1. Denflow API 로 주문 정보 + 파일 주소 받기
                               2. 스캔 파일 다운로드
                               3. (dxd 면) dxd-conversion.exe 띄우고 안내
                               4. CAD-Data/yyyy-mm-dd_환자명/ 만들고
                                  .dentalProject 작성 + 스캔 배치 ─────▶  DentalDB 가져오기(Import) 로 열림
                               5. 작은 창에 진행 표시, 끝나면 종료
◀─────────────────────────── 완료/실패 한 번 보고
```

- 사용자가 하는 일은 Denflow 에서 버튼 누르는 것, 그리고 exocad 에서 가져오기 한 번.
- **상주 프로세스·폴링·큐 없음.** 런처는 버튼을 누른 순간만 돌고 끝나면 꺼진다.
- 결과물(ply·주문서)은 PC 폴더에만 생긴다. Denflow 에는 올리지 않는다.
- 상악·하악 구분을 Denflow 에서 묻지 않는다. exocad 가 작업 치아로 악을 알고, 파일명 매칭이 안 되면 exocad 안에서 고르면 된다.

---

## 2. Denflow 쪽 — 완료 (2026-09-09, 커밋 031262f · 고침 51d9f14·ee1e644·8c062a8)

- 코드: `src/server/domain/exocad`(순수·테스트), `src/server/exocad/token.ts`(HMAC, 열쇠 JOB_SECRET), `src/server/actions/exocad.ts`, `src/app/api/exocad/orders/[orderId]/route.ts`(+`/result`), `src/components/order/ExocadSendButton.tsx`, 표 `exocad_exports`.
- 런처가 부를 주소: `GET https://denflow.kr/api/exocad/orders/<orderId>?t=<토큰>` → §2-3 JSON + `unknownTypes`. `POST …/result?t=<토큰>` body `{status:'done'|'failed', message}`.
- 토큰 = `<만료초>.<서명>`. 10분. 주문 하나에만 맞음.

### 2-1. 버튼 — 배운 것
- 센터 주문 상세에만. 치과 화면에는 없음.
- ★ **Chrome 은 서버를 갔다 온 뒤의 `location.href = 'denflow://…'` 를 조용히 막는다.** 주소는 화면이 뜰 때 미리 받아 두고(8분마다 갱신), 버튼은 **진짜 `<a href>`**. 누른 뒤 기록만 남김.
- 첫 클릭 때 브라우저가 "덴플로우 런처를 여시겠습니까?" → "항상 허용" 체크 OK.

### 2-2. API
| 엔드포인트 | 역할 |
|---|---|
| `GET /api/exocad/orders/:id` | 주문 상세 + 스캔 파일 서명 URL(10분) |
| `POST /api/exocad/orders/:id/result` | `done`/`failed` + 메시지 → exocad_exports |

- 스캔 파일 조건: `kind='scan'` 이고 **`upload_status='uploaded'`** ('done' 아님 — 첫 실전에서 파일 0개 간 사고).
- 다운로드=제작시작 규칙은 **안 탐** (그 규칙은 기공소가 설계 파일을 받을 때만).

### 2-3. 응답
```json
{ "orderId": "…", "orderNo": "ORD-260910-001", "patientName": "홍길동", "orderDate": "2026-09-09",
  "teeth": [ {"number":46,"type":"crown"}, {"number":45,"type":"pontic"}, {"number":44,"type":"crown"},
             {"number":26,"type":"inlay"}, {"number":36,"type":"implant"} ],
  "bridges": [[44,45,46]],
  "files": [ {"name":"xxx.dxd","url":"https://…","size":123} ],
  "unknownTypes": [] }
```
- `type` = `order_items.type_code`(crown/inlay/implant) + `is_pontic`. 모르는 코드는 빠지고 `unknownTypes` 에.
- `files.name` 은 업로드 접두어(밀리초 13자리_)를 뗀 원래 이름.

---

## 3. 런처 (PC) — 1단계 완료

- 실행 사본 `C:\Users\DS\Desktop\denflow-exocad\` (launcher.py·make_project.py·install_machine.py·config.json·template.dentalProject·logs/). 저장소 사본 `tools/exocad-launcher/`.
- 등록: `pythonw.exe launcher.py %1`. ★★ **반드시 HKLM(`install_machine.py`, 관리자 UAC)**. HKCU 등록은 윈도우 셸(`start`)만 알아보고 **Chrome·Edge 는 아무 반응 없이 무시**했다 (2026-09-10 반나절). TeamViewer 등 잘 되는 프로토콜은 전부 HKLM.
- 다른 PC 에 깔 때: Python 3.10+ · `pip install requests` · config.json(exocad_dir, converter_exe) · `install_machine.py` 관리자로.
- 화면: Tk 창 하나, 5단계 진행. 실패하면 이유 + 닫기. 로그 `logs/날짜.log`, 호출 흔적 `logs/chrome-hit.txt`.
- 같은 주문을 다시 보내면 **같은 폴더에 덮어씀**(주문서·스캔 새것으로). exocad 가 잡고 있어 못 쓸 때만 `_2`. (사용자 지적 2026-09-10 — 환자명 zz 인데 zz_2 는 안 맞음)
- 환자 번호: `DentalDB_V3.sqlite` 의 `max(patient_id)+1` 을 읽어 XML 에 (읽기만).
- dxd: `dscore.py` 가 자동 처리 (헤드리스 Chrome + Selenium). 실패하면 옛 변환기 exe 를 띄우고 수동 안내로 물러섬.
  - 흐름: 로그인(login.r9.dscore.com, Flutter — 접근성 켜고 input[aria-label='이메일'/'암호'] 에 **실제 키 입력**) → #/patients '신규 환자'(이름 Demo / 성 Case<숫자> / 생년월일 오늘 / 카드 ID TMP-<초>) → 검색해 환자 열기 → '미디어 업로드' → 드롭존에 File 을 JS DataTransfer 로 drop(**MIME 은 빈 문자열**, 보이는 드롭존 하나에만) → 패널 닫고 카드(aria-label 'ds-media-tile') 대기 → ⋮(글자  버튼)를 **CDP 좌표 클릭** → '다른 이름으로 다운로드' **마우스 올리기** → '.exocad' 좌표 클릭 → zip → ply 3개(upperjaw/upperjaw-gingiva/lowerjaw) 케이스 이름으로 → 환자 삭제(줄 ⋮ → 삭제 → 이름 없는 작은 체크박스 버튼 → 삭제).
  - ★ 배운 것: 접근성 노드 클릭은 Flutter 가 탭으로 안 칠 때가 있음(⋮). 모달(업로드 패널)이 열려 있으면 뒤 화면 접근성이 감춰짐. 카드 이름은 aria-label 에만 있음. 로그인 판정은 15초 기다릴 것.
  - 계정: 런처 폴더 settings.json (저장소·덴플로우에 안 올라감). 없으면 런처가 입력창을 띄움. 임시 환자 이름에 덴플로우 관련 글자 없음(사용자 지시).
- 시험: `python launcher.py --mock mock.json`.

---

## 4. exocad 주문서 생성 규칙 (`make_project.py`)

### 4-1. 종류 매핑
| Denflow | type | ReconstructionType | Material | ImplantType |
|---|---|---|---|---|
| 크라운 전부 | `crown` | AnatomicCrown | ZI | None |
| SCRP·시멘트·어버트먼트 | `implant` | AnatomicCrown | ZI | CustomAbutment (MaterialAbutment=TI) |
| 인레이·온레이 | `inlay` | AnatomicInlay | ZI | — |
| 폰틱 | `pontic` | AnatomicPontic | ZI | — |

- 재료 ZI 고정. 파라미터는 샘플(template.dentalProject, 2026-09-09_test) 값 그대로. 주문서는 환자당 하나.

### 4-2. 자동 추가 치아
- 인접치: 작업치아 양옆 HealthyTooth. 작업치아끼리 제외. 정중선(11↔21, 41↔31)·최후방(x8) 처리.
- 대합치: 한쪽 악에만 있으면 반대편 Antagonist 1개(첫 작업치아의 대응 치아). 양악이면 없음.

### 4-3. 브릿지
- 치아마다 `<MesialConnector>`. 구성원 중 **가장 근심 치아만 false**, 나머지 true. exocad 에서 초록 점(연결)으로 확인됨(2026-09-09 런처시험).
- 미해결: 정중선 넘는 앞니 브릿지(12-11-21-22). 샘플 없음.

### 4-4. 파일
- XML, UTF-8 BOM, CRLF. `WorkParams`·`WorkParamsSHA` 샘플 그대로. `ProjectGUID` uuid4, `ProjectUniqueId` 대문자 26자.
- `SeparateGingivaScan` false 고정 (잇몸 분리 스캔은 수동, 사용자 2026-09-09).

---

## 5. 스캔 파일
| 형식 | 처리 |
|---|---|
| `.dxd` | dxd-conversion.exe (DS Core) → ply. 1단계는 사람이 드롭 |
| `.stl/.obj/.ply` | 변환 없음. 확장자 유지 |

- exocad 자동 인식 이름: `{yyyy-mm-dd}_{환자명}-upperjaw.*`, `-lowerjaw.*` (하이픈).
- 키워드: 상악 `upperjaw|maxillar|upper|상악`, 하악 `lowerjaw|mandibul|lower|하악`, 바이트 `occlusion|bite` → 그대로, 마커 `marker` → 그대로.
- 실제 파일명(2026-09-09): `2026-09-02-김정자-2026-09-02-upperjaw.obj / -lowerjaw / -occlusionfirst / -upperjaw-marker`, `2026-09-09-최정여-maxillary.obj / -mandibular / -occlusionfirst`.

---

## 6. exocad 사실 (검증 2026-09-09)
- 주문 목록은 폴더가 아니라 `CAD-Data/DentalDB_V3.sqlite`. 폴더만 만들면 안 뜬다 → DentalDB **가져오기(Import)** 로 `.dentalProject` 선택.
- 가져오기 시 DB 줄: Treatment 1, patients 1, ToothWork n, ToothWorkParameters ~11×n, TreatmentValuedParameters 2, ValuedMaterialParameters 1, WorkParamsInfo 1 + LocalImport 1.
- PatientId 0 은 0 그대로 저장돼 둘째부터 충돌 → max+1.
- 2단계 후보: sqlite 직접 등록(클릭 0회). exocad 가 DB 를 열고 있어 잠금 주의.

## 6-2. DB 직접 등록 (exocad_db.py)
- 가져오기가 만드는 줄을 그대로: patients(fname='', lname=이름) / WorkParamsInfo(+LocalImport) / Treatment / ToothWork(flags=MesialConnector) / ToothWorkParameters(+Numeric·Textual·Dependent) / ValuedMaterialParameters / TreatmentValuedParameters. 치아 파라미터는 **같은 종류의 기존 치아를 복제**.
- ★ exocad 는 케이스 폴더를 `{t_date 날짜}_{lname}` 로 찾는다 → DB t_date 와 XML DateTime 을 **폴더 날짜(주문일)** 로 맞춤. 어긋나면 "이 프로젝트의 파일은 유효하지 않습니다".
- ProjectGUID·PatientId·TrayNo(2) 는 XML 과 DB 가 같아야 함. 한 트랜잭션(begin immediate), 실패 시 가져오기 안내로 물러섬.
- 시험 정리: `ExocadDb.delete_treatment(tid)`.

## 6-3. 런처 UI (2026-09-10 오후)
- 작은 알림 띠(오른쪽 아래, 제목줄 없음): 단계·환자·막대. 성공하면 6초 뒤 **스스로 닫힘**, 실패하면 남아서 이유. 띠 클릭 = 자세히, 드래그 = 이동.
- dxd 가 여럿이면 내려받기 전에 **고르기 창**(사용자 요청). stl/obj/ply 는 전부.
- dxd 동시 변환은 잠금(dscore.lock)으로 줄 세움.

## 6-4. 속도·동시 실행 (2026-09-10 오후)
- dxd 한 건 **56초** (로그인 3 · 환자 14 · 업로드+처리 20 · 내보내기 19). 병목 둘 제거: base64 조각 주입(20초) → 숨은 `<input type=file>` 로 0초; 임시 환자 삭제는 완료 뒤 뒷정리.
- **동시 3건**: 자리(slot)마다 Chrome 프로필. 2·3번은 **1번 프로필 복사**(새 로그인 안 함 — 새 프로필 첫 로그인이 자주 틀어지고 반복 실패 시 DS Core 가 계정을 잠시 막음). 임시 환자 카드 ID 는 초+PID. exocad 환자 번호는 DB 트랜잭션 안에서 정하고, 주문서(XML)는 그 뒤에 씀. 두 건 동시 58초 통과.
- 로그: `logs/날짜.log`, `logs/runs/시각-PID.log`, `logs/runs.csv`(주문·결과·단계별 초).
- UI: 시작·끝 토스트 3초, 실패만 알림창(로그 열기). 옛 변환기 exe 예비 실행은 뺌.

## 7. 남은 것
1. dxd DS Core 자동화 — exe 소스 없음. 흐름은 `dxd-conversion-strings.txt`(PyInstaller 문자열): 로그인(input#email, input#current-password) → 주문 양식 `#/order_form?navctx=orders` → 새 환자(flt-semantics 버튼) → 미디어 업로드(청크 주입) → ".exocad" 내보내기 → `<CardID>…_exocad.zip` → 케이스 폴더에 풀기 → 환자 삭제. DS Core 는 Flutter 웹. 계정은 `Desktop\settings.json` {email,password,headless}.
2. sqlite 직접 등록.
3. 진단 흔적 정리: `launch.cmd`·`link-test.html` 은 문제 생길 때 다시 쓰라고 남겨 둠.

## 8. v1 에서 바뀐 것
- 상주 에이전트 + 30초 폴링 + 큐 → **버튼이 여는 런처**. 사용자: "PC 에 부담, 버튼 누를 때 매크로처럼".
- 상하악을 Denflow 에서 묻는 안 → 뺌.
- 장기 토큰 PC 저장 → 버튼이 만드는 10분 토큰.


## 7. STL → 이미지 (2026-09-28)

DLAS 의 'STL TO IMAGE' 와 같은 일을 하는 **따로 도는 창**입니다 (`stl_image.py`,
바로가기 `stl-image.cmd`). 신터링 뒤 크라운이 누구 것인지 눈으로 찾는 종이를 만듭니다.

- 폴더 하나를 고르면 그 아래 STL 을 모두 찾아 **여섯 방향**(위·아래·앞·뒤·왼쪽·오른쪽)으로 그립니다.
- 크라운 하나가 **한 줄**, 줄을 모아 **A4**(PNG + PDF, 300dpi). 줄이 적으면 종이를 채우게 키웁니다.
- 곁들이: 목록 `STL목록.txt` · 뷰어 `STL이미지.html`(이름으로 찾기) · 파일별 `<이름>_views.png`.
- 옵션: 모든 STL / 보철만(crown·abutment…), 처리한 폴더 건너뛰기(`processed.stl-image`),
  끝나면 폴더 열기, 각 폴더에 저장 / 한 폴더에 모아 저장. 고른 값은 `stl_image.json` 에 남습니다.

★ **3D 라이브러리를 안 씁니다** (`stl_render.py`). OpenGL 을 쓰는 것들은 헤드리스에서
  화면을 못 잡는 일이 잦아, 삼각형을 면적만큼 점으로 흩뿌리고 z 버퍼로 앞의 것만 남기는
  방식으로 numpy 안에서 끝냅니다. 두 배로 그린 뒤 줄여 구멍과 계단을 없앱니다.
  크라운 하나(7만 면) 여섯 방향에 1초 안팎, 케이스 일곱 개에 6초(실측).

★ 필요한 것: `pip install numpy pillow` (런처의 파이썬에 이미 넣어 뒀습니다).


## 8. 지그 만들기 (2026-09-29)

디자인이 끝난 STL 을 **복사해** 인접면을 옆 치아에 **닿게(간격 0)** 맞춰
`<환자명> 지그.stl` 로 저장합니다 (`jig.py` 계산 · `jig_app.py` 창 · 바로가기 `jig.cmd`).

- 케이스 폴더 하나든, 케이스들이 든 폴더든 고르면 됩니다. 원본은 절대 안 건드립니다.
- 같은 이름이 이미 있으면 `_2`, `_3` 으로 붙입니다 — 손으로 만든 지그를 덮지 않습니다.
- 값 둘: **인접면 간격**(기본 0 = 딱 닿음) · **맞출 범위**(기본 0.35mm, 이보다 먼 면은 안 건드림).
- 어벗먼트는 기본으로 뺍니다(인접면이 없어 0점).

★ **안쪽(지대치에 앉는 면)은 손대지 않습니다.** 스캔에는 옆 치아와 삭제된 지대치가
  함께 있습니다. 크라운을 위에서 본 **발자국(볼록껍질) 안**은 제 지대치로 보고 제외하고,
  **밖**의 점만 인접치로 씁니다.
★ 미는 방향은 **점의 법선**입니다. 가까운 스캔 점으로 곧장 당기면 면이 찢어지고
  가장자리가 톱니처럼 됩니다(처음에 그랬습니다). 밀어낼 양을 이웃과 여섯 번 고르게
  펴서(라플라시안) 자국을 없앱니다.
★ **두 가지 중 고릅니다** (사용자 요청 2026-09-29): 날개 없음 / 날개 있음.
  날개는 옆 치아 스캔 면을 한 겹 떠서 법선 쪽으로 **기본 2mm** 띄우고 가장자리를 벽으로 막은
  덮개입니다 — 바닥이 그 치아 모양 그대로라 위에 정확히 앉습니다. 범위 기본 6mm.
  **한쪽만** 덮습니다(인접면이 밀린 방향). 빙 두르면 빼낼 수가 없습니다.
  가장자리는 깎았다 넓혀(erode·dilate) 톱니를 없애고, 부스러기는 가장 큰 덩어리만 남깁니다.
  파일 이름은 `<환자명> 지그(날개).stl`.
★ 스캔(ply)이 없는 케이스는 인접치를 알 수 없어 건너뜁니다.
★ 실측: 조현선 17 크라운 — 인접면 1495점, 최대 0.12mm, 한 건 1초.

## 9. DS Core 기공소 주문 화면 — 읽히는 것 (실측 2026-10-05)

치과가 DS Core 로 보낸 주문을 **기공소 계정에서** 읽어 덴플로우 주문으로 잇는 길.
공식 길(open.dscore.com API)은 신청해 둔 상태이고, 그 전에 화면으로 읽히는지 확인했습니다.

**목록** `#/orders` (수신됨 탭) — 한 줄에 이만큼 있습니다. 잎 노드(flt-semantics 중
자식 없는 것)의 좌표로 칸을 가립니다.

| 칸 | 값 | 덴플로우 |
|---|---|---|
| 주문 ID | `9AFAAT5S` | 같은 주문 두 번 안 받기 |
| 상태 | `수락함` | — |
| 카테고리 · 서비스 | `수복` · `수복물` | — |
| 치아 | `크라운 · 13, 12, 11` | 제품 + 치식 |
| 고객 | `DS치과` | 치과 |
| 주문자 | `DS Lee` | — |
| 환자 | `DS Core, Demo` | 환자명 |
| 마감일 | `2026-10-06 · 12:00` | 요청시한 |

**상세** — 목록에서 **줄 전체**(`flt-semantics[flt-tappable]`, 높이 72)를 눌러야 들어갑니다.
글자 칸을 누르면 `ElementClickInterceptedException` 입니다. 주소는 표시용 주문 ID 가 아니라
내부 uuid 입니다: `#/orders/bd41da6a-…?navctx=orders` — **주소로 직접 못 들어갑니다.**

상세에 더 있는 것: `서비스 세부 정보 → 크라운 / 치아 (FDI) 13, 12, 11 / 서비스 유형 디자인 및
제작`, 배송 수신자(치과 주소), `파일 (1)` 탭의 dxd.

★★ **재료·쉐이드는 이 주문에 없었습니다.** 화면에 "이 주문에는 아직 기공소 프로필에 나열되지
  않은 서비스가 포함되어 있습니다" 가 떠 있었습니다 — 기공소 구성에 서비스를 넣으면 달라질
  수 있으나 확인 못 했습니다.

★★ **생년월일이 상세에 있습니다**(`1985-09-01`). **가져오지 않습니다** (사용자 결정 2026-10-02).

★ 그 화면에 `수락 / 거부 / 완료 / 새 하도급 주문` 이 같이 있습니다. 읽기만 하는 코드라도
  **누를 것을 이름으로 한 번 더 확인**하고 눌러야 합니다 — 잘못 누르면 진짜 주문이 바뀝니다.

★ 로그인은 **주문 전용 프로필**(`chrome-profile-orders`)에 둡니다. dxd 변환이 쓰는 1번과
  섞으면, 기공소 계정과 변환용 계정이 서로 덮어씁니다.

### 9-1. 상세에서 쉐이드까지 (실측 2026-10-05, `dscore_orders.read_detail`)

★★ **창을 1920 으로 넓혀야 합니다.** 1400 에서는 `치아 색조 가이드 / 치아 색상` 두 줄이
  **아예 안 그려집니다** — 화면에 없으니 접근성 트리에도 없고, 쉐이드를 못 읽습니다.
  (`WINDOW = (1920, 1200)`. 56조각 → 67조각으로 늘고 그 두 줄이 생깁니다.)

★ 상세는 **두 칸**으로 놓이고, 값은 이름표 **바로 아래 같은 x** 에 적힙니다
  (이름표 y=879 → 값 y=900, x 동일). y 가 아니라 x 로 짝을 짓습니다.

임플란트 브릿지 한 건에서 읽힌 것:

| 이름표 | 값 | 덴플로우 |
|---|---|---|
| 치아 (FDI) | `12, 11` | 치식 |
| 서비스 유형 | `디자인 및 제작` | — |
| 브릿지 | `시멘트 유지형` | **Abut + Zir(Cementation)** 을 가르는 값 |
| 임플란트 제조업체 · 스캔바디 | `기타` · `Atlantis IO FLO` | 임플란트 모델 |
| 치아 색조 가이드 | `VITA Classical + Bleached` | 쉐이드 체계 vita_classic |
| 치아 색상 | `A2` | 쉐이드 |

★ **재료(지르코니아·PMMA)는 아직 안 옵니다.** 기공소 구성에 서비스별 재료를 넣어야
  나오는 것으로 보입니다 — 확인 필요.
★ 주문에 딸린 dxd 도 열어 봤지만 `<ToothDefinitions />` 가 비어 있습니다 (149MB,
  `9AFAAUB9_123213_DI_…dxd`). **주문 정보는 DS Core 안에만 있습니다.** 다만 파일 이름이
  `<주문ID>_<차트번호>_…` 라, 파일과 주문을 이름으로 맺을 수 있습니다.

## 10. 스캔 이름이 '상·하악' 을 안 적는 스캐너 (2026-10-06, 박상균 ORD-261005-004)

버튼은 3초에 '완료' 로 끝났는데 exocad 에서 스캔이 안 붙었습니다. 원인 둘.

**① 이름을 하나도 못 바꿨습니다.** 로그의 화살표 양쪽이 같았습니다.

```
Raw Bite scan.stl         → Raw Bite scan.stl
Raw Antagonist scan.stl   → Raw Antagonist scan.stl
AbutmentAlignmentScan.stl → AbutmentAlignmentScan.stl
Raw Preparation scan.stl  → Raw Preparation scan.stl
```

exocad 는 폴더 안에서 **이름으로** 찾습니다 (사장님 케이스들에서 확인):
`<폴더명>-upperjaw.ply` · `-lowerjaw.ply` · `-upperjaw-marker.ply` · `-upperjaw-situ.ply`.
그런데 이 스캐너는 `Preparation`(깎은 쪽) · `Antagonist`(대합) 로만 적고 **악을
안 적습니다**. 런처가 알던 낱말은 upperjaw/maxillary/lowerjaw/mandibular 뿐이었습니다.

→ **주문의 치식으로 악을 정합니다** (`working_jaw`): 11~28 상악, 31~48 하악.
  14번이면 Preparation=upperjaw, Antagonist=lowerjaw, AbutmentAlignment=upperjaw-marker.
  두 악에 걸쳐 있으면 못 정하므로 이름 그대로 두고 로그에 적습니다.

**② 임플란트인데 주문서에 스캔바디가 꺼져 있었습니다.** 틀(template)이 false 라,
스캔바디 스캔이 같이 와도 exocad 가 안 썼습니다. 사장님이 손으로 만든 같은 환자
케이스는 `<ScanAbutmentScan …>true</ScanAbutmentScan>` 였습니다.

→ **스캔바디 파일이 온 경우에만** true 로 켭니다 (`build_project(scan_abutment=True)`).
  늘 켜면 안 뜬 케이스에서 exocad 가 없는 스캔을 찾습니다.

★ 바이트(`Raw Bite scan.stl`)는 **그대로 둡니다.** 쓰시긴 하는데(사용자 확인),
  exocad 가 자동으로 집는 이름이 무엇인지 아직 못 밝혔습니다 — 사장님 케이스
  폴더 어디에도 바이트 파일이 없습니다. 사람이 고르면 됩니다.

### 10-1. zip 으로 올라온 스캔 (2026-10-06)

치과가 zip 으로 올리는 일이 있습니다 (올라온 파일 중 zip 5개, `.constructionInfo`
6개 — 3Shape 쪽으로 보입니다). exocad 는 zip 을 못 엽니다.

→ 런처가 **먼저 풀고** 그 다음에 이름을 붙입니다 (`unzip_scans`).
  꺼내는 것: 그물(stl·obj·ply) · dxd · `.constructionInfo`. 그 밖(pdf 등)은 두고 옵니다.
  폴더 구조는 버리고 **파일만** 꺼냅니다 — exocad 는 케이스 폴더 바로 아래를 봅니다.
  한글 이름은 CP949 로 되돌립니다 ('UTF-8 이다' 표시가 없는 zip, 메딧에서 겪은 것과 같음).
  못 풀거나 안에 쓸 것이 없으면 zip 을 그대로 넣습니다.
