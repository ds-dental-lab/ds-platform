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

## 7. 남은 것
1. dxd DS Core 자동화 — exe 소스 없음. 흐름은 `dxd-conversion-strings.txt`(PyInstaller 문자열): 로그인(input#email, input#current-password) → 주문 양식 `#/order_form?navctx=orders` → 새 환자(flt-semantics 버튼) → 미디어 업로드(청크 주입) → ".exocad" 내보내기 → `<CardID>…_exocad.zip` → 케이스 폴더에 풀기 → 환자 삭제. DS Core 는 Flutter 웹. 계정은 `Desktop\settings.json` {email,password,headless}.
2. sqlite 직접 등록.
3. 진단 흔적 정리: `launch.cmd`·`link-test.html` 은 문제 생길 때 다시 쓰라고 남겨 둠.

## 8. v1 에서 바뀐 것
- 상주 에이전트 + 30초 폴링 + 큐 → **버튼이 여는 런처**. 사용자: "PC 에 부담, 버튼 누를 때 매크로처럼".
- 상하악을 Denflow 에서 묻는 안 → 뺌.
- 장기 토큰 PC 저장 → 버튼이 만드는 10분 토큰.
