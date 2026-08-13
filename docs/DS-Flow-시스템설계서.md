# Den Flow 시스템 설계서

**문서 버전** v0.7 · 2026-08-06
**상위 문서** Den Flow 기능 명세서 v0.4 (PRD)
**적용 범위** 본 설계서는 PRD를 구현 기준으로 옮긴 문서다. PRD와 충돌하는 내용은 임의로 결정하지 않고 §2에 질문으로 남겼다.

---

## 목차

1. 명세서 분석 결과
2. 확인이 필요한 충돌 · 미정 사항
3. ERP/SaaS 관점 개선 제안
4. 데이터베이스 설계
5. 시스템 아키텍처
6. 폴더 구조
7. REST API 설계
8. 권한 및 인증 구조
9. 화면 ↔ API ↔ 테이블 매핑
10. 스프린트 계획

---

## 1. 명세서 분석 결과

### 1.1 PRD의 강점

- 세 섹터의 역할과 정보 차단 경계가 명확하다. 특히 `PORTAL.showLab` 같은 노출 제어 개념이 이미 잡혀 있어 권한 설계로 옮기기 쉽다.
- 치식·보철 도메인 규칙(종속 관계, 브릿지 연결, 폰틱, 중복 등록 허용 조합, 쉐이드 이분할)이 구체적이다. 이 부분이 시스템의 핵심 자산이며, 데이터 모델도 여기에 맞춰 설계했다.
- 상태 전이와 되돌리기 경로가 정의되어 있어 워크플로 엔진 없이 상태 머신으로 구현 가능하다.

### 1.2 구조적으로 보강이 필요한 영역

| 영역 | 내용 |
|---|---|
| **조직 간 관계** | **1:1 전속으로 확정.** 한 치과는 하나의 디자인센터와만 거래하고, 사용자는 하나의 조직에만 속한다. §4에서 `partnerships`로 설계하되 유일성 제약을 걸어 1:1을 강제한다. 다대다는 보류. |
| **가격 체계** | 기공수가 단가표가 없어 정산이 계산되지 않는다. §4에 `price_lists` 구조를 제안했으나 실제 값은 확정 필요. |
| **파일 버전** | 디자인 STL 수정 요청 시 이전 버전 추적이 필요하다. `order_files.revision`으로 설계했다. |
| **감사 로그** | 의료 관련 데이터를 다루므로 누가 언제 무엇을 열람·변경했는지 기록이 필요하다. |
| **알림 발송** | 알림 설정 UI는 있으나 어떤 이벤트에 발송하는지 정의가 없다. |
| **배송 실체** | 배송조회 화면은 요청시한 기준 달력일 뿐, 실제 송장·수거요청 처리 정의가 없다. |
| **환자 정보** | 현재 주문에 환자명이 직접 들어간다. 개인정보 최소화를 위해 분리 저장을 권한다. |

---

## 2. 확인이 필요한 충돌 · 미정 사항

> **규칙에 따라 임의 결정하지 않았다.** 아래 항목은 답을 주시면 설계에 반영한다. 현재는 각 항목의 "잠정 처리"대로 두되, 확정 전까지 구현하지 않는다.

### 2.1 논리적 충돌

| # | 충돌 내용 | 잠정 처리 |
|---|---|---|
| C-1 | ~~상태 목록 불일치~~ | **확정 (v0.2)** — `디자인 컨펌`은 **모든 화면에서 숨김**. 향후 업데이트 예정 기능이므로 enum에는 예약해 두되 전이 규칙·화면·카운트 어디에도 노출하지 않는다 |
| C-2 | **재스캔이 상태이자 이슈다.** 7.1에 상태 `재스캔`, 4.3에 이슈 `재스캔`이 동시에 존재한다. | 상태 = 현재 위치, 이슈 = 누적 이력 플래그로 분리. 재스캔 요청 시 상태 변경 + 이슈 기록 동시 발생 |
| C-7 | **되돌리기 주체 정정 (v0.2).** 초판에는 `디자인 수정 요청 : 기공소 → 디자인센터`가 있었으나, 되돌리기는 **디자인센터 → 치과** 경로만 존재한다 | 반영 완료. 기공소는 상태를 전진시킬 수만 있다. `order_status_transitions`에 기공소의 역방향 전이를 정의하지 않는다 |
| C-3 | ~~리메이크·리페어가 주문유형이자 이슈다~~ | **확정 (v0.3)** — 리메이크는 주문유형이 아니라 **태그**다. 치과가 배송·완료 상태에서 신청하면 원주문을 `parent_order_id`로 참조하는 **신규 주문**이 `received` 상태로 생성되고 `is_remake=true`가 붙는다. 이후 흐름은 일반 주문과 동일하며 **청구에서 제외**한다. 리페어는 별도 확인 필요 |
| C-4 | **수정 가능 시점.** "접수 및 재스캔 상태에서만 수정 가능"인데, 재스캔은 치과가 파일을 다시 올리는 상태다. 이때 보철 사양까지 바꿀 수 있는지 불명확 | 재스캔 상태에서는 **파일 교체만 허용**, 보철 사양 변경은 접수 상태에서만 허용하는 안을 제안 |
| C-5 | **폰틱 연결 해제 불가 규칙.** 폰틱은 인접치와 무조건 묶이는데, 지대치를 삭제하면 폰틱이 고아가 된다 | 지대치 삭제 시 연결된 폰틱도 함께 삭제하거나 경고. 어느 쪽인지 확인 필요 |
| C-6 | **한 치아 중복 등록과 브릿지의 관계.** 크라운 지르코니아 + PMMA가 한 치아에 있을 때, 브릿지 연결은 어느 쪽을 기준으로 하는가 | 첫 번째(주) 보철 기준으로 연결 판정. 확인 필요 |

### 2.2 미정 사항 (PRD 부록 A 포함)

| # | 항목 | 필요한 답 |
|---|---|---|
| Q-1 | 기공수가 단가표 | **부분 확정 (v0.3)** — 설정 주체는 **디자인센터**, 치과별로 다른 금액 적용, 구분 기준은 **보철물 종류 · 치식**. 치식 단위 구분 방식(개별 번호 / 전치·구치 등)은 화면 시안 대기 |
| ~~Q-2~~ | ~~기공소 배정 시점~~ | **확정 (v0.6)** — **제작대기 진입 시점**에 배정한다. 자동 배정 규칙은 두지 않고 디자인센터가 지정한다 |
| ~~Q-3~~ | ~~임시치아 워크플로~~ | **기능 삭제 (v0.3)** — 진행중 임시치아 카드 및 관련 상태 제거 |
| ~~Q-4~~ | ~~수거요청~~ | **확정 (v0.6)** — **치과가 요청하고 기공소가 처리**한다. 대상은 모델·인상체 |
| Q-5 | 배송 실체 | **보류 (v0.6)** — 택배사 연동은 추후 개발. 현재 우선순위 매우 낮음. 송장 컬럼만 두고 비워둔다 |
| ~~Q-6~~ | ~~청구 주체~~ | **확정 (v0.7)** — 디자인센터가 **치과에 청구하고 기공소에 지급**한다. 자사 기공(내부 제작) 건은 **지급이 발생하지 않아 지급 대상에서 제외**한다. 치과 청구에는 그대로 포함된다 |
| ~~Q-7~~ | ~~알림 트리거~~ | **확정 (v0.6)** — 카카오 알림톡. ① 접수 발생 → 디자인센터 ② **재스캔 → 치과** ③ **제작대기 → 기공소**. 그 외는 인앱 알림만 |
| ~~Q-8~~ | ~~조직 관계~~ | **확정 (v0.2)** — 1:1 전속. 멀티테넌시 보류 |
| ~~Q-9~~ | ~~환자 실명~~ | **확정 (v0.2)** — 치과 소통을 위해 실명 저장. 분리 보관 · 암호화 · 기공소 마스킹 적용. 규제 요건 확정 시 재검토 |
| ~~Q-10~~ | ~~색조 목록~~ | **확정 (v0.6)** — §4.4 참조. Vita classic 20 · Vita 3D Master 26 · Ivoclar 24 |
| ~~Q-12~~ | ~~리메이크 스캔 파일~~ | **확정 (v0.4)** — 재사용 체크박스 + 신규 업로드 병행. 둘 다 비면 차단 |
| ~~Q-13~~ | ~~리페어 절차~~ | **확정 (v0.4)** — 청구 제외, `production_wait` 진입, 원주문 기공소 배정 + 알림 |
| ~~Q-14~~ | ~~단가표 치식 구분~~ | **확정 (v0.4)** — 전치 / 구치 두 갈래 |
| ~~Q-15~~ | ~~리페어 신청 가능 상태~~ | **확정 (v0.6)** — 리메이크와 동일하게 **배송 · 완료** 상태에서만 |

---

## 3. ERP/SaaS 관점 개선 제안

> 제안일 뿐 PRD 기능을 대체하지 않는다. 채택 여부는 결정해 주시면 반영한다.

### 3.1 조직(Organization) 중심 모델 — 1:1 전속

