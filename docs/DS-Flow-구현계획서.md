# DS Flow 구현 계획서

**문서 버전** v1.6 · 2026-08-06
**기준 문서** DS Flow Architecture v1.0 (시스템 설계서), DS Flow 기능 명세서 v0.2 (PRD)
**전체 기간** Sprint 0 (1주) + 9개 스프린트 × 2주 = 19주

> 본 문서는 Architecture v1.0을 구현 순서로 옮긴 것이다. 설계서 §10의 스프린트 개요를 세분화했으며, **본 문서의 번호 체계가 이후 기준**이 된다.
> (설계서 Sprint 0~8 → 본 문서 Sprint 1~9. 설계서의 Sprint 2가 등록/조회 두 스프린트로 나뉘었다.)
>
> **v1.1 변경** — 기능 개발 전 단계로 **Sprint 0 (Project Foundation, 1주)** 를 추가했다. 상세는 별도 문서 `DS-Flow-Sprint0-Foundation.md` 참조. 이에 따라 Sprint 1의 범위가 조정되었다.

---

## 0. 공통 규칙

### 0.1 모든 스프린트에 적용되는 완료 조건 (Definition of Done)

| 항목 | 기준 |
|---|---|
| 타입 | TypeScript strict 통과, `any` 사용 금지 |
| 마이그레이션 | 되돌리기(down) 스크립트 포함, 스테이징 선반영 |
| RLS | 신규 테이블은 정책 없이 배포 금지 |
| 테스트 | 도메인 로직 단위 테스트, 주요 경로 E2E |
| 권한 | 3섹터 각각으로 접근해 노출 범위 확인 |
| 감사 로그 | 민감 데이터 조회·변경 시 기록 확인 |
| 문서 | 변경된 API는 스펙 갱신 |

### 0.2 스프린트 진행 방식

- 스프린트 시작 전 **미정 항목이 해소되었는지 확인**한다. 미해소 시 해당 기능은 다음 스프린트로 이월한다.
- 각 스프린트 마지막 이틀은 검증·보정에 사용한다.
- 화면은 세 섹터 공통 컴포넌트를 먼저 만들고 섹터별 차이를 나중에 얹는다.

### 0.3 환경

| 환경 | 용도 |
|---|---|
| local | 개발자 로컬 + Supabase 로컬 |
| staging | 마이그레이션 검증, 내부 테스트 |
| production | 시범 치과 대상 (Sprint 9 이후) |

---

## Sprint 0 — Project Foundation

**기간** 1주
**목표** 기능 개발 없이, 이후 스프린트가 올라탈 뼈대를 만든다.
**상세 문서** `DS-Flow-Sprint0-Foundation.md`

### 구현할 기능

프로젝트 폴더 구조 · 공통 컴포넌트 전략 · 상태관리 방식 · Supabase 구조 · 환경변수 · ESLint/Prettier · Git 브랜치 전략 · 디자인 시스템(shadcn/ui) · 공통 레이아웃 · 파일 업로드 전략

### 필요한 화면

| 경로 | 화면 |
|---|---|
| `(clinic|design|lab|admin)/` | 섹터별 빈 페이지 (테마 전환 확인용) |

### 필요한 API

없음. 인프라만 구성한다.

### 필요한 DB

스키마 없음. **마이그레이션 체계와 시드 구조만** 구축하고 첫 마이그레이션은 Sprint 1에서 작성한다.

### 완료 기준

- [ ] 새 개발자가 클론 후 `.env.example`만 채우고 로컬 실행에 성공한다
- [ ] 계층 경계 린트가 실제 위반을 잡아낸다 (`server/domain` → Supabase import 차단)
- [ ] 클라이언트에서 admin 클라이언트 import 시 린트가 막는다
- [ ] `data-sector` 변경만으로 같은 버튼이 3가지 색으로 렌더된다
- [ ] 마이그레이션 적용 · 되돌리기 1회 검증
- [ ] CI(타입·린트·테스트·빌드) 통과 시에만 PR 병합 가능
- [ ] preview · staging · production 배포 확인

---

## Sprint 1 — 인증과 데이터 모델

**기간** 2주
**목표** 세 섹터 계정으로 로그인해 각자의 화면에 도달한다.

> **v1.1 범위 조정** — Supabase 프로젝트 생성, 마이그레이션 체계, 라우트 그룹·레이아웃 골격은 Sprint 0으로 이동했다. 본 스프린트는 **인증과 데이터 모델에 집중**한다.

### 구현할 기능

