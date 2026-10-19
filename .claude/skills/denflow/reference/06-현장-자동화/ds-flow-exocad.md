---
name: ds-flow-exocad
description: "exocad 연동 (2026-09-09) — 버튼→denflow:// 런처 방식. 검증 통과. Denflow 쪽 완료, 런처는 PC 쪽 별도 프로그램"
type: project
---

**설계서**: `C:\Users\DS\Desktop\exocad-연동-설계서.md` (v2). v1(상주 에이전트·폴링·큐)은 사용자가 "PC 부담, 버튼 누를 때 매크로처럼" 이라 해서 버림.

- **흐름**: 센터 주문 상세 "exocad 로 보내기" → 서버가 10분 토큰 → `denflow://exocad/<id>?t=` → PC 런처가 `GET /api/exocad/orders/<id>?t=` 로 치식·브릿지·스캔 서명 URL 받아 `.dentalProject` 조립 + CAD-Data 에 배치 → (선택) `POST …/result`. 표 `exocad_exports`.
- **exocad 사실**: 주문 목록은 폴더가 아니라 `CAD-Data/DentalDB_V3.sqlite`. 폴더만 만들면 안 뜨고 DentalDB **가져오기(Import)** 를 눌러야 등록됨(검증 2026-09-09 통과: 새 환자·치식·스캔 다 정상). PatientId 0 을 넣으면 0 그대로 저장돼 둘째부터 충돌 → `max(patient_id)+1`.
- **생성기**: `Desktop\denflow-exocad\make_project.py` — 샘플 `CAD-Data/2026-09-09_test` 의 치아 블록을 틀로 조립. 인접치 Healthy, 한쪽 악이면 대합치 1개, 브릿지는 가장 근심만 MesialConnector false.
- **dxd 변환기** `Desktop\dxd-conversion.exe`: 소스 없음. DS Core(r9.dscore.com) Selenium 자동화 → `_exocad.zip` → ".dentalproject 드롭" 창에 케이스 파일을 주면 그 폴더에 ply 풀어 넣음. CLI 없음. 계정은 `Desktop\settings.json` {email,password,headless}.
- 사용자 결정: 상하악 Denflow 에서 안 물음(exocad 가 앎), 잇몸 분리 스캔은 수동, 파일명 키워드 upperjaw/maxillary, lowerjaw/mandibular, occlusionfirst, marker.
- **런처 1단계 완료·첫 실전 통과 (2026-09-10)**. `Desktop\denflow-exocad\launcher.py`, 저장소 `tools/exocad-launcher`. dxd 는 변환기 exe 띄우고 사람이 두 번 드롭.
- ★★ **denflow:// 는 반드시 HKLM 에 등록** (`install_machine.py`, UAC). HKCU 등록은 윈도우 셸만 알아보고 **Chrome·Edge 는 아무 반응 없이 무시** — 반나절 헤맸음. 또 Chrome 은 서버 왕복 뒤 location.href 로 여는 것을 막음 → 버튼은 미리 받은 주소를 진짜 <a href> 로.
- ★ order_files.upload_status 완료값은 **'uploaded'** ('done' 아님).
- **dxd 자동화 완료 (2026-09-10)**: `dscore.py` — 헤드리스 Chrome 으로 DS Core 조작. 핵심 요령은 DESIGN.md §3 (좌표 클릭·hover·빈 MIME·모달 닫기·aria-label). 임시 환자 "Demo, Case<숫자>" (덴플로우 글자 금지, 사용자 지시). 계정은 `settings.json`(he789@naver.com, 새로 만든 DS Core 계정) — 비밀번호가 대화에 노출됐으니 바꾸라고 권함.
- **DB 직접 등록 완료 (2026-09-10 오후, exocad_db.py)**: 가져오기 클릭 없음. 폴더는 `{t_date}_{lname}` 로 찾으니 날짜를 주문일로 맞출 것. UI 는 오른쪽 아래 작은 띠, 성공 시 자동 닫힘 (사용자: "창이 계속 떠 있는 게 불편"). dxd 여럿이면 고르기 창.
- 남은 것: 실제 주문으로 처음부터 끝까지 시간 재기, 실패 사례 모으기.
- 2026-09-14: DS Core 임시 환자(Case14958596/616)·exocad 시험 케이스는 사용자가 지움.

## STL → 이미지 모듈 (2026-09-28, 커밋 895f810)
- 사용자가 DLAS 'STL TO IMAGE' 안내서를 보여 주며 요청. 런처 폴더의 **따로 도는 창**: `stl_image.py` + 바로가기 `stl-image.cmd` (Desktop\denflow-exocad 에도 복사).
- 폴더 훑기 → STL 여섯 방향 그림 → 크라운 한 줄 → A4 PNG+PDF(300dpi, 줄 적으면 키움) · `STL목록.txt` · `STL이미지.html`(이름 검색) · `<이름>_views.png`.
- 옵션: 모든 STL/보철만, 처리한 폴더 건너뛰기(processed.stl-image), 끝나면 폴더 열기, 각 폴더/한 폴더 저장. 설정은 stl_image.json.
- ★ 3D 라이브러리 안 씀 — `stl_render.py` 가 numpy 로 점 흩뿌리기 + z버퍼, 2배 렌더 후 축소. 크라운 7만 면 여섯 방향 ≈1초, 케이스 7개 6초(실측). `pip install numpy pillow` 필요(설치 완료).