계정 유형을 세 개의 별도 시스템으로 보지 말고, **하나의 `organizations` 테이블에 `org_type`으로 구분**한다. 치과·디자인센터·기공소가 같은 구조를 공유하고 화면만 달라진다. 새 섹터(예: 밀링센터)가 생겨도 테이블 변경 없이 추가된다.

**거래 관계는 1:1 전속이다.** 치과는 하나의 디자인센터에 전속되고, 사용자는 하나의 조직에만 소속된다. 다만 관계를 컬럼이 아닌 `partnerships` 테이블로 두고 유일성 제약으로 1:1을 강제한다. 나중에 다대다가 필요해지면 **제약만 풀면 되고 스키마는 그대로**여서, 지금 단순함을 얻으면서 확장 여지를 잃지 않는다.

### 3.2 주문 아이템 정규화

현재 PRD는 주문 안에 `teeth[]` 배열을 둔다. DB에서는 **치아 하나 = 행 하나**로 정규화한다. 이렇게 하면 다음이 가능해진다.

- 치식·재료별 통계와 정산 자동 계산
- 부분 리메이크(특정 치아만 재제작)
- 단가표와의 직접 조인

### 3.3 상태 머신의 외부화

상태 전이를 코드에 박지 않고 `order_status_transitions` 테이블로 관리한다. "어느 상태에서 어느 상태로, 어느 org_type이, 어떤 조건에서" 를 데이터로 정의하면 규칙 변경 시 배포 없이 대응할 수 있다.

### 3.4 이벤트 기반 알림

상태 변경·파일 업로드 등을 `domain_events` 테이블에 기록하고, 알림 발송은 이 이벤트를 구독한다. 알림 정책이 바뀌어도 업무 로직을 건드리지 않는다.

### 3.5 소프트 삭제와 감사 로그

의료 관련 데이터는 물리 삭제하지 않는다. `deleted_at`으로 소프트 삭제하고, 모든 변경을 `audit_logs`에 남긴다. 파일도 삭제 표시만 하고 실제 객체는 보존 기간 후 정리한다.

### 3.6 개인정보 최소화

환자 실명을 저장하지 않고 **차트번호 + 치과 내부 식별자**만 다루는 안을 권한다. 실명이 반드시 필요하다면 `patients` 테이블로 분리해 접근 권한을 별도로 통제하고, 기공소에는 마스킹된 값만 노출한다.

### 3.7 가격 버전 관리

단가표는 시점에 따라 바뀐다. `price_lists`에 `effective_from / effective_to`를 두고, 주문 생성 시 **당시 단가를 주문 아이템에 스냅샷으로 복사**한다. 나중에 단가가 바뀌어도 과거 정산이 흔들리지 않는다.

### 3.8 SaaS 운영 기능

| 기능 | 필요성 |
|---|---|
| 플랜/구독 관리 | PRD 4.9에 "플랜 정보" 버튼이 이미 있음 |
| 온보딩 | 신규 치과 가입 → 디자인센터 연결 승인 |
| 관리자 콘솔 | 조직 승인, 마스터 데이터 감독, 장애 대응 |
| 사용량 지표 | 조직별 주문 수, 파일 용량, 응답 시간 |

---

## 4. 데이터베이스 설계 (PostgreSQL / Supabase)

### 4.1 설계 원칙

| 원칙 | 내용 |
|---|---|
| 식별자 | 모든 PK는 `uuid` (`gen_random_uuid()`). 사용자에게 보이는 번호는 별도 컬럼 |
| 시간 | `timestamptz`, UTC 저장. 표시 시점에 KST 변환 |
| 소프트 삭제 | `deleted_at timestamptz NULL` |
| 공통 컬럼 | `created_at`, `updated_at`, `created_by`, `updated_by` |
| 테넌트 격리 | 대부분 테이블에 `org_id` 보유, RLS로 강제 |
| 열거형 | 값이 고정된 것은 `enum` 타입, 운영 중 변경되는 것은 마스터 테이블 |

### 4.2 도메인 구분

```
① 조직 · 계정      organizations, memberships, user_profiles, partnerships
② 마스터 데이터    prosthesis_types, materials, shade_systems, shades,
                   implant_* (5단계), production_option_*
③ 주문             orders, order_items, order_item_bridges, order_files,
                   order_options, order_memos, order_status_history, order_issues
④ 배송             deliveries, delivery_items, pickup_requests
⑤ 정산             price_lists, price_items, invoices, invoice_lines,
                   adjustments, payments
⑥ 콘텐츠           notices, faqs, qna_threads, qna_messages
⑦ 시스템           notifications, notification_settings, domain_events, audit_logs
```

---

### 4.3 ① 조직 · 계정

#### organizations

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | **PK** | |
| org_type | enum | NOT NULL | `clinic` / `design_center` / `lab` |
| name | text | NOT NULL | 상호 |
| code | text | UNIQUE | 내부 코드 |
| biz_no | text | | 사업자 등록번호 |
| tel | text | | 대표 전화 |
| zip_code | text | | |
| address | text | | |
| status | enum | NOT NULL | `pending` / `active` / `suspended` |
| plan_id | uuid | FK → plans.id | |
| created_at / updated_at / deleted_at | timestamptz | | |

**Index** — `(org_type, status)`, `(name)` GIN trigram(검색용), `UNIQUE(biz_no) WHERE deleted_at IS NULL`

#### user_profiles

Supabase `auth.users`를 확장한다.

| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | uuid | **PK**, FK → auth.users.id |
| name | text | NOT NULL |
| phone_cc | text | 기본 `+82` |
| phone | text | |
| email | text | UNIQUE |
| last_org_id | uuid | FK → organizations.id |
| created_at / updated_at / deleted_at | timestamptz | |

#### memberships

**사용자는 하나의 조직에만 속한다(v0.2).** 테이블 구조는 다대다를 수용하지만 유일성 제약으로 1:1을 강제한다.

| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | uuid | **PK** |
| org_id | uuid | **FK** → organizations.id, NOT NULL |
| user_id | uuid | **FK** → user_profiles.id, NOT NULL |
| role | enum | NOT NULL — `owner` / `admin` / `staff` / `designer` / `technician` |
| is_active | boolean | 기본 true |

**Index** — `UNIQUE(user_id) WHERE is_active AND deleted_at IS NULL` ← 단일 소속 강제, `(org_id, role)`

#### partnerships

조직 간 거래 관계. **1:1 전속 (v0.2 확정).**

| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | uuid | **PK** |
| from_org_id | uuid | **FK** → organizations.id (치과 또는 디자인센터) |
| to_org_id | uuid | **FK** → organizations.id (디자인센터 또는 기공소) |
| relation | enum | `clinic_design` / `design_lab` |
| status | enum | `pending` / `active` / `terminated` |
| is_default | boolean | 1:1 단계에서는 항상 true |

**Index**
- `UNIQUE(from_org_id, relation) WHERE status = 'active'` ← **1:1 전속 강제.** 한 치과는 활성 디자인센터를 하나만 가진다
- `(to_org_id, relation, status)` — 디자인센터가 담당 치과 목록을 조회

> 다대다로 전환할 때는 위 유일 인덱스만 `UNIQUE(from_org_id, to_org_id, relation)`으로 바꾼다. 스키마 변경은 없다.

#### org_settings

| 컬럼 | 타입 | 설명 |
|---|---|---|
| org_id | uuid | **PK**, FK → organizations.id |
| invoice_delivery | enum | `all` / `email` / `fax` |
| invoice_email / tax_email / fax_no | text | |
| closing_day | smallint | 1 또는 26 |
| notify_master / notify_kakao / notify_push / notify_email | boolean | |

---

### 4.4 ② 마스터 데이터

#### prosthesis_types

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | **PK** |
| code | text | `crown` / `inlay` / `implant` |
| name | text | 크라운 / 인레이 / 임플란트 |
| abbr | text | Cr / In / Im |
| use_plain_abbr | boolean | true면 재료 표기를 그대로 사용(임플란트) |
| allow_bridge | boolean | 브릿지 연결 가능 여부 |
| requires_implant_model | boolean | 임플란트 모델 필수 여부 |
| sort_order | smallint | |

#### materials

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | **PK** |
| prosthesis_type_id | uuid | **FK** → prosthesis_types.id |
| name | text | 지르코니아 / PMMA / 하이브리드 … |
| abbr | text | Zir / Pmma / Hy … |
| sort_order | smallint | |

**Index** — `UNIQUE(prosthesis_type_id, name)`

#### material_duplicate_rules

PRD 4.2.7의 "한 치아 중복 등록 허용 조합"을 데이터로 관리한다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | **PK** |
| material_a_id | uuid | **FK** → materials.id |
| material_b_id | uuid | **FK** → materials.id |

**Index** — `UNIQUE(LEAST(material_a_id, material_b_id), GREATEST(...))`

#### shade_systems / shades

| shade_systems | 타입 |
|---|---|
| id | uuid **PK** |
| name | text — Vita classic / Vita 3D Master / Ivoclar |
| is_default | boolean |

**확정 색조 목록 (v0.6)**