- 조직 · 사용자 · 소속 모델 구축 (1:1 전속 제약 포함)
- 이메일 기반 로그인 / 로그아웃 / 비밀번호 재설정
- JWT에 `org_id` · `org_type` · `role` 주입
- 권한 가드 (잘못된 섹터 접근 차단) — Sprint 0의 레이아웃 골격에 권한 로직을 얹는다
- RLS 기본 정책, 감사 로그 골격
- 환자 테이블 (암호화 · 마스킹 컬럼 포함)

### 필요한 화면

| 경로 | 화면 |
|---|---|
| `/login` | 로그인 (아이디 기억 · 상태 유지 · 회원가입 진입) |
| `/signup` | 회원가입 — 계정 유형 · 사업자 정보 · 약관 |
| `/signup/done` | 가입 완료 · 승인 대기 안내 |
| `/reset-password` | 비밀번호 재설정 요청 · 완료 |
| `403` / `404` | 권한 없음 · 없는 페이지 (F-1 확정본 반영) |

섹터별 홈 화면 골격은 Sprint 0에서 만들어 둔 것을 사용한다.

### 필요한 API

| 메서드 | 경로 |
|---|---|
| POST | `/api/v1/auth/login` |
| POST | `/api/v1/auth/logout` |
| POST | `/api/v1/auth/password/reset` |
| POST | `/api/v1/auth/signup` (조직 가입 신청) |
| POST | `/api/v1/auth/verify-email` |
| GET | `/api/v1/me` |
| GET | `/api/v1/orgs/:orgId` |

### 필요한 DB

`organizations`, `user_profiles`, `memberships`, `partnerships`, `org_settings`, `patients`, `audit_logs`, `plans`

**핵심 제약**
- `memberships` — `UNIQUE(user_id) WHERE is_active` (단일 소속)
- `partnerships` — `UNIQUE(from_org_id, relation) WHERE status='active'` (1:1 전속)
- `patients` — `UNIQUE(clinic_org_id, chart_no)`, 실명 암호화

### 완료 기준

- [ ] 치과 · 디자인센터 · 기공소 계정으로 각각 로그인해 서로 다른 사이드바를 본다
- [ ] 치과 계정으로 `/design/home`에 접근하면 403을 받는다
- [ ] 한 사용자를 두 조직에 넣으려 하면 DB 제약으로 실패한다
- [ ] 한 치과에 두 번째 디자인센터를 연결하려 하면 실패한다
- [ ] 로그인 · 로그아웃 · 비밀번호 재설정이 동작한다
- [ ] 회원가입 신청 시 `organizations.status='pending'` 으로 생성된다
- [ ] 승인 전 계정으로 로그인하면 승인 대기 안내가 표시된다
- [ ] 미로그인 상태로 내부 페이지 접근 시 로그인 화면으로 이동한다
- [ ] 로그인했으나 권한 없는 자원 접근 시 404가 반환된다
- [ ] 환자 실명이 암호화되어 저장되고, 마스킹 값이 함께 생성된다
- [ ] 스테이징에 마이그레이션을 올렸다 되돌리는 데 성공한다

### 미정 항목 영향

없음. F-1~F-4 모두 확정되었다 (Sprint 0 문서 §13).

---

## Sprint 2 — 도메인 코어와 치식 UI

**기간** 2주
**목표** DS Flow의 핵심 자산인 치식·보철 규칙을 순수 함수로 완성하고 테스트로 고정한다.

> **이 스프린트를 압축하지 않는다.** 여기서 만든 규칙이 이후 모든 화면의 기반이 된다.

### 구현할 기능

**도메인 함수 (`server/domain/`)**

| 모듈 | 규칙 |
|---|---|
| tooth | FDI 번호 유효성, 치종 판정(대구치·지치·소구치·견치·중절치·측절치), 사분악 판정, 인접 여부 |
| prosthesis | 종류-재료 종속 검증, 약칭 생성 (`Zir-Cr`, `Hy-In`, 임플란트는 재료 표기 그대로) |
| bridge | 자동 연결 판정(인접 + 같은 종류 + 같은 재료 + 크라운/임플란트), 폰틱 무조건 연결, 연결 해제·재연결, 빈 치아 건너뛰기 금지 |
| duplicate | 한 치아 중복 등록 허용 조합 3종 검증, 그 외 덮어쓰기 |
| shade | 이분할 로직 (첫 클릭 전체 적용, 이후 부위 지정) |
| order-status | 상태 전이 가능 여부 판정 |

**도메인 UI 컴포넌트 (`components/dental/`)**

