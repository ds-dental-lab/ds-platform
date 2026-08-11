-- =========================================================
-- DS Flow — 접속기록 (개인정보 열람 로그)
-- 파일 위치: supabase/migrations/<타임스탬프>_create_audit_logs.sql
-- 기준: 설계서 §3.5
--
-- 왜 필요한가.
--   이 시스템은 환자 이름·차트번호와 '어느 이를 어떻게 치료했나' 를 함께
--   다룹니다. 그리고 그 이름이 치과 → 디자인센터 → 기공소로 건너갑니다.
--   지금까지는 **누가 언제 무엇을 봤는지가 아무 데도 안 남았습니다.**
--   문제가 생겼을 때 "우리 쪽에서 샌 게 아니다" 를 말할 근거가 없습니다.
--
-- 무엇을 남기는가.
--   환자 이름이 실제로 화면 밖으로 나간 순간만 남깁니다 —
--     주문 상세를 열었다 · 주문 목록을 조회했다 ·
--     환자를 검색했다 · 파일을 내려받았다
--   버튼 클릭 하나하나를 남기면 로그가 불어나 아무도 안 봅니다.
--
-- ★ 고칠 수도 지울 수도 없습니다.
--   update·delete 정책을 **만들지 않습니다**. 정책이 없으면 아무도 못 합니다.
--   기록이 고쳐질 수 있으면 기록이 아닙니다.
--
-- ★ 자기 조직이 한 일만 봅니다.
--   이 표는 '우리 직원이 무엇을 봤나' 입니다. 남의 조직 기록을 열면
--   그 자체가 또 다른 열람이 됩니다.
--
-- ★ 이름을 다시 적지 않습니다.
--   무엇을 봤는지는 대상 id 로 가리킵니다. 로그에 이름을 또 쌓으면
--   개인정보를 한 벌 더 만드는 셈입니다.
-- =========================================================

create type audit_action as enum (
  'order.view',      -- 주문 상세를 열었다
  'order.list',      -- 주문 목록을 조회했다 (여러 명이 한 번에)
  'patient.search',  -- 환자를 검색했다
  'file.download'    -- 파일을 내려받았다
);

create table audit_logs (
  id            bigint generated always as identity primary key,

  -- 누가
  actor_user_id uuid references user_profiles(id) on delete set null,
  actor_org_id  uuid not null references organizations(id) on delete cascade,

  -- 무엇을
  action        audit_action not null,
  /** 대상. 주문·파일이면 그 id, 검색이면 비어 있습니다 */
  target_id     uuid,
  /**
   * 이번 열람에 몇 명의 환자 정보가 실렸는가.
   * 목록 조회는 한 번에 수십 명이 나갑니다 — 건수를 알아야 뜻이 있습니다.
   */
  subject_count integer not null default 1 check (subject_count >= 0),

  /** 검색어 등 짧은 맥락. 환자 이름 자체는 담지 않습니다 */
  detail        text,

  created_at    timestamptz not null default now()
);

comment on table  audit_logs is
  '개인정보 열람 기록. 고치거나 지울 수 없습니다 (설계서 §3.5)';
comment on column audit_logs.subject_count is
  '이번 열람에 실린 환자 수. 목록 조회는 한 번에 여럿입니다';
comment on column audit_logs.detail is
  '짧은 맥락. 환자 이름은 담지 않습니다 — 로그가 또 하나의 개인정보가 됩니다';

-- 조회는 '우리 조직, 최근 순' 이 거의 전부입니다
create index audit_logs_org_time_idx on audit_logs (actor_org_id, created_at desc);
create index audit_logs_actor_idx    on audit_logs (actor_user_id, created_at desc);
create index audit_logs_target_idx   on audit_logs (target_id) where target_id is not null;

-- ---------- 접근 정책 ----------
alter table audit_logs enable row level security;

-- 남기는 것은 로그인한 사람이면 누구나 (자기 조직 앞으로만)
create policy audit_log_insert on audit_logs
  for insert with check (actor_org_id = my_org_id());

-- ★ 읽는 것은 그 조직의 관리자만입니다.
--   개인정보 열람 기록 자체가 민감합니다 — 누가 누구를 들여다봤는지가 보입니다.
create policy audit_log_select on audit_logs
  for select using (
    actor_org_id = my_org_id() and my_role() in ('owner', 'admin')
  );

-- ★ update · delete 정책은 일부러 만들지 않습니다.
--   정책이 없으면 아무도 못 합니다. 기록이 고쳐질 수 있으면 기록이 아닙니다.
--   보관기간이 지난 것을 지우는 일은 나중에 service_role 로 도는
--   배치가 맡습니다 (RLS 를 지나가는 열쇠입니다).