| 체계 | 코드 |
|---|---|
| Vita classic (20) | A1 A2 A3 A3.5 A4 · B1 B2 B3 B3.5 B4 · C1 C2 C3 C3.5 C4 · D1 D2 D3 D3.5 D4 |
| Vita 3D Master (26) | 1M1 1M2 · 2L1.5 2L2.5 2M1 2M2 2M3 2R1.5 2R2.5 · 3L1.5 3L2.5 3M1 3M2 3M3 3R1.5 3R2.5 · 4L1.5 4L2.5 4M1 4M2 4M3 4R1.5 4R2.5 · 5M1 5M2 5M3 |
| Ivoclar (24) | 01 1A 2A 3A 4A BL1 · 2B 4B 5B 6B BL2 · 1C 2C 3C 4C 6C BL3 · 1D 1E 2E 3E 4E 6E BL4 |

| shades | 타입 |
|---|---|
| id | uuid **PK** |
| shade_system_id | uuid **FK** |
| code | text — A1, 2M1, BL3 … |
| hex_color | text — 미리보기 색 |
| sort_order | smallint |

**Index** — `UNIQUE(shade_system_id, code)`

#### 임플란트 마스터 (5단계 종속)

디자인센터가 관리한다. PRD 5.2.1의 종속 구조를 그대로 옮긴다.

| 테이블 | PK | FK | 주요 컬럼 |
|---|---|---|---|
| implant_makers | id | — | name, code, sort_order |
| implant_types | id | maker_id → implant_makers | name, code |
| implant_sizes | id | type_id → implant_types | name, code |
| implant_screws | id | type_id → implant_types | name, code |
| implant_options | id | type_id → implant_types | name, code |

**Index** — 각 자식 테이블에 `(부모_id, name)` UNIQUE, `(부모_id, sort_order)`
**삭제 정책** — 상위 삭제 시 하위 소프트 삭제(`ON DELETE` 대신 애플리케이션 트랜잭션). 이미 주문에 쓰인 값은 삭제 대신 `is_active=false`

#### clinic_implant_favorites

치과가 자주 쓰는 임플란트 조합. 디자인센터가 강제 배포할 수 있다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | **PK** |
| clinic_org_id | uuid | **FK** → organizations.id |
| maker_id / type_id | uuid | **FK**, NOT NULL |
| size_id / screw_id / option_id | uuid | **FK**, NULL 허용 |
| label | text | 표시용 캐시 (`Osstem TS Regular Hex`) |
| source | enum | `clinic` / `design_push` |
| pushed_by_org_id | uuid | FK → organizations.id |

**Index** — `UNIQUE(clinic_org_id, maker_id, type_id, size_id, screw_id, option_id)`, `(clinic_org_id)`

#### production_option_groups / production_option_values

훅, 폰틱타입처럼 항목 자체가 늘어날 수 있으므로 마스터로 둔다.

| production_option_groups | |
|---|---|
| id | uuid **PK** |
| code | text — `hook`, `pontic_type` |
| name | text — 훅, 폰틱타입 |
| sort_order | smallint |

| production_option_values | |
|---|---|
| id | uuid **PK** |
| group_id | uuid **FK** |
| value | text — 미사용/사용, ridge lap … |
| is_default | boolean |

#### option_presets

사용자별 제작옵션 즐겨찾기.

| 컬럼 | 타입 |
|---|---|
| id | uuid **PK** |
| org_id / user_id | uuid **FK** |
| label | text |
| values | jsonb — `{ hook: '사용', pontic_type: 'ovate' }` |

---

### 4.5 ③ 주문

#### patients

**채택 확정 (v0.2).** 치과와의 소통을 위해 실명을 저장한다. 주문 테이블에서 분리해 접근 권한을 별도로 통제한다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | **PK** |
| clinic_org_id | uuid | **FK** → organizations.id |
| chart_no | text | 차트번호 |
| name | text | 실명. 저장 시 암호화(pgcrypto 또는 애플리케이션 레벨) |
| name_masked | text | 마스킹 값 (`김*수`). 기공소 응답에 사용 |
| birth_date | date | 동명이인 구분용, 선택 |
| created_at | timestamptz | |

**Index** — `UNIQUE(clinic_org_id, chart_no) WHERE deleted_at IS NULL`, `(clinic_org_id)`

**접근 정책**
| 섹터 | 노출 |
|---|---|
| 치과 (본인) | 실명 + 차트번호 |
| 디자인센터 | 실명 + 차트번호 (작업 문의 필요) |
| 기공소 | **마스킹 값만** |

실명 열람은 `audit_logs`에 기록한다. 규제 요건이 확정되면 `name`을 비우고 `chart_no`만으로 운영하도록 전환할 수 있게 컬럼을 분리해 두었다.

#### orders

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | **PK** | |
| order_no | text | UNIQUE, NOT NULL | `ORD-YYMMDD-###` |
| clinic_org_id | uuid | **FK** → organizations.id, NOT NULL | 의뢰 치과 |
| design_org_id | uuid | **FK** → organizations.id | 담당 디자인센터 |
| lab_org_id | uuid | **FK** → organizations.id | 배정 기공소 (치과에 미노출) |
| patient_id | uuid | **FK** → patients.id | |
| patient_label | text | NOT NULL | 목록 표시용 캐시. 기공소 응답에서는 마스킹 값으로 치환 |
| order_type | enum | NOT NULL | `modelless` / `with_model` / `model_only` / `repair` |
| is_remake | boolean | NOT NULL 기본 false | **리메이크 태그.** true면 청구 제외 |
| is_repair | boolean | NOT NULL 기본 false | **리페어 태그.** true면 청구 제외, `production_wait`로 진입 |
| reuse_parent_scan | boolean | NOT NULL 기본 false | 리메이크 시 원주문 스캔 재사용 여부 |
| parent_order_id | uuid | **FK** → orders.id | 리메이크의 원주문 (C-3) |
| is_billable | boolean | NOT NULL 기본 true | 청구 대상 여부. 리메이크 생성 시 false |
| status | enum | NOT NULL | §4.5.1 |
| due_date | date | NOT NULL | 요청시한 = 배송 기준일 |
| designer_user_id | uuid | **FK** → user_profiles.id | |
| technician_user_id | uuid | **FK** → user_profiles.id | |
| notes | text | | 기타 요청사항 |
| remake_count | smallint | 기본 0 | |
| total_price / total_cost | numeric(12,2) | | 기공수가 / 기공원가 |
| received_at / designed_at / shipped_at / completed_at | timestamptz | | 단계별 시각 |
| created_at / updated_at / deleted_at | timestamptz | | |

**Index**
- `(clinic_org_id, created_at DESC)` — 치과 주문목록
- `(design_org_id, status)` — 디자인센터 작업 리스트
- `(lab_org_id, status)` — 기공소 목록
- `(due_date)` — 배송조회 주간 보드
- `(status)` — 상태 카운트
- `(order_no)` UNIQUE
- 부분 인덱스 `(design_org_id) WHERE status IN ('received','designing')` — 대기 목록 최적화
- `(parent_order_id)` — 직전 주문 추적
- `(root_order_id, remake_seq)` — 한 케이스의 전체 이력을 회차 순으로 조회
- 부분 인덱스 `(clinic_org_id, due_date) WHERE is_billable` — 청구 대상만 집계

**리메이크 생성 규칙 (v0.3)**

| 항목 | 규칙 |
|---|---|
| 신청 가능 상태 | `shipping` · `completed` 만. 서비스 계층과 API 양쪽에서 검증 |
| 신청 주체 | `org_type = clinic` |
| 생성 방식 | 원주문의 `order_items` · `order_options` · `bridges`를 복사한 **신규 주문** |
| 초기 상태 | `received` |
| 태그 | `is_remake = true`, `is_billable = false`, `parent_order_id = 원주문` |
| 원주문 | 상태 변경 없음(배송 상태였다면 완료 처리). `remake_count` 1 증가 |
| 계보 기록 | `parent_order_id` = 직전 주문, `root_order_id` = 원주문의 root(없으면 원주문 자신), `remake_seq` = 직전 주문의 `remake_seq` + 1 |
| 이후 흐름 | 일반 주문과 동일 |
| 스캔 데이터 | 아래 두 경로를 모두 지원한다 |

**리메이크 스캔 데이터 처리 (v0.4)**

| 방식 | 처리 |
|---|---|
| 이전 데이터 재사용 (체크박스 ON) | 원주문 `order_files(kind='scan')` 행을 새 주문으로 복사. **Storage 객체는 복사하지 않고 같은 경로를 참조**하며 `source_file_id`로 원본을 연결한다 |
| 신규 업로드 | 일반 업로드 흐름과 동일 |
| 병행 | 둘 다 허용 (이전 데이터 + 추가 촬영본) |

**차단 규칙** — 체크박스가 꺼져 있고 신규 업로드도 0건이면 리메이크 주문을 생성하지 않는다. 서비스 계층에서 검증하며 API는 422를 반환한다.

**리페어 생성 규칙 (v0.4)**