| 컴포넌트 | 기능 |
|---|---|
| ToothChart | 상악 18~28 / 하악 48~38, 치종별 외곽선, 우측 기준 좌우 반전, 선택 색상, 브릿지 박스와 −/+ 버튼, 폰틱 X 표기, 중복 등록 2 배지 |
| ShadePicker | 체계 선택, 색조 그리드, 이분할 미리보기, 마지막 클릭 하나만 활성 |
| ImplantPicker | 제조사 → 타입 → 사이즈·스크류·옵션 계단식, 상위 변경 시 하위 초기화 |
| ProsthesisSummary | 요약 카드 (`Zir-Cr | 42, X, 31 (A3)`), 브릿지 묶음 표시, 항목 삭제 |

### 필요한 화면

| 경로 | 화면 |
|---|---|
| `(dev)/playground/tooth-chart` | 컴포넌트 시연 페이지 (내부용, 운영 배포 제외) |

실제 업무 화면은 없다. 이 스프린트는 부품을 만든다.

### 필요한 API

| 메서드 | 경로 | 용도 |
|---|---|---|
| GET | `/api/v1/masters/prosthesis-types` | 종류 + 하위 재료 |
| GET | `/api/v1/masters/shade-systems` | 체계 + 색조 |
| GET | `/api/v1/masters/duplicate-rules` | 중복 허용 조합 |
| GET | `/api/v1/masters/production-options` | 훅 · 폰틱타입 |

### 필요한 DB

`prosthesis_types`, `materials`, `material_duplicate_rules`, `shade_systems`, `shades`, `production_option_groups`, `production_option_values`

**시드 데이터**
- 종류 3종 (크라운 · 인레이 · 임플란트) 및 각 재료
- 중복 허용 조합 3행
- Vita classic 색조 20종 (다른 체계는 Q-10 확정 후)
- 훅 2값, 폰틱타입 5값

### 완료 기준

- [ ] 도메인 함수 단위 테스트가 아래 경계 케이스를 모두 통과한다
  - 정중선(11–21, 41–31) 인접 판정
  - 재료가 다른 인접 치아는 연결되지 않음
  - 인레이는 연결되지 않음
  - 폰틱 연결은 해제 불가
  - 사이가 빈 치아는 건너뛰어 연결되지 않음
  - 허용 조합 3종만 중복 등록, 나머지는 덮어쓰기
  - 이미 2개인 치아에 세 번째는 덮어쓰기
- [ ] 치식도에서 16·17 선택 시 자동으로 묶이고 − 버튼으로 끊긴다
- [ ] 폰틱 토글 후 선택한 치아가 X로 표시된다
- [ ] 쉐이드 첫 클릭은 전체, 이후 클릭은 부위 지정으로 동작한다
- [ ] 임플란트 피커에서 Osstem → TS 선택 시 사이즈 Mini/Regular, 스크류 Hex/Non-Hex만 나타난다

### 미정 항목 영향

없음. 색조 3체계 70개 코드가 확정되었다 (설계서 §4.4).

---

## Sprint 3 — 주문 등록과 파일 업로드

**기간** 2주
**목표** 치과가 실제 STL 파일을 올려 주문을 등록한다.

### 구현할 기능

- 주문등록 화면 (PRD 4.2 전체)
  - 환자정보 (치과명 자동 입력 · 수정 불가)
  - 보철선택 → 재료 → 쉐이드 → 치식 순서 강제
  - 상위 미선택 시 안내 또는 해당 선택창 자동 열기
  - 제작옵션 및 즐겨찾기
  - 초기화 (선택 시 강조, 확인창)
- presigned URL 기반 대용량 파일 업로드
- 업로드 진행률 · 실패 재시도 · 개별 삭제
- 주문번호 채번 (`ORD-YYMMDD-###`)
- 등록 시 단가 스냅샷 (단가표 미정 시 0으로 기록)
- **리메이크 계보 컬럼 반영** — `parent_order_id` · `root_order_id` · `remake_seq`
  (설계서 §4.5.2. 원주문은 그대로 두고 복제본에 태그를 다는 구조)

### 필요한 화면

| 경로 | 화면 |
|---|---|
| `(clinic)/orders/new` | 주문등록 |
| — | 쉐이드 선택 모달, 임플란트 모델 등록 모달, 초기화 확인 모달 |

### 필요한 API

| 메서드 | 경로 | 용도 |
|---|---|---|
| POST | `/api/v1/orders` | 주문 등록 (치식 · 옵션 · 파일 메타 포함) |
| POST | `/api/v1/orders/:id/files/presign` | 업로드 URL 발급 |
| POST | `/api/v1/orders/:id/files` | 업로드 완료 등록 |
| DELETE | `/api/v1/files/:fileId` | 파일 삭제 |
| GET | `/api/v1/orgs/:orgId/implant-favorites` | 즐겨찾기 조회 |
| POST | `/api/v1/orgs/:orgId/implant-favorites` | 즐겨찾기 등록 |
| GET | `/api/v1/masters/*` | Sprint 2 것 재사용 |

