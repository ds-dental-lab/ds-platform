-- =========================================================
-- DS Flow — 보관기간과 파기
-- 파일 위치: supabase/migrations/<타임스탬프>_retention.sql
--
-- 법률 검토(2026-08-12)에서 나온 항목입니다.
-- 지금까지 **아무것도 진짜로 안 지워졌습니다** — deleted_at 을 세워
-- 화면에서 가릴 뿐이고, 저장소의 덩어리와 열람 기록은 그대로 쌓입니다.
--
-- ★ 기간을 코드에 박지 않습니다.
--   얼마나 보관할지는 법과 그 조직의 판단입니다. 제가 정할 수 없고,
--   정해 두면 바꿀 때 배포가 필요합니다. 표에 두고 화면에서 고칩니다.
--
-- ★ 파기는 **사람이 누릅니다.** 저절로 안 돕니다.
--   지우는 일은 되돌릴 수 없습니다. 밤사이 배치가 돌아 환자 파일이
--   사라졌는데 아무도 그날 무엇이 지워졌는지 모르는 상태가 제일 나쁩니다.
--   무엇이 몇 건 지워질지 먼저 보여 주고, 누르면 그때 지웁니다.
--
-- ★ 지운 기록은 남깁니다 (retention_runs).
--   "그 파일 어디 갔냐" 에 답할 수 있어야 합니다. 무엇을 몇 건,
--   언제, 누가 지웠는지만 남기고 **내용은 안 남깁니다** —
--   파기 기록이 개인정보 사본이 되면 안 됩니다.
-- =========================================================

-- 무엇을 지우는가
create type retention_target as enum (
  'soft_deleted',  -- 지운 표시만 해 둔 줄 (주문·파일)
  'audit_log',     -- 열람 기록
  'order_file'     -- 끝난 주문의 스캔·디자인 파일
);

create table retention_settings (
  org_id     uuid not null references organizations(id) on delete cascade,
  target     retention_target not null,

  -- 며칠 지나면 지우는가. null 이면 **안 지웁니다** (아직 안 정함)
  keep_days  integer check (keep_days is null or keep_days between 1 and 3650),

  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),

  primary key (org_id, target)
);

comment on table retention_settings is '보관기간. null 이면 아직 안 정한 것이고 파기하지 않습니다';
comment on column retention_settings.keep_days is
  '이 날 수가 지난 것을 지웁니다. 기준일은 항목마다 다릅니다 (domain/retention)';

-- ---------- 파기 기록 ----------
--
-- ★ 무엇을 몇 건 지웠는지만. 내용은 안 남깁니다.

create table retention_runs (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  target     retention_target not null,

  keep_days  integer not null,
  -- 이 시각 이전 것을 지웠습니다
  cutoff     timestamptz not null,
  removed    integer not null,

  ran_by     uuid references auth.users(id),
  ran_at     timestamptz not null default now()
);

create index retention_runs_org_idx on retention_runs (org_id, ran_at desc);

comment on table retention_runs is '언제 무엇을 몇 건 파기했는가. "그 파일 어디 갔냐" 에 답하는 기록';

-- ---------- 정책 ----------
--
-- ★ 자기 조직 것만. 그리고 관리자만입니다 (금액과 같은 문).

alter table retention_settings enable row level security;
alter table retention_runs enable row level security;

create policy retention_settings_select on retention_settings
  for select using (org_id = my_org_id());

create policy retention_settings_write on retention_settings
  for all
  using (org_id = my_org_id() and my_role() in ('owner', 'admin'))
  with check (org_id = my_org_id() and my_role() in ('owner', 'admin'));

create policy retention_runs_select on retention_runs
  for select using (org_id = my_org_id());

create policy retention_runs_insert on retention_runs
  for insert with check (
    org_id = my_org_id() and my_role() in ('owner', 'admin')
  );

-- ★ 파기 기록은 고치거나 지울 수 없습니다 (열람 기록과 같은 이유).
--   update·delete 정책을 안 만듭니다.

-- ---------- 열람 기록을 지울 수 있게 ----------
--
-- audit_logs 에는 delete 정책이 없었습니다 (일부러 — 고치거나 지울 수
-- 없어야 하니까). 파기는 예외입니다: **보관기간이 지난 것만**,
-- 관리자만, 자기 조직 것만.

create policy audit_purge on audit_logs
  for delete using (
    actor_org_id = my_org_id()
    and my_role() in ('owner', 'admin')
    and created_at < now() - interval '1 day'
  );

comment on policy audit_purge on audit_logs is
  '보관기간 파기용. 오늘 것은 못 지웁니다 — 방금 남은 기록을 지우는 길을 안 엽니다';