| 항목 | 규칙 |
|---|---|
| 신청 가능 상태 | `shipping` · `completed` |
| 신청 주체 | `org_type = clinic` |
| 초기 상태 | **`production_wait`** — 디자인센터를 거치지 않는다 |
| 배정 | 원주문의 `lab_org_id`를 그대로 승계 |
| 태그 | `is_repair = true`, `is_billable = false`, `parent_order_id = 원주문` |
| 알림 | 배정된 **기공소**에 발송 |
| 디자인 파일 | 원주문의 `order_files(kind='design')` 참조 연결 |
| 이후 흐름 | 제작대기 → 제작 → 배송 → 완료 (일반과 동일) |

#### 4.5.1 order_status (enum)

**사용 중인 상태**

`received`(접수) · `rescan`(재스캔) · `designing`(디자인) · `production_wait`(제작대기) · `production`(제작) · `shipping`(배송) · `completed`(완료) · `cancelled`(취소)

**예약 상태 — 사용하지 않음**

`design_confirm`(디자인 컨펌)은 enum 값으로만 추가해 두고 **모든 화면·필터·카운트에서 제외**한다. `order_status_transitions`에 이 상태로 향하는 전이를 정의하지 않으므로 실제로는 진입할 수 없다. 향후 기능 도입 시 전이 규칙 행만 추가하면 된다.

> PostgreSQL enum은 값 삭제가 어렵고 추가는 쉽다. 지금 넣어두면 나중에 `ALTER TYPE` 없이 활성화만 하면 되고, 넣지 않아도 추가는 가능하다. **초기 마이그레이션에는 넣지 않고 필요 시점에 추가**하는 쪽을 권한다 — 사용하지 않는 값이 코드 분기와 테스트에 잡음을 만들기 때문이다.

#### order_status_transitions

상태 전이 규칙을 데이터로 관리한다(§3.3).

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | **PK** |
| from_status | enum | |
| to_status | enum | |
| actor_org_type | enum | 실행 가능한 섹터 |
| actor_roles | enum[] | 실행 가능한 역할 |
| requires_design_file | boolean | 디자인 파일 필수 여부 |
| requires_reason | boolean | 사유 입력 필수 여부 |
| creates_issue | text | 발생시킬 이슈 코드 |

**정의되는 전이 (v0.2)**

| from | to | 실행 주체 |
|---|---|---|
| received | designing | design_center |
| received | rescan | design_center (재스캔·수정 요청) |
| designing | rescan | design_center (재스캔·수정 요청) |
| designing | production_wait | design_center (디자인 파일 필수) |
| rescan | received | clinic (스캔 재업로드) |
| production_wait | production | lab |
| production | shipping | lab |
| shipping | completed | clinic |
| received / rescan | cancelled | clinic |
| (신규 생성) | received | clinic — 리메이크 |
| (신규 생성) | production_wait | clinic — **리페어** (디자인 단계 건너뜀) |

**기공소의 역방향 전이는 정의하지 않는다(C-7).** 되돌리기는 디자인센터 → 치과 경로뿐이다.

#### 4.5.2 리메이크 계보 (v0.5)

리메이크는 원주문을 수정하지 않고 **복제본에 태그를 다는 방식**이다. 원주문 금액이 사후에 흔들리지 않으므로 정산 근거가 안정적이다.

```
ORD-001 (원주문, remake_seq 0, root = 자기 자신)
   └─ ORD-014 (1차 리메이크, parent = ORD-001, root = ORD-001, remake_seq 1)
         └─ ORD-032 (2차 리메이크, parent = ORD-014, root = ORD-001, remake_seq 2)
```

| 컬럼 | 쓰임 |
|---|---|
| `parent_order_id` | 무엇을 다시 만드는지. 차액 계산은 **직전 주문과 비교**한다 |
| `root_order_id` | 한 케이스의 전체 이력을 한 번에 조회. 사슬을 거슬러 올라갈 필요가 없다 |
| `remake_seq` | 목록에서 `2차 리메이크`처럼 바로 표시 |

**총 리메이크 횟수**는 `SELECT max(remake_seq) WHERE root_order_id = ?` 로 구한다. 각 주문의 `remake_count`를 합산하지 않는다.

#### order_items

**치아 하나 = 행 하나.** 한 치아에 보철이 둘이면 두 행(§3.2, PRD 4.2.7).

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | **PK** | |
| order_id | uuid | **FK** → orders.id ON DELETE CASCADE, NOT NULL | |
| tooth_number | smallint | NOT NULL, CHECK 11~48 유효 치식 | FDI |
| slot | smallint | NOT NULL, 기본 1 | 중복 등록 시 1 또는 2 |
| prosthesis_type_id | uuid | **FK**, NOT NULL | |
| material_id | uuid | **FK**, NOT NULL | |
| shade_system_id | uuid | **FK** | |
| shade_cervical_id | uuid | **FK** → shades.id | 치경부 |
| shade_incisal_id | uuid | **FK** → shades.id | 절단부 |
| implant_maker_id … implant_option_id | uuid | **FK** | 임플란트일 때만 |
| is_pontic | boolean | 기본 false | 화면에 X 표기 |
| is_pmma | boolean | 기본 false | |
| unit_price | numeric(12,2) | | 주문 시점 단가 스냅샷 (§3.7) |
| created_at | timestamptz | | |

**Index** — `UNIQUE(order_id, tooth_number, slot)`, `(order_id)`, `(prosthesis_type_id, material_id)` (통계용)
**제약** — `CHECK (slot IN (1,2))`, 임플란트일 때 `implant_type_id IS NOT NULL` (부분 CHECK)

#### order_item_bridges / order_item_bridge_members

브릿지 묶음. 묶음은 여러 치아를 포함한다.

| order_item_bridges | 타입 |
|---|---|
| id | uuid **PK** |
| order_id | uuid **FK** |
| created_by_rule | boolean — 자동 연결 여부 |

| order_item_bridge_members | 타입 |
|---|---|
| bridge_id | uuid **FK**, **PK(복합)** |
| order_item_id | uuid **FK**, **PK(복합)** |
| position | smallint — 배열 순서 |

**Index** — `(order_id)`, `UNIQUE(order_item_id)` (한 아이템은 한 브릿지에만 속함)

#### order_options

| 컬럼 | 타입 |
|---|---|
| order_id | uuid **FK**, **PK(복합)** |
| option_group_id | uuid **FK**, **PK(복합)** |
| option_value_id | uuid **FK** |

#### order_files

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | **PK** | |
| order_id | uuid | **FK** ON DELETE CASCADE | |
| kind | enum | NOT NULL | `scan` / `design` / `photo` / `doc` |
| revision | smallint | 기본 1 | 재업로드 시 증가 (§1.2) |
| file_name | text | NOT NULL | |
| storage_path | text | NOT NULL | Supabase Storage 경로 |
| mime_type | text | | |
| size_bytes | bigint | | |
| checksum | text | | 무결성 확인 |
| source_file_id | uuid | **FK** → order_files.id | 리메이크·리페어에서 원본 파일을 참조할 때 |
| uploaded_by_org_id | uuid | **FK** | |
| uploaded_by_user_id | uuid | **FK** | |
| created_at / deleted_at | timestamptz | | 소프트 삭제 |

**Index** — `(order_id, kind, revision DESC)`, `(storage_path)` UNIQUE

#### order_memos

| 컬럼 | 타입 |
|---|---|
| id | uuid **PK** |
| order_id | uuid **FK** |
| author_org_id / author_user_id | uuid **FK** |
| body | text — 200자 제한(앱 단) |
| visible_to | enum[] — 어느 섹터가 볼 수 있는지 |
| created_at | timestamptz |

**Index** — `(order_id, created_at DESC)`

#### order_status_history

| 컬럼 | 타입 |
|---|---|
| id | uuid **PK** |
| order_id | uuid **FK** |
| from_status / to_status | enum |
| actor_org_id / actor_user_id | uuid **FK** |
| reason | text — 재스캔·수정 요청 사유 |
| created_at | timestamptz |

**Index** — `(order_id, created_at DESC)`

#### order_issues

| 컬럼 | 타입 |
|---|---|
| id | uuid **PK** |
| order_id | uuid **FK** |
| issue_type | enum — `rescan` / `remake` / `repair` / `analog` |
| opened_by_org_id | uuid **FK** |
| opened_at / resolved_at | timestamptz |
| reason | text |

**Index** — `(order_id)`, `(issue_type, resolved_at)`

---

### 4.6 ④ 배송 (Q-4, Q-5 확정 후 확장)

#### deliveries

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | **PK** |
| lab_org_id / clinic_org_id | uuid | **FK** |
| scheduled_date | date | 배송 예정일 |
| shipped_at / delivered_at | timestamptz | |
| carrier / tracking_no | text | 택배 연동 시 |
| status | enum | `ready` / `shipped` / `delivered` |

**Index** — `(clinic_org_id, scheduled_date)`, `(lab_org_id, scheduled_date)`

#### delivery_items

| delivery_id | uuid **FK**, **PK(복합)** |
| order_id | uuid **FK**, **PK(복합)** |

#### pickup_requests

**치과가 요청하고 기공소가 처리한다 (v0.6).** 대상은 모델과 인상체다.

