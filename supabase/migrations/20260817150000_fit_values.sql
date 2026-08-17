-- =========================================================
-- DS Flow — 치과별 내면값 (사용자 요청 2026-08-17)
-- 파일 위치: supabase/migrations/20260817150000_fit_values.sql
--
-- 치과마다 다른 CAD 설계 수치입니다. 보철이 치아에 얼마나 헐겁게
-- (시멘트 갭) · 옆니와 얼마나 꽉(컨택) 앉을지를 치과 취향대로 적어
-- 두고, 디자이너가 주문을 열 때마다 봅니다.
--
-- ★ 치과 조직에 한 줄입니다 (clinic_org_id 가 pk).
--   주문마다가 아닙니다 — 이 값은 '그 치과의 취향' 이라 주문에 붙이면
--   치과가 취향을 바꿨을 때 지난 주문 수백 줄을 고쳐야 합니다.
--
-- ★ 변경 이력을 따로 쌓습니다 (fit_value_changes).
--   "값이 바뀌면 웹페이지에서 알려야" 합니다. 이력의 단위는 숫자가
--   아니라 '자연치 0.02 → 0.04' 라는 **말**이고, 그 말은 저장하는
--   순간의 필드 이름으로 굳습니다(jsonb) — 나중에 필드가 늘거나
--   이름이 바뀌어도 지난 이력이 그대로 읽힙니다. 말을 만드는 곳은
--   domain/fit-value 의 diffFitValues 하나입니다.
--
-- ★ 보는 것은 디자인센터 전원, 고치는 것은 관리자만.
--   디자이너는 이 값으로 일하지만, 값을 정하는 것은 치과와 통화하는
--   관리자입니다. 치과·기공소에는 아예 안 보입니다 — 설계 내부
--   수치라 보여 줄 이유가 없고, 치과가 보면 전화가 옵니다.
-- =========================================================

create table clinic_fit_values (
  clinic_org_id  uuid primary key references organizations(id) on delete cascade,

  -- 보철 재료별 (mm). null = 아직 안 정함
  natural_tooth  numeric(6,3),
  cnc            numeric(6,3),
  inlay          numeric(6,3),
  pla            numeric(6,3),
  pmma           numeric(6,3),

  -- 컨택 (음수가 보통입니다 — 그만큼 꽉 물립니다)
  contact_adj    numeric(6,3),
  contact_single numeric(6,3),

  hook           boolean not null default false,
  implant_note   text,
  note           text,

  updated_by     uuid references user_profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table  clinic_fit_values                is '치과별 내면값. 디자이너가 CAD 에 넣는 수치';
comment on column clinic_fit_values.contact_adj    is '맞결 컨택. 시안의 맞결 칸';
comment on column clinic_fit_values.contact_single is '단일 컨택. 시안의 단일 칸';

create trigger clinic_fit_values_touch
  before update on clinic_fit_values
  for each row execute function touch_updated_at();

-- ---------- 변경 이력 ----------

create table fit_value_changes (
  id             uuid primary key default gen_random_uuid(),
  clinic_org_id  uuid not null references organizations(id) on delete cascade,
  -- [{"label":"자연치","from":"0.02","to":"0.04"}, ...]
  changes        jsonb not null,
  created_by     uuid references user_profiles(id),
  created_at     timestamptz not null default now()
);

comment on table fit_value_changes is
  '내면값 변경 이력. 주문상세 카드의 최근 변경이 여기서 나옵니다';

create index fit_value_changes_clinic_idx
  on fit_value_changes (clinic_org_id, created_at desc);

-- ---------- 잠그기 ----------

alter table clinic_fit_values enable row level security;
alter table fit_value_changes enable row level security;

-- 보기는 디자인센터 전원.
-- (여기는 허용 정책이라 my_org_type() 이 null 이면 null = false 로 그냥 안 열립니다 —
--  거부 조건의 null 함정과는 반대 방향입니다)
create policy fit_select on clinic_fit_values
  for select using (my_org_type() = 'design_center');

create policy fit_change_select on fit_value_changes
  for select using (my_org_type() = 'design_center');

-- 고치기는 디자인센터 관리자만. 내 거래처(끊긴 곳 포함)에만 씁니다
create policy fit_write on clinic_fit_values
  for all
  using (
    my_org_type() = 'design_center'
    and my_role() in ('owner', 'admin')
  )
  with check (
    my_org_type() = 'design_center'
    and my_role() in ('owner', 'admin')
    and is_my_partner_any_status(clinic_org_id)
  );

create policy fit_change_insert on fit_value_changes
  for insert
  with check (
    my_org_type() = 'design_center'
    and my_role() in ('owner', 'admin')
    and is_my_partner_any_status(clinic_org_id)
  );

-- 이력은 고치거나 지우는 정책이 없습니다 — "그런 안내 못 받았다" 가
-- 나올 때의 근거라, 관리자도 못 지웁니다.
