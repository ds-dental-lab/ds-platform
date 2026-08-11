-- =========================================================
-- DS Flow — 정산 기간을 거래처별로 쪼갭니다
-- 파일 위치: supabase/migrations/<타임스탬프>_billing_per_partner.sql
-- 기준: 사용자 결정 2026-08-11 — "치과마다 정산일이 다르니깐"
--
-- 무엇이 바뀌나.
--   전에는 정산 기간이 디자인센터 하나에 달마다 하나였습니다.
--   그런데 정산 기준일이 거래처 설정입니다 (organizations.closing_day).
--     1일  치과 → 08-01 ~ 08-31
--     26일 치과 → 07-26 ~ 08-25
--   한 기간에 둘을 담을 수 없습니다. 거래처마다 따로 세웁니다.
--
-- ★ 기공소도 같은 표를 씁니다.
--   화면의 '사용자 타입' 이 치과·기공소를 갈아끼웁니다.
--   치과에는 청구하고 기공소에는 지급하지만, '기간을 끊고 마감한다' 는
--   똑같습니다. 표를 둘로 나누면 마감 로직이 두 벌이 됩니다.
--
-- ★ 그래서 billing_lines 의 lab_cost 를 걷어냅니다.
--   한 줄에 청구액과 지급액이 함께 있으면, 둘의 기간이 다를 때
--   그 줄이 어느 기간에 속하는지 말할 수 없습니다.
--   이제 줄은 '누구에게 얼마' 하나만 말하고, 상대는 기간이 압니다.
--
-- ★ 기간의 날짜와 기준일을 **박아 둡니다**.
--   치과가 나중에 26일 → 1일로 바꿔도 지난 정산의 기간이 흔들리면 안 됩니다.
--   단가 스냅샷은 미뤘지만 기간 경계는 미룰 수 없습니다 —
--   이미 나간 청구서의 '이용기간' 줄이 소급해서 달라집니다.
--
-- 표에 아무 줄도 없어(0행) 갈아엎습니다.
-- =========================================================

drop trigger if exists billing_lines_open_only on billing_lines;
drop table if exists billing_lines;
drop table if exists billing_periods;

-- 표를 지워도 열거형은 남습니다. 아래에서 다시 만들므로 함께 걷어냅니다
drop type if exists billing_line_kind;

-- ---------- 정산 기간 (거래처마다) ----------

create table billing_periods (
  id            uuid primary key default gen_random_uuid(),

  -- 정산하는 쪽 (디자인센터)
  owner_org_id  uuid not null references organizations(id) on delete cascade,
  -- 정산받는 쪽 (치과 또는 기공소)
  party_org_id  uuid not null references organizations(id) on delete cascade,

  -- '2026-08'. **끝나는 달**로 이름을 붙입니다.
  -- 1일 기준의 08-01~08-31 도, 26일 기준의 07-26~08-25 도 2026-08 입니다
  year_month    text not null check (year_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),

  -- ★ 그때의 규칙을 박아 둡니다. 나중에 기준일을 바꿔도 이 줄은 그대로입니다
  closing_day   smallint not null check (closing_day between 1 and 28),
  period_from   date not null,
  period_to     date not null,

  closed_at     timestamptz,
  closed_by     uuid references user_profiles(id),

  -- 청구서를 언제 뽑았고 언제 받았는가 (화면의 '청구서 상태')
  issued_at     timestamptz,
  paid_at       timestamptz,

  created_at    timestamptz not null default now(),

  constraint billing_periods_range check (period_from <= period_to)
);

comment on table  billing_periods             is '거래처별 정산 기간. 기준일이 달라 거래처마다 경계가 다릅니다';
comment on column billing_periods.party_org_id is '정산받는 거래처. 치과면 청구, 기공소면 지급';
comment on column billing_periods.closing_day  is '마감 당시의 정산 기준일. 나중에 바뀌어도 지난 정산은 이 값으로 남습니다';
comment on column billing_periods.closed_at    is '비어 있으면 아직 열려 있습니다. 새 금액은 열린 기간에만 붙습니다';
comment on column billing_periods.paid_at      is '비어 있으면 미입금';

create unique index billing_periods_unique_idx on billing_periods (party_org_id, year_month);
create index billing_periods_open_idx  on billing_periods (owner_org_id, closed_at);
create index billing_periods_range_idx on billing_periods (party_org_id, period_from, period_to);

-- ---------- 정산줄 ----------

create type billing_line_kind as enum (
  'base',         -- 보철 기본 금액
  'surcharge',    -- 치은포셀린 등 추가 항목
  'remake_diff',  -- 리메이크에서 사양이 바뀌어 생긴 차액
  'adjustment'    -- 손으로 넣은 조정 (몽키스패너)
);