| 컬럼 | 타입 |
|---|---|
| id | uuid **PK** |
| clinic_org_id | uuid **FK** — 요청 치과 |
| lab_org_id | uuid **FK** — 처리 기공소 |
| order_id | uuid **FK** NULL — 리페어 등 연결된 주문 |
| kind | enum — `model` / `impression` |
| requested_by_user_id | uuid **FK** |
| deadline | timestamptz — 요청시한 |
| memo | text — 요청사항 |
| status | enum — `open`(수거대기) / `assigned` / `done` / `cancelled` |

**Index** — `(lab_org_id, status)`, `(clinic_org_id, deadline)`

기공소 HOME의 **수거대기** 카운트가 `status='open'` 건수다. 기공소가 수거를 확인하면 연결된 주문이 `제작대기`로 넘어간다.

---

### 4.7 ⑤ 정산 (Q-1, Q-6 확정 후 확장)

#### price_lists / price_items

**설정 주체는 디자인센터다 (v0.3).** 거래 치과별로 다른 단가표를 만들 수 있다.

| price_lists | 타입 | 설명 |
|---|---|---|
| id | uuid | **PK** |
| owner_org_id | uuid | **FK** → organizations.id. **디자인센터**만 소유 가능 |
| target_clinic_org_id | uuid | **FK** → organizations.id. NULL이면 모든 거래 치과 공통 기본 단가 |
| name | text | 단가표 이름 |
| effective_from / effective_to | date | 적용 기간 (§3.7) |
| status | enum | `draft` / `active` / `archived` |

**Index** — `(owner_org_id, target_clinic_org_id, effective_from DESC)`,
`UNIQUE(owner_org_id, target_clinic_org_id, effective_from) WHERE status='active'`

**단가 조회 우선순위** — 치과 전용 단가표 → 기본 단가표 → 없으면 0

| price_items | 타입 | 설명 |
|---|---|---|
| id | uuid | **PK** |
| price_list_id | uuid | **FK** |
| prosthesis_type_id | uuid | **FK** → prosthesis_types.id |
| material_id | uuid | **FK** → materials.id. NULL이면 해당 종류 전체 |
| tooth_scope | enum | **`all` / `anterior`(전치) / `posterior`(구치)** — v0.4 확정 |
| unit | enum | `per_tooth` / `per_case` |
| amount | numeric(12,2) | |
| sort_order | smallint | 매칭 우선순위 (구체적인 것이 앞) |

**Index** — `(price_list_id, prosthesis_type_id, material_id)`, `(price_list_id, sort_order)`

**치식 분류 기준**

| 구분 | 치식 |
|---|---|
| anterior (전치) | 11~13, 21~23, 31~33, 41~43 |
| posterior (구치) | 14~18, 24~28, 34~38, 44~48 |

판정은 `server/domain/tooth`의 순수 함수로 처리한다(치아 번호 끝자리 ≤3 이면 전치).

**매칭 규칙** — 한 치아에 여러 행이 걸리면 구체적인 쪽을 적용한다. `anterior`/`posterior` > `all`

> 개별 치아 단가가 필요해지면 `tooth_scope`에 `specific` 값과 `tooth_numbers` 컬럼을 추가한다. 지금은 넣지 않는다.

#### 정산의 두 방향 (v0.7)

| 방향 | 대상 | 산정 기준 |
|---|---|---|
| **청구** | 치과 | `orders.clinic_org_id` 기준. 자사 기공 여부와 무관하게 모두 포함 |
| **지급** | 기공소 | `orders.lab_org_id` 기준. **자사 기공은 제외** |

자사 기공 판별은 `orders.lab_org_id = 발행 조직의 org_id` 로 한다. 같으면 내부 제작이므로 지급 명세에 잡히지 않는다. 이 구조 덕에 디자인센터가 기공소를 소유해 지출을 줄이는 형태를 그대로 표현할 수 있다.

**invoices.direction** enum을 둔다 — `charge`(청구) / `payout`(지급). 같은 테이블을 쓰되 방향으로 구분한다.

#### invoices / invoice_lines

| invoices | 타입 |
|---|---|
| id | uuid **PK** |
| invoice_no | text UNIQUE — `INV-YYYYMM-###` |
| issuer_org_id / payer_org_id | uuid **FK** |
| period_start / period_end | date |
| issued_at / due_date | date |
| method | enum — `transfer` / `card` / `auto_debit` |
| total_amount / unpaid_amount | numeric(12,2) |
| status | enum — `unpaid` / `partial` / `paid` / `void` |

| invoice_lines | 타입 |
|---|---|
| id | uuid **PK** |
| invoice_id | uuid **FK** |
| order_id / order_item_id | uuid **FK** |
| description | text |
| quantity | numeric |
| amount | numeric(12,2) |

**Index** — `(payer_org_id, period_start DESC)`, `(status, due_date)`

**청구 대상 산정 (v0.3)** — `orders.is_billable = true` 인 주문만 `invoice_lines`에 포함한다. 리메이크 주문은 이용내역 화면에는 표시하되 금액 0으로 나가고 청구서에는 들어가지 않는다.

#### adjustments

PRD 4.6의 "조정 금액", "보철 조정 내역".

| 컬럼 | 타입 |
|---|---|
| id | uuid **PK** |
| order_id | uuid **FK** NULL |
| invoice_id | uuid **FK** NULL |
| reason | text |
| amount | numeric(12,2) — 음수 허용 |
| created_by_user_id | uuid **FK** |

#### payments

| id | uuid **PK** |
| invoice_id | uuid **FK** |
| paid_at | timestamptz |
| amount | numeric(12,2) |
| method | enum |

---

### 4.8 ⑥ 콘텐츠

| 테이블 | 주요 컬럼 |
|---|---|
| notices | id, title, body, pinned, publish_from, publish_to, author_user_id, target_org_types enum[] |
| faqs | id, category, question, answer, sort_order, target_org_types |
| qna_threads | id, org_id, author_user_id, title, status(`open`/`answered`/`closed`) |
| qna_messages | id, thread_id, author_user_id, body, created_at |

**Index** — `notices(publish_from DESC)`, `qna_threads(org_id, created_at DESC)`

---

### 4.9 ⑦ 시스템

#### notifications

| 컬럼 | 타입 |
|---|---|
| id | uuid **PK** |
| recipient_user_id | uuid **FK** |
| org_id | uuid **FK** |
| channel | enum — `kakao` / `push` / `email` / `in_app` |
| event_type | text |
| payload | jsonb |
| sent_at / read_at | timestamptz |
| status | enum — `queued` / `sent` / `failed` |

**Index** — `(recipient_user_id, read_at)`, `(status, created_at)`

#### domain_events (§3.4)

| id | uuid **PK** |
| event_type | text — `order.status_changed` 등 |
| aggregate_type / aggregate_id | text / uuid |
| actor_org_id / actor_user_id | uuid |
| payload | jsonb |
| created_at | timestamptz |

**Index** — `(aggregate_type, aggregate_id, created_at)`, `(event_type, created_at)`

#### audit_logs (§3.5)

| id | uuid **PK** |
| org_id / user_id | uuid |
| action | enum — `read` / `create` / `update` / `delete` / `download` |
| target_table / target_id | text / uuid |
| ip / user_agent | text |
| diff | jsonb — 변경 전후 |
| created_at | timestamptz |

**Index** — `(target_table, target_id, created_at DESC)`, `(user_id, created_at DESC)`
**보존** — 파티셔닝(월 단위) 권장

---

### 4.10 관계 요약

```
organizations ─┬─< memberships >─ user_profiles
               ├─< partnerships >─ organizations
               ├─< org_settings
               ├─< clinic_implant_favorites
               └─< orders (clinic / design / lab 3중 참조)

orders ─┬─< order_items ─< order_item_bridge_members >─ order_item_bridges
        ├─< order_files
        ├─< order_options
        ├─< order_memos
        ├─< order_status_history
        ├─< order_issues
        ├─< delivery_items >─ deliveries
        └─< invoice_lines >─ invoices ─< payments

implant_makers ─< implant_types ─┬─< implant_sizes
                                 ├─< implant_screws
                                 └─< implant_options

prosthesis_types ─< materials ─< material_duplicate_rules
shade_systems ─< shades
```

### 4.11 확장 대비

| 확장 시나리오 | 대응 |
|---|---|
| 새 섹터 추가(밀링센터 등) | `org_type` enum에 값 추가, `partnerships.relation` 추가 |
| 새 보철 종류·재료 | 마스터 테이블 행 추가만, 스키마 변경 없음 |
| 국가/언어 확장 | 마스터 테이블에 `locale` 컬럼 또는 번역 테이블 분리 |
| 주문량 급증 | `orders`, `order_items`, `audit_logs` 월 단위 파티셔닝 |
| 3D 뷰어 도입 | `order_files`에 `preview_path`, `mesh_stats jsonb` 추가 |
| 보험 청구 연동 | `orders`에 청구 코드 컬럼 또는 별도 테이블 |

---

## 5. 시스템 아키텍처

### 5.1 기술 스택

