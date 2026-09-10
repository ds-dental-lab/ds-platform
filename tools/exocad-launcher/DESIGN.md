# Denflow → exocad 연동 설계서 (v2 · 런처 방식)

> 대상: Denflow 코드베이스를 담당하는 Claude Code 세션, 그리고 PC 쪽 런처를 만드는 사람
> 목적: Denflow 주문 목록에서 버튼 하나로 exocad 주문서까지 만들어지는 기능
> 상태: 2026-09-09 설계. **exocad 검증 통과**. **Denflow 쪽 완료**(커밋 031262f). **런처 1단계 완료·실제 주문 1건 통과(2026-09-10 ORD-260910-001)**. 남은 것: dxd 자동화(2단계), sqlite 직접 등록(2단계).
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
- dxd: 1단계는 변환기 exe 를 띄우고 사람이 ① dxd ② .dentalProject 를 끌어다 놓음.
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

## 7. 남은 것
1. dxd DS Core 자동화 — exe 소스 없음. 흐름은 `dxd-conversion-strings.txt`(PyInstaller 문자열): 로그인(input#email, input#current-password) → 주문 양식 `#/order_form?navctx=orders` → 새 환자(flt-semantics 버튼) → 미디어 업로드(청크 주입) → ".exocad" 내보내기 → `<CardID>…_exocad.zip` → 케이스 폴더에 풀기 → 환자 삭제. DS Core 는 Flutter 웹. 계정은 `Desktop\settings.json` {email,password,headless}.
2. sqlite 직접 등록.
3. 진단 흔적 정리: `launch.cmd`·`link-test.html` 은 문제 생길 때 다시 쓰라고 남겨 둠.

## 8. v1 에서 바뀐 것
- 상주 에이전트 + 30초 폴링 + 큐 → **버튼이 여는 런처**. 사용자: "PC 에 부담, 버튼 누를 때 매크로처럼".
- 상하악을 Denflow 에서 묻는 안 → 뺌.
- 장기 토큰 PC 저장 → 버튼이 만드는 10분 토큰.