### 필요한 DB

`orders`, `order_items`, `order_item_bridges`, `order_item_bridge_members`, `order_options`, `order_files`, `clinic_implant_favorites`, `option_presets`

**주의**
- `orders` — `root_order_id`, `remake_seq` 추가. 인덱스 `(root_order_id, remake_seq)`
- `order_items` — `UNIQUE(order_id, tooth_number, slot)`, `slot` 은 1 또는 2
- `order_files` — Supabase Storage 버킷 정책과 함께 설정
- 임플란트 마스터는 Sprint 6 전이므로 **시드 데이터로 채워 사용**한다

### 완료 기준

- [ ] 30MB STL 파일이 서버를 거치지 않고 업로드된다
- [ ] 업로드 중 새로고침해도 이미 올라간 파일은 유지된다
- [ ] 치식 · 재료 · 쉐이드 없이 주문완료를 누르면 각 단계 안내가 뜬다
- [ ] 크라운 지르코니아로 16·17을 등록하면 브릿지 묶음이 DB에 저장된다
- [ ] 한 치아에 크라운 지르코니아 + PMMA를 넣으면 `order_items` 2행이 `slot` 1·2로 저장된다
- [ ] 폰틱이 `is_pontic=true`로 저장되고 인접 지대치와 같은 브릿지에 묶인다
- [ ] 등록 직후 목록 API가 해당 주문을 `received` 상태로 반환한다
- [ ] 다른 치과 계정으로 조회하면 해당 주문이 보이지 않는다
- [ ] 리메이크를 두 번 이어서 하면 `remake_seq` 가 1 → 2 로 올라간다
- [ ] 세 주문 모두 같은 `root_order_id` 를 가리킨다
- [ ] `root_order_id` 하나로 케이스 전체 이력이 회차 순으로 조회된다

### 미정 항목 영향

Q-1 (단가표) — 미확정이므로 `unit_price`는 0으로 기록하고 Sprint 8에서 소급 계산 경로를 둔다.

---

## Sprint 4 — 주문 목록과 상세

**기간** 2주
**목표** 등록한 주문을 찾고 열어보고 고칠 수 있다.

### 구현할 기능

- 주문목록 (필터 · 정렬 · 페이지네이션)
  - 기간 필터 (3개월 / 6개월 / 1년 / 전체)
  - 상태 필터 (섹터별 색상), 이슈 필터
  - 치과명 · 환자명 검색
  - 컬럼 정렬, 페이지당 10건
- 주문상세 (읽기)
  - 읽기 전용 치식도, 제작보철 요약, 제작옵션, 요청사항
  - 스캔 파일 목록 · 다운로드
  - 메모 (200자, 작성자 · 시각 기록)
- 주문 수정 · 삭제 (접수 상태 제한)
- 섹터별 민감 필드 차단 (기공소명 · 기공수가 · 담당 디자이너 · 환자 실명 마스킹)

### 필요한 화면

| 경로 | 화면 |
|---|---|
| `(clinic)/orders` | 주문목록 |
| `(clinic)/orders/[orderId]` | 주문상세 (메모 패널 포함) |
| — | 삭제 확인 모달 |

### 필요한 API

| 메서드 | 경로 |
|---|---|
| GET | `/api/v1/orders` (필터 · 정렬 · 페이지) |
| GET | `/api/v1/orders/summary` |
| GET | `/api/v1/orders/:id` |
| PATCH | `/api/v1/orders/:id` |
| DELETE | `/api/v1/orders/:id` |
| GET | `/api/v1/orders/:id/files` |
| GET | `/api/v1/files/:fileId/download` |
| GET/POST | `/api/v1/orders/:id/memos` |

### 필요한 DB

`order_memos` 신규. 나머지는 Sprint 3 테이블 재사용.

**인덱스 검증** — `(clinic_org_id, created_at DESC)`, `(status)`, `(due_date)` 실행 계획 확인

### 완료 기준

- [ ] 1,000건 이상 주문에서 목록 조회가 300ms 이내
- [ ] 상태 · 이슈 · 기간 · 검색어 필터가 조합되어 동작한다
- [ ] 응답 JSON에 기공소명 · 기공수가 필드가 **아예 담기지 않는다** (치과 계정)
- [ ] 접수 상태 주문은 수정되고, 다른 상태에서는 API가 거부한다
- [ ] 주문 수정 시 새 주문이 생기지 않고 기존 주문이 갱신된다
- [ ] 파일 다운로드가 감사 로그에 기록된다
- [ ] presigned 다운로드 URL이 5분 후 만료된다

### 미정 항목 영향