## 지그 만들기 모듈 (2026-09-29, 커밋 43e15a6)
- 사용자 요청: "완성 디자인 복사 → 인접면 0으로 잘라 → 파일명 지그". 물어보니 **'인접치에 닿을 때까지 깎기'** 방식 선택.
- `jig.py`(계산)·`jig_app.py`(창)·`mesh_io.py`(STL 쓰기·PLY 읽기)·`jig.cmd`. Desktop\denflow-exocad 에도 복사.
- 규칙: 크라운 발자국(볼록껍질) **밖**의 스캔 점만 인접치로 보고, 점 법선 방향으로 (거리-간격)만큼 밀어 붙임. 밀 양은 라플라시안 6회로 펴서 톱니 제거. 기본 간격 0, 범위 0.35mm.
- 기존 `<환자> 지그.stl` 은 **안 덮어씀**(_2, _3). 스캔 ply 없는 케이스는 건너뜀(이슬여처럼 스캔 없는 폴더 있음).
- ★ 기존 손 지그(조현선)는 크라운에서 파생된 게 아니었음(거리 중앙 2mm) — 옆 치아 위 날개까지 있는 별도 설계. 이번 모듈은 사용자가 고른 '닿게 깎기'만 함.
- **날개용/날개없는용 선택 추가(2026-09-29, 커밋 6e4d33b)**: 날개 = 옆 치아 스캔 면을 떠서 법선으로 **2mm**(기본) 띄우고 벽으로 막은 덮개, 범위 6mm, **인접면이 밀린 한쪽만**, 가장자리 erode/dilate + 최대 덩어리. 파일명 `<환자> 지그(날개).stl`. PLY 면 읽기는 mesh_io.load_ply_mesh.
- 남은 다듬기: 날개 가장자리가 스캔 결대로 조금 거칢, 범위·방향은 값으로만 조절. 사용자 피드백 대기.

## 치과 스캔 자동 올리기 — 첫 조각 (2026-10-02, 커밋 6c8f5f9)
- 사용자 구상: 치과(프라임스캔)가 DS Core 에서 **내보내기 할 때만** 덴플로우에 스캔+의뢰가 올라가게. 내보내기 폴더는 고정.
- ★ **파일명 규격화 필요 없음** — dxd 는 zip 이고 안의 `DentalCase.xml`(UTF-16LE)에 환자명(Last+First)·차트번호(PatientID)·치과명(Dentist/Name)·스캔 시각·CaseGUID·모델 구성이 들어 있음. 실파일 3개로 확인.
- `tools/exocad-launcher/dxd_case.py` (Desktop\denflow-exocad 에도 복사): read_case(path) → DxdCase. 한글이름은 성+이름 붙이고 영문은 띄움, '다서울치과 다서울치과' 중복 제거.
- ★ **생년월일은 안 읽음**(사용자 결정). 치과명은 **안내용만**, 막는 조건 아님(스캐너에 '2510' 처럼 적힌 곳 있음) — 나중에 덴플로우 치과명과 매칭에 쓸 수 있음.
- 치식: 보낸 3건은 ScanOnly(Impression) 라 수복물 정보 없음 → 커넥트에서 수복물 지정한 dxd 한 건 받아 ToothNumber 유무 확인 필요.
- 다음 조각(미구현): 치과 PC 감시 프로그램(새 dxd 안정화 후 업로드·CaseGUID 로 중복 방지), 기기 연결 6자리 코드, 스캔 먼저 받는 길(미분류 스캔함), 주문 등록 화면 미리채움.

## 치과 스캔 자동 올리기 1차 완성 (2026-10-02, 커밋 9b1c34d · migration 20261002120000)
- 흐름: 치과 PC 올리미(`scan_agent.py`, 바로가기 `scan-agent.cmd`)가 내보내기 폴더 감시 → 새 dxd 안정화 뒤 메타(dxd_case)만 읽어 API 호출 → **저장소 서명 업로드로 바로 올림**(Vercel 4.5MB 한계 피함) → 완료 알림 → 브라우저로 `/clinic/orders/new?scan=<id>` 열림(환자명 미리 채움).
- 표 셋: `clinic_devices`(열쇠는 sha256 해시만), `device_link_codes`(6자리·10분·1회), `incoming_scans`(case_guid 유일색인으로 재내보내기 중복 차단). 치과만 select, 넣기·고치기는 서비스 열쇠(API)만.
- 화면: 치과 계정정보 '스캐너 PC 연결'(코드 발급·해제), 메뉴 '들어온 스캔'(/clinic/scans, 사용자도 봄), 주문 등록이 스캔을 받아 등록 뒤 `submitAttachIncomingScan` 으로 **저장소 안에서 주문 폴더로 이동**(재업로드 없음).
- 운영 실측(2026-10-02): 연결→자리→업로드→마무리→목록→주문서 미리채움 모두 통과, 같은 케이스 재요청은 already. 시험 데이터·임시 계정 삭제 완료.
- 남은 것: 올리미 자동 시작(작업 스케줄러), 재스캔 주문에 붙이기(같은 환자 대기 건 묻기), 치식 자동 채움(커넥트에서 수복물 지정한 dxd 확인 필요), 치과명 매칭 안내.

