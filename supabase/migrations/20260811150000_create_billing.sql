-- =========================================================
-- DS Flow — 정산 (기간 · 정산줄 · 단가표)
-- 파일 위치: supabase/migrations/<타임스탬프>_create_billing.sql
-- 기준: 사용자 결정 2026-08-11, 설계서 §3.7 가격 버전 관리, Q-1 · Q-14
--
-- 큰 틀 (사용자 확정)
--   기간 귀속   실제 배송일(shipped_at). 요청시한이 아닙니다
--   대상        배송으로 넘어간 건
--   마감        디자인센터가 매달 손으로 누릅니다 (나중에 자동으로)
--   추가금액    그때 열려 있는 기간에 붙습니다. 마감됐으면 다음 기간으로
--
-- ★ 딱지는 주문이 아니라 '금액 줄' 에 붙습니다.
--   한 주문의 기본금액은 8월, 나중에 생긴 리메이크 차액은 9월일 수 있습니다.
--   주문에 붙이면 이 경우를 적을 자리가 없습니다.
--
-- ★ 딱지가 찍힌 줄은 다시 건드리지 않습니다.
--   뭐가 바뀌면 새 줄을 만들어 열린 기간에 찍습니다. 그래야 "8월 정산서를
--   다시 뽑았는데 금액이 다르다" 는 일이 생기지 않습니다.
-- =========================================================

-- ---------- 단가표 (Q-1 · Q-14) ----------
--
-- 설정 주체는 디자인센터, 치과별로 다른 금액을 줄 수 있습니다.
-- 구분은 보철물 종류 · 재료 · 치식(전치/구치) 세 가지입니다.
create type tooth_group as enum ('anterior', 'posterior');   -- 전치 · 구치

create table price_lists (
  id                   uuid primary key default gen_random_uuid(),
  owner_org_id         uuid not null references organizations(id) on delete cascade,
  -- 비어 있으면 기본 단가. 채워져 있으면 그 치과 전용입니다
  target_clinic_org_id uuid references organizations(id) on delete cascade,

  type_code            text not null,
  material_code        text not null,
  tooth_group          tooth_group not null,

  -- 치과에 청구하는 값과 기공소에 지급하는 값 (Q-6)
  price                integer not null check (price >= 0),
  lab_cost             integer not null default 0 check (lab_cost >= 0),

  -- ★ 단가는 시점에 따라 바뀝니다 (설계서 §3.7).
  --   지난 정산이 흔들리지 않도록 기간을 두고, 주문에는 그때 값을 박아 둡니다.
  effective_from       date not null default current_date,
  effective_to         date,

  created_at           timestamptz not null default now()
);

comment on table  price_lists              is '기공수가 단가표. 디자인센터가 정하고 치과별로 다르게 줄 수 있습니다';
comment on column price_lists.lab_cost     is '기공소에 지급하는 원가. 자사 제작이면 지급이 없어 정산에서 빠집니다';
comment on column price_lists.effective_to is '비어 있으면 아직 유효합니다';

create index price_lists_lookup_idx
  on price_lists (owner_org_id, type_code, material_code, tooth_group, effective_from desc);

-- 같은 조건에 같은 시작일이 두 줄이면 어느 것을 쓸지 알 수 없습니다
create unique index price_lists_unique_idx
  on price_lists (
    owner_org_id,
    coalesce(target_clinic_org_id, '00000000-0000-0000-0000-000000000000'::uuid),
    type_code, material_code, tooth_group, effective_from
  );

-- ---------- 정산 기간 ----------
--
-- ★ 마감일을 코드에 박지 않습니다.
--   지금은 디자인센터가 26일이나 다음달 1일에 손으로 누르고, 나중에
--   자동으로 바꿉니다. 언제 눌렸는지는 closed_at 이 말해 줍니다 —
--   규칙이 바뀌어도 스키마는 그대로입니다.
create table billing_periods (
  id            uuid primary key default gen_random_uuid(),
  owner_org_id  uuid not null references organizations(id) on delete cascade,

  -- '2026-08'. 배송일이 이 달에 든 건이 여기로 모입니다
  year_month    text not null check (year_month ~ '^\d{4}-\d{2}$'),

  closed_at     timestamptz,
  closed_by     uuid references user_profiles(id),

  created_at    timestamptz not null default now()
);