| 계층 | 선택 | 근거 |
|---|---|---|
| 프레임워크 | Next.js 15 App Router | 서버 컴포넌트로 권한별 데이터 노출 제어가 자연스럽다 |
| 언어 | TypeScript (strict) | 도메인 규칙이 복잡해 타입 안전성이 중요 |
| 스타일 | TailwindCSS + CSS 변수 | 섹터별 테마 색을 변수로 교체 |
| DB / 인증 / 스토리지 | Supabase (서울 리전) | RLS로 테넌트 격리, presigned URL로 대용량 파일 직접 업로드 |
| 서버 상태 | TanStack Query | 목록·필터·페이지네이션 캐싱 |
| 폼 | React Hook Form + Zod | 스키마를 API·클라이언트 양쪽에서 공유 |
| 테스트 | Vitest + Playwright | 도메인 규칙 단위 테스트 + 핵심 흐름 E2E |

### 5.2 계층 구조

```
[브라우저]
   │  서버 컴포넌트 렌더링 / REST 호출
[Next.js]
   ├─ app/          라우팅 · 화면
   ├─ app/api/      REST 엔드포인트 (route handlers)
   ├─ server/       서비스 계층 (도메인 로직)
   └─ lib/          Supabase 클라이언트, 유틸
   │
[Supabase]
   ├─ PostgreSQL + RLS
   ├─ Auth
   ├─ Storage (스캔 · 디자인 파일)
   └─ Edge Functions (알림 발송, 정산 배치)
```

### 5.3 핵심 설계 결정

**결정 1 — 도메인 로직은 서비스 계층에 모은다.**
치식 규칙(브릿지 자동 연결, 중복 허용 조합, 폰틱 처리)은 `server/domain/` 한 곳에만 둔다. API·서버 액션·배치가 모두 같은 함수를 호출한다. 화면에 규칙이 흩어지면 유지보수가 무너진다.

**결정 2 — 권한은 2중으로 검사한다.**
Supabase RLS(DB 레벨)와 서비스 계층(애플리케이션 레벨) 양쪽에서 검사한다. 화면에서 숨기는 것은 UX일 뿐 보안이 아니다(PRD 3.2 주의사항 반영).

**결정 3 — 파일은 서버를 거치지 않는다.**
STL은 10~50MB다. 서버가 중계하면 메모리와 대역폭이 낭비된다. presigned URL을 발급해 브라우저 → Storage 직접 업로드하고, 완료 후 메타데이터만 등록한다.

**결정 4 — 섹터별 화면은 라우트 그룹으로 분리한다.**
`(clinic)`, `(design)`, `(lab)` 라우트 그룹을 두고 공통 컴포넌트를 공유한다. PRD처럼 "동일하지만 일부 다른" 구조에 적합하다.

**결정 5 — 상태 전이는 단일 진입점으로 처리한다.**
모든 상태 변경은 `changeOrderStatus()` 하나를 통과한다. 여기서 전이 가능 여부 검증, 이력 기록, 이벤트 발행, 알림 큐 적재를 일괄 처리한다.

---

## 6. 폴더 구조

```
ds-flow/
├─ app/
│  ├─ (auth)/
│  │  ├─ login/                     로그인
│  │  ├─ signup/                    조직 가입 신청
│  │  └─ reset-password/
│  │
│  ├─ (clinic)/                     치과 계정
│  │  ├─ layout.tsx                 사이드바 · 권한 가드
│  │  ├─ home/
│  │  ├─ orders/
│  │  │  ├─ new/                    주문등록
│  │  │  ├─ page.tsx                주문목록
│  │  │  └─ [orderId]/              주문상세
│  │  ├─ deliveries/                배송조회
│  │  ├─ billing/                   정산
│  │  ├─ members/                   사용자
│  │  ├─ board/                     게시판
│  │  └─ settings/                  계정 설정
│  │
│  ├─ (design)/                     디자인센터
│  │  ├─ home/
│  │  ├─ orders/
│  │  │  └─ [orderId]/
│  │  ├─ implants/
│  │  │  ├─ master/                 마스터 관리
│  │  │  └─ distribution/           치과 배포
│  │  ├─ deliveries/                전체 치과 대상
│  │  ├─ members/
│  │  ├─ board/
│  │  └─ settings/
│  │
│  ├─ (lab)/                        기공소
│  │  ├─ home/
│  │  ├─ orders/
│  │  ├─ shipments/
│  │  └─ settings/
│  │
│  ├─ (admin)/                      플랫폼 운영자
│  │  ├─ organizations/
│  │  ├─ masters/
│  │  └─ audit/
│  │
│  └─ api/v1/                       REST 엔드포인트 (§7)
│
├─ server/
│  ├─ domain/                       ★ 도메인 규칙 (프레임워크 비의존)
│  │  ├─ tooth/                     치식 번호 · 치종 판정 · 사분악
│  │  ├─ prosthesis/                종류-재료 종속, 약칭 생성
│  │  ├─ bridge/                    인접 판정 · 자동 연결 · 폰틱 규칙
│  │  ├─ duplicate/                 한 치아 중복 등록 허용 조합
│  │  ├─ shade/                     이분할 로직
│  │  ├─ order-status/              상태 머신
│  │  └─ pricing/                   단가 계산
│  ├─ services/                     유스케이스 (트랜잭션 경계)
│  │  ├─ order.service.ts
│  │  ├─ file.service.ts
│  │  ├─ implant.service.ts
│  │  ├─ billing.service.ts
│  │  └─ notification.service.ts
│  ├─ repositories/                 DB 접근
│  ├─ policies/                     권한 판정
│  └─ events/                       도메인 이벤트 발행 · 구독
│
├─ lib/
│  ├─ supabase/                     server / client / admin 클라이언트
│  ├─ validation/                   Zod 스키마 (API·폼 공유)
│  ├─ format/                       날짜 · 금액 · 치식 표기
│  └─ constants/
│
├─ components/
│  ├─ ui/                           버튼 · 입력 · 모달 · 토스트
│  ├─ layout/                       사이드바 · 상단바 · 섹터 테마
│  ├─ dental/                       ★ 도메인 UI
│  │  ├─ ToothChart/                치식도 (선택 · 브릿지 박스 · X 표기)
│  │  ├─ ShadePicker/               쉐이드 이분할 팝업
│  │  ├─ ImplantPicker/             제조사→타입→사이즈·스크류 계단식
│  │  └─ ProsthesisSummary/         요약 카드
│  ├─ order/                        주문 폼 · 목록 · 상세 조각
│  └─ chart/                        통계 그래프
│
├─ hooks/
├─ types/                           DB 타입(Supabase 생성) + 도메인 타입
├─ supabase/
│  ├─ migrations/                   스키마 마이그레이션
│  ├─ seed/                         마스터 초기 데이터
│  └─ functions/                    Edge Functions
├─ tests/
│  ├─ domain/                       치식 규칙 단위 테스트
│  └─ e2e/
└─ docs/
   ├─ PRD.md                        기능 명세서
   └─ ARCHITECTURE.md               본 문서
```

**핵심** — `server/domain/`은 Next.js·Supabase를 몰라야 한다. 순수 함수로 두면 규칙 변경 시 테스트만으로 검증할 수 있고, 나중에 모바일 앱이나 배치에서도 재사용된다.

---

## 7. REST API 설계

### 7.1 공통 규약

| 항목 | 규약 |
|---|---|
| 기본 경로 | `/api/v1` |
| 인증 | `Authorization: Bearer <supabase_jwt>` |
| 조직 컨텍스트 | JWT의 `org_id` 클레임에서 도출. 사용자는 단일 조직 소속이므로 별도 헤더 불필요 |
| 목록 응답 | `{ data: [...], page: { number, size, total } }` |
| 오류 응답 | `{ error: { code, message, details } }` |
| 페이지네이션 | `?page=1&size=10` |
| 정렬 | `?sort=due_date&order=asc` |
| 멱등성 | 생성 요청에 `Idempotency-Key` 헤더 권장 |
| 버전 | 경로 버전(`v1`). 파괴적 변경 시 `v2` |

### 7.2 인증 · 조직

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/auth/login` | 로그인 |
| POST | `/auth/logout` | |
| POST | `/auth/password/reset` | 재설정 메일 |
| PATCH | `/auth/password` | 변경(현재 비밀번호 검증) |
| GET | `/me` | 프로필 + 소속 조직 (단일) |
| PATCH | `/me` | 이름 · 연락처 수정 |
| GET | `/orgs/:orgId` | 조직 정보 |
| PATCH | `/orgs/:orgId` | 사업자 정보 수정 |
| GET/PATCH | `/orgs/:orgId/settings` | 결제 · 알림 설정 |
| GET | `/orgs/:orgId/members` | 사용자 목록 |
| POST | `/orgs/:orgId/members` | 사용자 등록(초대) |
| PATCH/DELETE | `/orgs/:orgId/members/:id` | 권한 변경 · 삭제 |
| GET | `/orgs/:orgId/partner` | 전속 거래 조직 (단수) |
| POST | `/orgs/:orgId/partner` | 거래 연결 신청 |
| PATCH | `/partnerships/:id` | 승인 · 해지 |

### 7.3 마스터 데이터

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/masters/prosthesis-types` | 종류 + 하위 재료 포함 |
| GET | `/masters/shade-systems` | 체계 + 색조 목록 |
| GET | `/masters/production-options` | 훅 · 폰틱타입 |
| GET | `/masters/duplicate-rules` | 중복 등록 허용 조합 |