create table billing_lines (
  id            uuid primary key default gen_random_uuid(),
  period_id     uuid not null references billing_periods(id) on delete restrict,

  order_id      uuid not null references orders(id) on delete restrict,
  order_item_id uuid references order_items(id) on delete set null,

  kind          billing_line_kind not null,

  -- ★ 이 기간의 상대에게 붙는 금액 하나입니다.
  --   치과 기간이면 청구액, 기공소 기간이면 지급액.
  --   깎는 것이면 음수입니다.
  amount        integer not null,

  reason        text,
  created_by    uuid references user_profiles(id),
  created_at    timestamptz not null default now()
);

comment on table  billing_lines        is '정산에 올라가는 금액 한 줄. 기간 딱지가 붙으면 다시 고치지 않습니다';
comment on column billing_lines.amount is '기간의 상대에게 붙는 금액. 치과=청구, 기공소=지급. 깎으면 음수';

create index billing_lines_period_idx on billing_lines (period_id, kind);
create index billing_lines_order_idx  on billing_lines (order_id);

-- 마감된 기간은 건드리지 못합니다 (설계서 §5.3 결정 2 — DB 에서도 막습니다)
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

-- ---------- 조정 (몽키스패너) ----------
--
-- ★ 원래 금액을 덮어쓰지 않습니다.
--   치식 42번을 50,000 → 30,000 으로 깎았을 때 원금액을 고쳐 버리면
--   "얼마였는데 왜 깎았나" 가 사라집니다. 원금액은 그대로 두고
--   차액 한 줄을 덧댑니다. '조정 내역' 탭이 이것으로 저절로 찹니다.
--
-- ★ 마감 전에는 여기 있고, 마감하면 billing_lines 로 굳습니다.
--   열린 기간의 정산 화면은 주문에서 실시간으로 셈하기 때문에
--   붙일 period_id 가 아직 없습니다.
create table billing_adjustments (
  id            uuid primary key default gen_random_uuid(),
  owner_org_id  uuid not null references organizations(id) on delete cascade,

  order_id      uuid not null references orders(id) on delete cascade,
  -- 비어 있으면 주문 전체에 붙는 조정입니다
  order_item_id uuid references order_items(id) on delete cascade,

  -- 어느 쪽 금액을 건드리는가. 치과 청구인지 기공소 지급인지
  party_org_id  uuid not null references organizations(id) on delete cascade,

  amount        integer not null,
  reason        text not null,

  -- 굳은 뒤에는 이 줄을 못 고칩니다
  posted_line_id uuid references billing_lines(id) on delete set null,

  created_by    uuid references user_profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table  billing_adjustments        is '치식별 금액 조정. 원금액은 그대로 두고 차액을 덧댑니다';
comment on column billing_adjustments.reason is '왜 깎았는지. 비워 둘 수 없습니다 — 나중에 아무도 이유를 모릅니다';
comment on column billing_adjustments.posted_line_id is '마감 때 굳은 정산줄. 차 있으면 더는 못 고칩니다';

create index billing_adjustments_order_idx on billing_adjustments (order_id);
create index billing_adjustments_party_idx on billing_adjustments (party_org_id, created_at);

-- ---------- 접근 정책 (설계서 §8.4) ----------

alter table billing_periods     enable row level security;
alter table billing_lines       enable row level security;
alter table billing_adjustments enable row level security;

-- 기간 — 디자인센터가 만들고 마감합니다. 거래처는 자기 것만 읽습니다
create policy billing_period_select on billing_periods
  for select using (
    owner_org_id = my_org_id()
    or party_org_id = my_org_id()
  );

create policy billing_period_write on billing_periods
  for all using (owner_org_id = my_org_id() and my_org_type() = 'design_center')
  with check (owner_org_id = my_org_id() and my_org_type() = 'design_center');

-- ★ 정산줄은 그 기간의 상대에게만 보입니다.
--   치과가 기공소 지급액을 보면 원가가 드러납니다 (§8.5).
--   기간을 거쳐 보게 해서, 치과 기간의 줄은 치과만 봅니다.
create policy billing_line_select on billing_lines
  for select using (
    exists (
      select 1 from billing_periods p
      where p.id = billing_lines.period_id
        and (p.owner_org_id = my_org_id() or p.party_org_id = my_org_id())
    )
  );

create policy billing_line_write on billing_lines
  for all using (
    my_org_type() = 'design_center'
    and exists (
      select 1 from billing_periods p
      where p.id = billing_lines.period_id and p.owner_org_id = my_org_id()
    )
  )
  with check (
    my_org_type() = 'design_center'
    and exists (
      select 1 from billing_periods p
      where p.id = billing_lines.period_id and p.owner_org_id = my_org_id()
    )
  );

-- 조정 — 디자인센터만 만들고, 상대는 자기 것만 봅니다
create policy billing_adjustment_select on billing_adjustments
  for select using (
    owner_org_id = my_org_id()
    or party_org_id = my_org_id()
  );

create policy billing_adjustment_write on billing_adjustments
  for all using (owner_org_id = my_org_id() and my_org_type() = 'design_center')
  with check (owner_org_id = my_org_id() and my_org_type() = 'design_center');

create trigger billing_adjustments_touch
  before update on billing_adjustments
  for each row execute function touch_updated_at();