C-4 (재스캔 상태의 수정 범위) — **본 스프린트 착수 전 확정 필요.** 미확정 시 접수 상태에서만 수정 허용으로 구현하고 재스캔은 다음 스프린트로 미룬다.
Q-11 (치과의 디자인 파일 열람 허용 여부) — 미확정 시 기본 차단.

---

## Sprint 5 — 상태 흐름과 디자인센터

**기간** 2주
**목표** 주문 하나가 치과 ↔ 디자인센터를 왕복한다.

### 구현할 기능

- 상태 머신 단일 진입점 (`changeOrderStatus`)
  - 전이 규칙 검증, 이력 기록, 이벤트 발행
- 정의된 전이 9종 구현 (Architecture §4.5.1)
- **되돌리기는 디자인센터 → 치과 경로만** (기공소 역방향 전이 없음)
- 재스캔 요청 · 수정 요청 (사유 입력 필수)
- 디자인센터 주문목록 · 상세
- 디자인 파일 업로드 (리비전 관리)
- 디자인센터 HOME — 진행중 상태, 작업 리스트
- 디자이너 배정

### 필요한 화면

| 경로 | 화면 |
|---|---|
| `(design)/home` | 진행중 상태 · 작업 리스트 |
| `(design)/orders` | 주문목록 (담당 치과 전체) |
| `(design)/orders/[orderId]` | 주문상세 + 디자인 파일 업로드 · 상태 액션 |
| `(clinic)/orders/[orderId]` | 재스캔 요청 수신 표시 · 재업로드 |

### 필요한 API

| 메서드 | 경로 | 용도 |
|---|---|---|
| POST | `/api/v1/orders/:id/status` | 상태 전이 단일 진입점 |
| POST | `/api/v1/orders/:id/assign` | 디자이너 배정 |
| GET | `/api/v1/orders/:id/history` | 상태 이력 |
| GET/POST | `/api/v1/orders/:id/issues` | 이슈 |
| GET | `/api/v1/orders/worklist` | 작업 리스트 |
| GET | `/api/v1/orders/summary?scope=design` | 디자인센터 카운트 |

### 필요한 DB

`order_status_transitions` (규칙 데이터), `order_status_history`, `order_issues`, `domain_events`
`order_files.revision` 활용

**시드** — 전이 규칙 9행 (design_confirm 관련 행은 넣지 않는다)

### 완료 기준

- [ ] 치과 등록 → 디자인센터 디자인 시작 → 디자인 파일 업로드 → 제작대기 전달이 이어진다
- [ ] 디자인센터가 재스캔을 요청하면 상태가 `rescan`이 되고 이슈가 기록된다
- [ ] 치과가 스캔을 재업로드하면 `received`로 돌아온다
- [ ] 기공소 계정으로 역방향 전이를 시도하면 API가 거부한다
- [ ] 정의되지 않은 전이(예: `received` → `shipping`)를 시도하면 거부한다
- [ ] 디자인 파일을 다시 올리면 `revision`이 2로 증가하고 이전 버전이 남는다
- [ ] 모든 상태 변경이 `order_status_history`와 `domain_events`에 기록된다
- [ ] 디자인센터는 담당 치과 주문만 보이고 다른 치과 주문은 보이지 않는다

### 미정 항목 영향

C-4 확정본 반영. 미확정 시 재스캔 상태에서는 파일 교체만 허용.

---

## Sprint 6 — 임플란트 마스터와 배포

**기간** 2주
**목표** 디자인센터가 임플란트 정보를 관리하고 치과에 내려보낸다.

### 구현할 기능

- 임플란트 마스터 5단계 CRUD (제조사 → 타입 → 사이즈 · 스크류 · 옵션)
  - 이름 + 코드 관리, 수정 · 삭제
  - 종속 관계 강제 (상위 미선택 시 하위 추가 불가)
  - 상위 삭제 시 하위 처리 (사용 중이면 비활성 처리)
- 치과 즐겨찾기 조회 · 강제 배포 · 회수
- 출처 구분 (치과 등록 / 디자인센터 배포)
- 치과 주문등록에서 마스터 실시간 반영

### 필요한 화면

| 경로 | 화면 |
|---|---|
| `(design)/implants/master` | 5열 마스터 관리 |
| `(design)/implants/distribution` | 치과 목록 + 즐겨찾기 + 배포 |
| — | 항목 추가/수정 모달, 배포용 모델 선택 모달 |

### 필요한 API

| 메서드 | 경로 |
|---|---|
| GET | `/api/v1/implants/catalog` |
| POST/PATCH/DELETE | `/api/v1/implants/makers[/:id]` |
| POST/PATCH/DELETE | `/api/v1/implants/types[/:id]` |
| POST/PATCH/DELETE | `/api/v1/implants/sizes[/:id]` |
| POST/PATCH/DELETE | `/api/v1/implants/screws[/:id]` |
| POST/PATCH/DELETE | `/api/v1/implants/options[/:id]` |
| GET/POST/DELETE | `/api/v1/orgs/:orgId/implant-favorites[/:id]` |