### 7.4 임플란트 (디자인센터 관리)

| 메서드 | 경로 | 권한 |
|---|---|---|
| GET | `/implants/catalog` | 전 섹터 조회 (제조사→타입→사이즈·스크류·옵션 중첩) |
| POST/PATCH/DELETE | `/implants/makers[/:id]` | 디자인센터 |
| POST/PATCH/DELETE | `/implants/types[/:id]` | 디자인센터 |
| POST/PATCH/DELETE | `/implants/sizes[/:id]` | 디자인센터 |
| POST/PATCH/DELETE | `/implants/screws[/:id]` | 디자인센터 |
| POST/PATCH/DELETE | `/implants/options[/:id]` | 디자인센터 |
| GET | `/orgs/:orgId/implant-favorites` | 치과 즐겨찾기 |
| POST | `/orgs/:orgId/implant-favorites` | 치과 등록 / 디자인센터 배포 |
| DELETE | `/orgs/:orgId/implant-favorites/:id` | 삭제 · 회수 |

### 7.5 주문

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/orders` | 목록. 필터: `status`, `issue`, `from`, `to`, `clinic`, `patient`, `q` |
| POST | `/orders` | 등록 (치식·옵션·파일 메타 포함) |
| GET | `/orders/:id` | 상세 |
| PATCH | `/orders/:id` | 수정 (접수·재스캔 상태만, C-4) |
| DELETE | `/orders/:id` | 소프트 삭제 |
| POST | `/orders/:id/status` | **상태 전이 단일 진입점** `{ to, reason }` |
| POST | `/orders/:id/assign` | 디자이너 · 기공소 배정 |
| POST | `/orders/:id/remake` | **리메이크 신청** (배송·완료 상태만). `{ reuseParentScan, files[] }`. 둘 다 비면 422 |
| POST | `/orders/:id/repair` | **리페어 신청** (배송·완료 상태만). `production_wait`로 생성, 원주문 기공소 배정 |
| GET/POST | `/orders/:id/memos` | 메모 |
| GET | `/orders/:id/history` | 상태 이력 |
| GET/POST | `/orders/:id/issues` | 이슈 |
| GET | `/orders/summary` | 상태별 건수 (HOME 카운트) |
| GET | `/orders/worklist` | 디자인센터 작업 리스트 |

### 7.6 파일

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/orders/:id/files/presign` | 업로드 URL 발급 `{ fileName, size, kind }` |
| POST | `/orders/:id/files` | 업로드 완료 등록 (메타데이터) |
| GET | `/orders/:id/files` | 목록 (kind · revision 필터) |
| GET | `/files/:fileId/download` | 다운로드 URL 발급 (감사 로그 기록) |
| DELETE | `/files/:fileId` | 소프트 삭제 |

### 7.7 배송

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/deliveries` | 주간 보드 `?from=&to=&scope=all\|mine` |
| POST | `/deliveries` | 출고 등록 |
| PATCH | `/deliveries/:id` | 송장 · 상태 갱신 |
| GET/POST | `/pickup-requests` | 수거요청 |

### 7.8 정산

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/billing/usage` | 이용내역 `?from=&to=` |
| GET | `/billing/usage/export` | CSV 내려받기 |
| GET | `/billing/adjustments` | 조정 내역 |
| POST | `/billing/adjustments` | 조정 등록 |
| GET | `/invoices` | 청구서 목록 |
| GET | `/invoices/:id` | 상세 |
| GET | `/invoices/:id/pdf` | 청구서 PDF |
| GET | `/price-lists` | 단가표 조회 |
| POST/PATCH | `/price-lists[/:id]` | 단가표 관리 |

### 7.9 콘텐츠 · 알림

| 메서드 | 경로 |
|---|---|
| GET | `/notices`, `/notices/:id` |
| GET | `/faqs` |
| GET/POST | `/qna`, `/qna/:id/messages` |
| GET | `/notifications` |
| PATCH | `/notifications/:id/read` |

---

## 8. 권한 및 인증 구조

### 8.1 인증 흐름

```
로그인 → Supabase Auth → JWT 발급
   ↓
JWT의 app_metadata에 org_id · org_type · role 주입
   ↓
서버 컴포넌트 / API에서 세션 검증 → 권한 판정
   ↓
DB 접근 시 RLS가 org_id 기준으로 한 번 더 차단
```

사용자는 하나의 조직에만 속하므로 조직 전환 개념이 없다. 소속이 바뀌면 재로그인한다.

### 8.2 역할 정의

| org_type | role | 권한 |
|---|---|---|
| clinic | owner | 전체 + 이용 금액 · 정산 |
| clinic | admin | 전체 + 이용 금액 (조직 삭제 불가) |
| clinic | **staff** | 주문·배송·게시판. **이용 금액 조회 불가** |
| design_center | owner / admin | 전체 + 임플란트 마스터 + 기공소 배정 |
| design_center | designer | 배정된 케이스 작업, 마스터 조회만 |
| lab | owner / admin | 배정 케이스 + 기공수가 |
| lab | technician | 배정 케이스 작업 |
| platform | superadmin | 조직 승인, 마스터 감독, 감사 로그 |

### 8.3 권한 매트릭스 (주요 동작)

| 동작 | clinic.owner | clinic.staff | design.admin | design.designer | lab.owner |
|---|:---:|:---:|:---:|:---:|:---:|
| 주문 등록 | O | O | O(대행) | X | X |
| 주문 수정·삭제(접수 상태) | O | O | O | X | X |
| 스캔 파일 업로드 | O | O | O | X | X |
| 디자인 파일 업로드 | X | X | O | O | X |
| 재스캔 요청 · 수정 요청 | X | X | O | O | **X** |
| 기공소 배정 | X | X | O | X | X |
| 제작 시작·출고 | X | X | X | X | O |
| 이전 단계로 되돌리기 | X | X | O | O | **X** |
| 리메이크 신청 (배송·완료 상태) | O | O | X | X | X |
| 리페어 신청 (배송·완료 상태) | O | O | X | X | X |
| 단가표 설정 | X | X | **O** | X | X |
| 이용 금액 조회 | O | **X** | O | X | O |
| 기공수가 조회 | **X** | **X** | O | X | O |
| 기공소명 조회 | **X** | **X** | O | O | O |
| 임플란트 마스터 편집 | X | X | O | X | X |
| 임플란트 강제 배포 | X | X | O | X | X |
| 사용자 관리 | O | X | O | X | O |

### 8.4 RLS 정책 원칙

| 테이블 | 정책 |
|---|---|
| orders | `clinic_org_id`, `design_org_id`, `lab_org_id` 중 하나가 현재 org_id와 일치할 때만 SELECT. 각 컬럼별로 UPDATE 가능 범위 분리 |
| order_items / files / memos | 상위 order 접근 권한을 상속 |
| order_files (design kind) | 치과는 디자인 파일 다운로드 불가(정책 확인 필요 → **Q-11**) |
| clinic_implant_favorites | 해당 치과 본인 + 파트너 디자인센터 |
| implant_* 마스터 | 조회 전체 공개, 쓰기는 design_center only |
| invoices | payer_org_id 또는 issuer_org_id 일치 |
| audit_logs | superadmin만 |

### 8.5 민감 필드 차단

| 필드 | 차단 대상 | 방법 |
|---|---|---|
| 기공소명 · 기공수가 · 기공원가 | 치과 | 섹터별 뷰에서 컬럼 제외 |
| 담당 디자이너 | 치과 | 동일 |
| **환자 실명** | 기공소 | 마스킹 값(`name_masked`)으로 치환해 응답 |

화면 숨김이 아니라 **응답에 아예 담기지 않아야** 한다(PRD 3.2, 3.3 반영). 환자 실명 열람은 감사 로그에 기록한다.

### 8.6 추가 보안 조치

| 항목 | 내용 |
|---|---|
| 파일 접근 | presigned URL 만료 5분, 다운로드마다 감사 로그 |
| 세션 | 유휴 30분 자동 로그아웃, 기기별 세션 관리 |
| 비밀번호 | 최소 8자 + 3종 조합, 해시는 Supabase Auth 위임 |
| 2단계 인증 | owner/admin 권장(2차 스프린트) |
| 접근 제어 실패 | 로그 기록 후 일반화된 404 반환(존재 여부 노출 방지) |

---

## 9. 화면 ↔ API ↔ 테이블 매핑

### 9.1 치과 계정