## 스캔 자동 올리기 2차 — 재스캔·치과명·exe (2026-10-02, 커밋 09eb6ec·3cb5791·826d24a·435f2e1)
- **재스캔 주문에 붙이기**: 같은 환자(띄어쓰기만 무시, 품는 비교 안 함)가 rescan 으로 걸려 있으면 '들어온 스캔' 목록에 붉은 단추가 먼저. 붙인 뒤 접수로 되돌림(순서 뒤집으면 스캔 없는 주문이 올라감). `submitRescanWithIncomingScan`. **운영에서 끝까지 확인(ORD-261002-002)** — 파일은 저장소 안에서 이동, 이전 파일 내려감, 이슈 닫힘.
- **치과명 안내**: 다르면 노란 띠(막지 않음). '치과/치과의원' 꼬리 차이·품는 관계는 같게. **글자 없는 값은 안 알림** — 실파일 Dentist 칸이 '2510' 이었음.
- ★ **xml 의 DateTime 은 UTC**. 파일명 11-34-58 인 스캔의 xml 이 hour="2" — 9시간 보정 넣음(2026-10-02).
- ★ **치식은 실파일 5개 모두 비어 있음**(전부 ScanOnly/Impression, `<ToothDefinitions/>` 빈 태그). 대신 **파일 이름에 '#11,21' 로 적는 치과가 있어** 이름에서 읽음(`teeth_from_name`, '#' 있을 때만 — 날짜·차트번호가 치식 되는 것 막음). 커넥트에서 수복물 지정한 dxd 는 아직 못 받음.
- **exe 한 개로 배포**(`build-exe.cmd`, PyInstaller --onefile --windowed, 14MB, 치과 PC 에 파이썬 불필요). exe 는 저장소에 안 넣음(.gitignore). ★ 묶이면 `__file__` 이 임시 폴더라 설정은 `%APPDATA%\DenFlow` 에 — 안 그러면 **껐다 켤 때마다 연결 풀림**. 자동 시작 바로가기도 exe 자체를 가리킴.
- 치과에 주는 A4 안내문: `tools/exocad-launcher/스캐너-연결-안내.html` (브라우저로 열어 인쇄, 295mm 로 둬서 빈 둘째 장 안 나옴).
- ★★ **"켜져 있을 때만 작동" 이 맞음 (사용자 결정 2026-10-02)**. 꺼진 사이 내보낸 건을 나중에 채워 올리는 기능은 **일부러 안 함** — "직관적이다". 내보냈는데 주문서 창이 안 뜨면 그 자리에서 꺼진 걸 앎. 다시 제안하지 말 것.

## 스캐너 회사 주문을 덴플로우로 (2026-10-05, 조사·결정)
- **DS Core 기공소 계정**에서 주문이 읽힙니다 (`dscore_orders.py`, 화면 긁기. 공식 API `open.dscore.com` 신청해 둠). 메딧도 공개 API 있음(심사), 신청해 둠.
- 읽히는 것: 환자·치과·마감일·치식·제품·**방식(시멘트 유지형→Cementation)**·**쉐이드(A2 + VITA Classical)**·스캔바디·파일. 화면 규칙은 DESIGN.md §9·§9-1.
- ★★ **창을 1920 으로** 안 넓히면 '치아 색조 가이드/치아 색상' 두 줄이 아예 안 그려져 쉐이드를 못 읽습니다.
- ★ **재료(지르코니아·PMMA)는 안 옵니다.** DS Core 기공소 구성에 재료 자리가 없습니다(사용자 확인).
- ★★ **재료는 기본값을 넣지 않고 비워 둡니다 (사용자 결정 2026-10-05).** 이유: 재료가 판매가·기공원가를 정하고 정산은 발행하면 끝이라 되돌리기가 어렵습니다. 기본값은 틀려도 티가 안 나고, 빈 칸은 눈에 띕니다. **"1개라도 잘못 들어오면 치명적"**.
- 그래서 **자동 접수는 안 합니다** — 재료가 비면 주문을 만들 수 없습니다. 모양: '들어온 주문' 목록에 쌓임 → 열면 나머지가 채워져 있음 → **재료만 고르고 등록**. 치과는 한 번 맺으면 끝.
- 메딧 내보내기 PDF 길은 **접었습니다** — 'PDF로 케이스 정보 저장' 체크가 기억이 안 돼 매번 눌러야 합니다(사용자 확인). 치식은 이름의 '#26' 으로 받습니다.
- 제품 매핑표는 `src/server/domain/medit-map` (PDF·API 양쪽이 같은 낱말을 씁니다). 못 맞추면 비웁니다.