### 필요한 DB

`implant_makers`, `implant_types`, `implant_sizes`, `implant_screws`, `implant_options`, `clinic_implant_favorites`

**제약** — 각 자식 테이블 `UNIQUE(부모_id, name)`
**정책** — 주문에서 참조 중인 항목은 물리 삭제 금지, `is_active=false`

### 완료 기준

- [ ] 디자인센터에서 제조사를 추가하면 치과 주문등록 모달에 즉시 나타난다
- [ ] Osstem → TS 선택 시 사이즈 Mini/Regular, 스크류 Hex/Non-Hex만 활성화된다
- [ ] 제조사 삭제 시 하위 타입이 함께 처리되고 확인창에서 고지된다
- [ ] 주문에 사용된 타입은 삭제되지 않고 비활성 처리된다
- [ ] 디자인센터가 배포한 모델이 치과 즐겨찾기에 `design_push` 출처로 나타난다
- [ ] 치과 계정으로 마스터 편집 API를 호출하면 403을 받는다
- [ ] 즐겨찾기가 비어 있는 상태에서 임플란트 치아를 누르면 등록 창이 열린다

### 미정 항목 영향

임플란트 옵션 열의 실제 값 — 미확정 시 빈 목록 허용.

---

## Sprint 7 — 기공소 계정과 배송

**기간** 2주
**목표** 주문 하나가 3섹터를 관통해 치과로 돌아온다.

### 구현할 기능

- 기공소 계정 신설 (레이아웃 · 권한 · 배정 케이스 목록)
- 기공소 배정 (디자인센터가 수행)
- 제작 시작 · 출고 처리
- 배송조회 주간 보드 (월~토, 요청시한 기준)
  - 치과: 자기 주문만 / 디자인센터 · 기공소: 담당 전체
- 출고 등록, 송장 정보
- 수거요청
- 치과 수령 확인 → 완료
- **리메이크 신청** — 배송 · 완료 상태에서만 활성. 원주문 복사 → 리메이크 태그 → `received` 진입
  - 이전 스캔 재사용 체크박스 + 신규 업로드 병행, 둘 다 비면 차단
- **리페어 신청** — 배송 · 완료 상태에서만 활성. `production_wait`로 바로 진입, 원주문 기공소 자동 배정 + 알림

### 필요한 화면

| 경로 | 화면 |
|---|---|
| `(lab)/home` | 배정 케이스 현황 |
| `(lab)/orders` | 배정 케이스 목록 |
| `(lab)/orders/[orderId]` | 상세 + 디자인 파일 다운로드 + 제작·출고 |
| `(lab)/shipments` | 출고 관리 |
| `(clinic)/deliveries` | 배송조회 (자기 주문) |
| `(design)/deliveries` | 배송조회 (담당 치과 전체) |

### 필요한 API

| 메서드 | 경로 |
|---|---|
| GET | `/api/v1/orders?scope=lab` |
| POST | `/api/v1/orders/:id/assign` (기공소 배정) |
| POST | `/api/v1/orders/:id/status` (제작 · 출고 · 완료) |
| POST | `/api/v1/orders/:id/remake` |
| POST | `/api/v1/orders/:id/repair` |
| GET/POST | `/api/v1/deliveries` |
| PATCH | `/api/v1/deliveries/:id` |
| GET/POST | `/api/v1/pickup-requests` |

### 필요한 DB

`deliveries`, `delivery_items`, `pickup_requests`

**인덱스** — `deliveries(clinic_org_id, scheduled_date)`, `(lab_org_id, scheduled_date)`

### 완료 기준

- [ ] 치과 등록 → 디자인 → 기공소 제작 → 출고 → 치과 수령 확인까지 한 케이스가 완주한다
- [ ] 기공소는 자신에게 배정된 주문만 보고, 다른 기공소 주문은 보이지 않는다
- [ ] 기공소 응답에서 환자 이름이 마스킹 값으로 나온다
- [ ] 배송조회 주간 보드에서 오늘 열이 강조되고 주 이동이 동작한다
- [ ] 치과 배송조회에는 기공소명이 나타나지 않는다
- [ ] 디자인센터 배송조회에는 담당 치과 전체가 나타난다
- [ ] 배송 · 완료 상태에서만 리메이크 버튼이 활성화된다
- [ ] 리메이크 신청 시 원주문은 그대로 남고 신규 주문이 `received`로 생성된다
- [ ] 리메이크 주문에 `is_remake=true`, `is_billable=false`가 기록된다
- [ ] 리메이크 주문이 이후 일반 주문과 동일한 흐름을 탄다
- [ ] 스캔 재사용 체크박스도 끄고 파일도 안 올리면 리메이크 신청이 막힌다
- [ ] 재사용 체크 시 원주문 스캔 파일이 새 주문에서 조회된다 (Storage 중복 저장 없음)
- [ ] 리페어 신청 시 상태가 `제작대기`로 생성되고 디자인센터를 거치지 않는다
- [ ] 리페어 주문이 원주문의 기공소에 배정되고 해당 기공소에 알림이 간다