| 화면 | API | 주요 테이블 |
|---|---|---|
| HOME | `GET /orders/summary`, `GET /deliveries?from=today&to=today`, `GET /notices`, `GET /billing/usage` | orders, order_issues, deliveries, notices, invoice_lines |
| 주문등록 | `GET /masters/*`, `GET /implants/catalog`, `GET /orgs/:id/implant-favorites`, `POST /orders/:id/files/presign`, `POST /orders` | prosthesis_types, materials, shades, implant_*, clinic_implant_favorites, orders, order_items, order_item_bridges, order_options, order_files |
| 주문목록 | `GET /orders`, `GET /orders/summary` | orders, order_items, order_issues |
| 주문상세 | `GET /orders/:id`, `GET /orders/:id/files`, `GET/POST /orders/:id/memos`, `PATCH /orders/:id`, `POST /orders/:id/status` | orders, order_items, order_files, order_memos, order_status_history |
| 배송조회 | `GET /deliveries?scope=mine` | deliveries, delivery_items, orders |
| 정산 – 이용내역 | `GET /billing/usage`, `GET /billing/usage/export` | orders, order_items, price_items, adjustments |
| 정산 – 청구서 | `GET /invoices` | invoices, payments |
| 사용자 | `GET/POST/PATCH/DELETE /orgs/:id/members` | memberships, user_profiles |
| 게시판 | `GET /notices`, `/faqs`, `/qna` | notices, faqs, qna_threads |
| 계정 설정 | `GET/PATCH /orgs/:id`, `/orgs/:id/settings`, `PATCH /auth/password` | organizations, org_settings, user_profiles |

### 9.2 디자인센터 계정

| 화면 | API | 주요 테이블 |
|---|---|---|
| HOME | `GET /orders/summary?scope=design`, `GET /orders/worklist` | orders, order_items, user_profiles |
| 주문목록 · 상세 | `GET /orders?scope=design`, `POST /orders/:id/status`, `POST /orders/:id/assign`, 파일 API | orders, order_files, order_status_history |
| 임플란트 마스터 | `GET /implants/catalog`, `POST/PATCH/DELETE /implants/*` | implant_makers, implant_types, implant_sizes, implant_screws, implant_options |
| 치과 배포 | `GET/POST/DELETE /orgs/:clinicId/implant-favorites` | clinic_implant_favorites, partnerships |
| 배송조회 | `GET /deliveries?scope=all` | deliveries, orders, organizations |

### 9.3 기공소 계정

| 화면 | API | 주요 테이블 |
|---|---|---|
| 배정 케이스 | `GET /orders?scope=lab` | orders, order_items |
| 제작 · 출고 | `POST /orders/:id/status`, `POST /deliveries` | orders, deliveries, delivery_items |
| 기공수가 | `GET /billing/usage?scope=lab` | order_items, price_items |

---

## 10. 스프린트 계획

각 스프린트는 2주 기준이다. 앞 스프린트의 결과물 위에 다음이 쌓이도록 배치했다.

### Sprint 0 — 기반 (2주)

| 작업 | 산출물 |
|---|---|
| Supabase 프로젝트(서울 리전) 생성 | |
| 마이그레이션 체계 · 시드 데이터 | organizations, user_profiles, memberships, 마스터 테이블 |
| Next.js 골격 · 라우트 그룹 · 테마 | 세 섹터 레이아웃 |
| 인증 · 조직 전환 | 로그인, JWT 클레임, 권한 가드 |
| RLS 기본 정책 · 감사 로그 골격 | |
| 1:1 전속 관계 · 환자 테이블(암호화 · 마스킹) | partnerships, patients |

**완료 기준** — 세 유형의 계정으로 로그인해 각자 다른 사이드바를 본다.

### Sprint 1 — 도메인 코어 (2주)

| 작업 |
|---|
| `server/domain/` 순수 함수 구현 — 치식 판정, 종류-재료 종속, 브릿지 자동 연결, 폰틱, 중복 등록 허용 조합, 쉐이드 이분할 |
| 단위 테스트 (규칙별 경계 케이스 포함) |
| 치식도 컴포넌트 (선택 · 브릿지 박스 · X 표기) |
| 쉐이드 피커 · 임플란트 계단식 피커 |

**완료 기준** — PRD 4.2의 모든 규칙이 테스트로 검증된다. **여기가 제품의 핵심이므로 서둘러 넘어가지 않는다.**

### Sprint 2 — 주문 등록 · 조회 (2주)

| 작업 |
|---|
| 주문등록 화면 + `POST /orders` |
| 파일 presigned 업로드 (대용량 STL 검증) |
| 주문목록 (필터 · 정렬 · 페이지네이션) |
| 주문상세 (읽기) |

**완료 기준** — 치과가 실제 STL을 올려 주문을 등록하고 목록에서 확인한다.

### Sprint 3 — 상태 흐름 · 디자인센터 (2주)

| 작업 |
|---|
| 상태 머신 + `POST /orders/:id/status` |
| 주문 수정 · 삭제 (접수 상태 제한) |
| 디자인센터 주문목록 · 상세 · 디자인 파일 업로드 |
| 재스캔 요청 · 메모 · 이력 |
| 디자인센터 HOME (작업 리스트) |

**완료 기준** — 치과 등록 → 디자인 작업 → 재스캔 반려까지 왕복이 동작한다.

### Sprint 4 — 임플란트 마스터 · 기공소 (2주)

| 작업 |
|---|
| 임플란트 마스터 CRUD (5단계 종속) |
| 치과 즐겨찾기 · 강제 배포 |
| 기공소 계정 신설 — 배정 케이스, 제작·출고 |
| 기공소 배정 기능 (**Q-2 확정 필요**) |
| 되돌리기 경로 검증 — 기공소는 역방향 전이 불가 |

**완료 기준** — 3섹터 전 구간이 한 케이스로 이어진다.

### Sprint 5 — 배송 · 알림 (2주)

| 작업 |
|---|
| 배송조회 주간 보드 (섹터별 범위) |
| 출고 · 송장 · 수거요청 (**Q-4, Q-5 확정 필요**) |
| 도메인 이벤트 · 알림 발송 (**Q-7 확정 필요**) |
| 알림 설정 연동 |

### Sprint 6 — 정산 (2주)

| 작업 |
|---|
| 단가표 관리 (**Q-1 확정 필요**) |
| 이용내역 자동 계산 · CSV |
| 청구서 생성 배치 · PDF |
| 조정 내역 · 입금 관리 (**Q-6 확정 필요**) |

### Sprint 7 — 운영 · 콘텐츠 (2주)

| 작업 |
|---|
| 사용자 관리 · 초대 흐름 |
| 계정 설정 전 탭 |
| 게시판 (공지 · FAQ · Q&A) |
| 플랫폼 관리자 콘솔 (조직 승인) |

### Sprint 8 — 안정화 (2주)

| 작업 |
|---|
| E2E 시나리오 (3섹터 왕복) |
| 부하 테스트 (대용량 파일 · 동시 주문) |
| 감사 로그 · 보존 정책 · 파티셔닝 |
| 개인정보 처리방침 · 보안 점검 |
| 시범 치과 2~3곳 온보딩 |

### 우선순위 원칙

1. **도메인 규칙 > 화면.** 치식·보철 규칙이 제품의 차별점이다. Sprint 1을 압축하지 않는다.
2. **한 흐름을 끝까지 뚫는다.** 화면을 넓게 벌리기보다 주문 하나가 3섹터를 관통하는 경로를 먼저 완성한다(Sprint 2~4).
3. **정산은 뒤에.** 단가표가 확정되지 않으면 계산 로직을 만들 수 없다.
4. **미정 항목이 막는 스프린트는 착수 전에 답을 받는다.**

---

## 부록 A. 즉시 답이 필요한 항목

**v0.2에서 확정된 항목**

| 항목 | 결정 |
|---|---|
| C-1 디자인 컨펌 | 모든 화면에서 숨김. 향후 업데이트 예정 |
| C-3 리메이크 | 주문유형이 아닌 **태그**. 배송·완료 상태에서 치과가 신청 → 신규 주문 `received` 진입 → 동일 흐름 → 청구 제외 |
| C-7 되돌리기 주체 | 디자인센터 → 치과 경로만. 기공소는 역방향 전이 불가 |
| Q-1 단가표 (부분) | 디자인센터가 설정. 치과별 · 보철물 종류별 · 치식별 구분 |
| Q-3 임시치아 | 기능 삭제 |
| Q-8 조직 관계 | 1:1 전속. 멀티테넌시 보류 |
| Q-9 환자 실명 | 저장하되 분리 보관 · 암호화 · 기공소 마스킹 |

**남은 항목**

| 우선순위 | 항목 | 막히는 스프린트 |
|---|---|---|
| 중간 | C-4 재스캔 상태의 수정 범위 | Sprint 3 |
| 중간 | Q-2 기공소 배정 시점 | Sprint 4 |
| 중간 | Q-11 치과의 디자인 파일 열람 허용 여부 | Sprint 3 |
| 중간 | Q-15 리페어 신청 가능 상태 확인 | Sprint 7 |
| 낮음 | Q-4~7 배송 · 알림 · 청구 주체 | Sprint 5~6 |

## 부록 B. 본 설계서에서 임의로 결정하지 않은 것

PRD의 어떤 기능도 삭제하거나 축소하지 않았다. PRD에 없던 것 중 본 설계서가 **추가 제안**한 항목은 다음과 같으며, 채택 여부는 결정 사항이다.

- 조직 간 거래 관계(`partnerships`)
- 주문 아이템 정규화 및 단가 스냅샷
- 상태 전이 규칙의 테이블화
- 도메인 이벤트 · 감사 로그
- 소프트 삭제 정책
- 파일 리비전 관리
- 플랫폼 관리자 콘솔
- 환자 정보 분리 저장