comment on table  billing_periods           is '정산 기간. 마감하면 그 기간의 정산줄은 잠깁니다';
comment on column billing_periods.closed_at is '비어 있으면 아직 열려 있습니다. 새 금액은 열린 기간에만 붙습니다';

create unique index billing_periods_unique_idx on billing_periods (owner_org_id, year_month);
create index billing_periods_open_idx on billing_periods (owner_org_id, closed_at);

-- ---------- 정산줄 ----------
create type billing_line_kind as enum (
  'base',         -- 주문 기본 금액
  'surcharge',    -- 치은포셀린 등 추가 항목
  'remake_diff',  -- 리메이크에서 사양이 바뀌어 생긴 차액
  'adjustment'    -- 손으로 넣은 조정 (몽키스패너)
);

create table billing_lines (
  id          uuid primary key default gen_random_uuid(),
  period_id   uuid not null references billing_periods(id) on delete restrict,

  order_id      uuid not null references orders(id) on delete restrict,
  order_item_id uuid references order_items(id) on delete set null,

  kind        billing_line_kind not null,

  -- 치과에 청구할 값. 차감이면 음수입니다
  amount      integer not null,
  -- 기공소에 지급할 값. 자사 제작이면 0 입니다 (Q-6)
  lab_cost    integer not null default 0,

  reason      text,
  created_by  uuid references user_profiles(id),
  created_at  timestamptz not null default now()
);

comment on table  billing_lines        is '정산에 올라가는 금액 한 줄. 기간 딱지가 붙으면 다시 고치지 않습니다';
comment on column billing_lines.amount is '치과 청구액. 리메이크로 사양을 내렸으면 음수가 됩니다';

create index billing_lines_period_idx on billing_lines (period_id, kind);
create index billing_lines_order_idx  on billing_lines (order_id);

-- ★ 마감된 기간에는 줄을 넣지도 고치지도 못하게 막습니다.
--   서버 코드에서도 보지만, 여기서 막아야 진짜 잠깁니다 (설계서 §5.3 결정 2).
create or replace function billing_period_is_open(target uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select closed_at is null from billing_periods where id = target;
$$;

create or replace function reject_closed_period()
returns trigger
language plpgsql as $$
begin
  if not billing_period_is_open(new.period_id) then
    raise exception '마감된 정산 기간에는 금액을 넣을 수 없습니다';
  end if;
  return new;
end;
$$;

create trigger billing_lines_open_only
  before insert or update on billing_lines
  for each row execute function reject_closed_period();

-- ---------- 접근 정책 (설계서 §8.4) ----------
alter table price_lists     enable row level security;
alter table billing_periods enable row level security;
alter table billing_lines   enable row level security;

-- 단가표 — 디자인센터가 정하고, 그 치과는 자기 것만 봅니다.
-- ★ 기공소에는 열지 않습니다. 치과 청구가가 보이면 안 됩니다 (§8.5).
create policy price_list_select on price_lists
  for select using (
    owner_org_id = my_org_id()
    or (my_org_type() = 'clinic' and target_clinic_org_id = my_org_id())
  );

create policy price_list_write on price_lists
  for all using (owner_org_id = my_org_id() and my_org_type() = 'design_center')
  with check (owner_org_id = my_org_id() and my_org_type() = 'design_center');

-- 기간 — 디자인센터만
create policy billing_period_all on billing_periods
  for all using (owner_org_id = my_org_id() and my_org_type() = 'design_center')
  with check (owner_org_id = my_org_id() and my_org_type() = 'design_center');

-- 정산줄 — 디자인센터가 만들고, 치과는 자기 주문 것만 읽습니다
create policy billing_line_select on billing_lines
  for select using (
    exists (
      select 1 from orders o
      where o.id = billing_lines.order_id
        and (o.design_org_id = my_org_id() or o.clinic_org_id = my_org_id())
    )
  );

create policy billing_line_write on billing_lines
  for all using (
    my_org_type() = 'design_center'
    and exists (select 1 from orders o where o.id = billing_lines.order_id and o.design_org_id = my_org_id())
  )
  with check (
    my_org_type() = 'design_center'
    and exists (select 1 from orders o where o.id = billing_lines.order_id and o.design_org_id = my_org_id())
  );