### 미정 항목 영향

모두 확정되었다 (설계서 §2.2).
- 기공소 배정은 **제작대기 진입 시점**, 자동 배정 없음
- 수거요청은 **치과 요청 → 기공소 처리**, 대상은 모델·인상체
- 리페어는 **배송 · 완료** 상태에서만 신청
- 택배사 연동은 범위 밖 (송장 컬럼만 준비)

---

## Sprint 8 — 정산

**기간** 2주
**목표** 주문 데이터에서 금액이 자동으로 계산되고 청구서가 나온다.

### 구현할 기능

- **단가표 관리 (디자인센터 전용)** — 치과별 · 보철물 종류별 · 치식별 금액, 기간 버전 관리
- 주문 등록 시 단가 스냅샷 (Sprint 3 소급 반영)
- 이용내역 자동 계산 (보철 세부내역 · 조정 내역)
- CSV 내려받기
- 청구서 생성 배치 (정산 기준일 1일 / 26일)
- 청구서 목록 · 상세 · PDF
- 조정 금액 등록
- 입금 관리
- 직원 권한 이용 금액 블라인드 (서버 응답에서 제외)

### 필요한 화면

| 경로 | 화면 |
|---|---|
| `(clinic)/billing` | 이용내역 · 청구서 탭 |
| `(design)/billing` | 담당 치과 정산 현황 |
| `(lab)/billing` | 기공수가 현황 |
| `(design)/price-lists` | 단가표 관리 (디자인센터가 설정) |

### 필요한 API

| 메서드 | 경로 |
|---|---|
| GET | `/api/v1/billing/usage` |
| GET | `/api/v1/billing/usage/export` |
| GET/POST | `/api/v1/billing/adjustments` |
| GET | `/api/v1/invoices`, `/invoices/:id` |
| GET | `/api/v1/invoices/:id/pdf` |
| GET/POST/PATCH | `/api/v1/price-lists[/:id]` |

### 필요한 DB

`price_lists`, `price_items`, `invoices`, `invoice_lines`, `adjustments`, `payments`

**배치** — Supabase Edge Function 또는 스케줄러로 월 1회 청구서 생성

### 완료 기준

- [ ] 단가표를 등록하면 신규 주문의 `unit_price`가 자동으로 채워진다
- [ ] 단가를 변경해도 기존 주문의 금액이 바뀌지 않는다 (스냅샷 검증)
- [ ] 이용내역 합계와 청구서 금액의 차이가 설명 가능하다 (완료 주문만 청구)
- [ ] CSV가 한글 깨짐 없이 열린다
- [ ] 직원 권한 계정의 이용내역 API 응답에 금액 필드가 없다
- [ ] 정산 기준일 설정(1일/26일)에 따라 청구 기간이 달라진다
- [ ] 치과별로 다른 단가표가 적용되고, 전용 단가표가 없으면 기본 단가표를 쓴다
- [ ] 같은 보철물이라도 전치 · 구치에 따라 다른 금액이 적용된다
- [ ] **리페어 주문도 청구서에 포함되지 않는다**
- [ ] **리메이크 주문은 이용내역에 금액 0으로 표시되고 청구서에 포함되지 않는다**
- [ ] 치과 계정으로 단가표 API를 호출하면 403을 받는다

### 미정 항목 영향

- 단가표 치식 구분은 **전치 / 구치**로 확정. 화면 시안은 대기 중이나 구조는 확정되어 착수 가능
- Q-6 확정 — 디자인센터가 치과에 청구하고 기공소에 지급한다. 자사 기공을 함께 운영해 지출을 줄이는 구조를 반영한다.

---

## Sprint 9 — 운영 기능과 안정화

**기간** 2주
**목표** 시범 운영을 시작할 수 있는 상태로 만든다.

### 구현할 기능

- 사용자 관리 (초대 · 권한 변경 · 삭제)
- 계정 설정 4탭 (계정 정보 · 결제 관리 · 알림 설정 · 비밀번호 변경)
- 게시판 (공지사항 · FAQ · Q&A)
- 알림 발송 (이벤트 구독 → 채널별 발송)
- 플랫폼 관리자 콘솔 (조직 승인 · 마스터 감독 · 감사 로그 조회)
- E2E 시나리오 자동화
- 부하 테스트 (대용량 파일 · 동시 주문)
- 감사 로그 파티셔닝 · 보존 정책
- 개인정보 처리방침 · 보안 점검

### 필요한 화면

| 경로 | 화면 |
|---|---|
| `(clinic|design|lab)/members` | 사용자 관리 |
| `(clinic|design|lab)/settings` | 계정 설정 4탭 |
| `(clinic|design|lab)/board` | 게시판 3탭 |
| `(admin)/organizations` | 조직 승인 · 관리 |
| `(admin)/audit` | 감사 로그 조회 |

### 필요한 API

| 메서드 | 경로 |
|---|---|
| GET/POST/PATCH/DELETE | `/api/v1/orgs/:orgId/members[/:id]` |
| PATCH | `/api/v1/orgs/:orgId`, `/orgs/:orgId/settings` |
| PATCH | `/api/v1/auth/password` |
| GET | `/api/v1/notices`, `/faqs`, `/qna` |
| POST | `/api/v1/qna`, `/qna/:id/messages` |
| GET/PATCH | `/api/v1/notifications[/:id/read]` |

### 필요한 DB

`notices`, `faqs`, `qna_threads`, `qna_messages`, `notifications`, `notification_settings`
`audit_logs` 월 단위 파티셔닝 전환

### 완료 기준

- [ ] 3섹터 왕복 E2E 시나리오가 자동으로 통과한다
- [ ] 50MB 파일 동시 업로드 10건에서 오류가 없다
- [ ] 직원 계정 초대 → 가입 → 권한 적용이 동작한다
- [ ] 상태 변경 시 설정된 채널로 알림이 발송된다
- [ ] 알림 수신여부를 끄면 하위 채널이 모두 비활성화된다
- [ ] 관리자가 조직을 승인해야 로그인이 가능하다
- [ ] 감사 로그에서 특정 주문의 열람 이력을 추적할 수 있다
- [ ] 개인정보 처리방침이 게시되고 동의 절차가 있다

### 미정 항목 영향

Q-7 (알림 트리거) — **착수 전 확정 필요.** 미확정 시 상태 변경 알림만 구현.

---

## 부록 A. 스프린트별 선행 조건

| 스프린트 | 착수 전 확정 필요 | 미확정 시 |
|---|---|---|
| Sprint 0 | 없음 (F-1~F-4 확정 완료) | — |
| Sprint 1 | 없음 | — |
| Sprint 2 | 없음 (Q-10 색조 목록 확정) | — |
| Sprint 3 | 없음 | 단가 0으로 기록 |
| Sprint 4 | **C-4 재스캔 수정 범위**, Q-11 디자인 파일 열람 | 접수 상태만 수정 허용, 열람 차단 |
| Sprint 5 | C-4 확정본 | 파일 교체만 허용 |
| Sprint 6 | 임플란트 옵션 값 | 빈 목록 허용 |
| Sprint 7 | 없음 (Q-2·Q-4·Q-15 확정, Q-5는 보류) | 택배 연동은 범위 밖 |
| Sprint 8 | 없음 (Q-6 확정) | — |
| Sprint 9 | 없음 (Q-7 확정) | 카카오 알림톡 3종 |

## 부록 B. 릴리스 계획

| 시점 | 릴리스 | 내용 |
|---|---|---|
| Sprint 0 종료 | 골격 배포 | 빈 화면 3섹터. 배포 파이프라인 검증 |
| Sprint 4 종료 | 내부 알파 | 치과 단독 사용 가능 (등록 · 조회) |
| Sprint 5 종료 | 내부 베타 | 치과 ↔ 디자인센터 왕복 |
| Sprint 7 종료 | **클로즈드 베타** | 3섹터 전 구간. 시범 치과 1곳 |
| Sprint 9 종료 | **정식 오픈** | 시범 치과 2~3곳 확대 |

## 부록 C. 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| 도메인 규칙이 실제 업무와 다름 | 재작업 | Sprint 2 종료 시 치과 실무자 검토 |
| 대용량 파일 업로드 실패율 | 사용 포기 | Sprint 3에서 재시도 · 청크 업로드 검토 |
| 단가표 확정 지연 | Sprint 8 지연 | Sprint 6 시점에 확정 요청 |
| 개인정보 규제 해석 | 오픈 지연 | Sprint 5 시점에 전문가 자문 착수 |
| 1:1 전속 전제가 깨짐 | 스키마 영향 | 유일 인덱스만 해제하면 되도록 설계 완료 |
