-- =========================================================
-- DS Flow — 리페어 · 수거요청
-- Sprint 5
-- 파일 위치: supabase/migrations/<타임스탬프>_create_repair_and_pickup.sql
-- 기준: 시스템설계서 §4.5 리페어 생성 규칙(v0.4), §4.6 pickup_requests(Q-4)
--
-- 리페어는 새 주문입니다 (원주문을 고치지 않습니다).
--   원주문을 건드리면 정산 근거가 흔들립니다 (§4.5.2).
--   대신 parent_order_id 로 잇고 is_repair 태그를 답니다.
--
-- 리페어에는 수거가 따라옵니다.
--   고칠 보철물을 기공소가 가져가야 하기 때문입니다.
--   기공소는 이 요청을 보고 택배사에 수동으로 접수합니다.
-- =========================================================

-- ---------- 주문에 리페어 태그 ----------
alter table orders add column is_repair       boolean not null default false;
alter table orders add column is_billable     boolean not null default true;
alter table orders add column parent_order_id uuid references orders(id);

comment on column orders.is_repair       is '리페어 태그. 청구에서 제외됩니다 (설계서 §4.5)';
comment on column orders.is_billable     is '청구 대상 여부. 리페어·리메이크는 false';
comment on column orders.parent_order_id is '무엇을 고치는가. 원주문을 가리킵니다';

create index orders_parent_idx on orders (parent_order_id);

-- ---------- 수거요청 (Q-4 확정: 치과가 요청하고 기공소가 처리) ----------
create type pickup_kind as enum (
  'prosthesis',   -- 리페어할 보철물
  'model',        -- 모델
  'impression'    -- 인상체
);

create type pickup_status as enum (
  'open',        -- 수거대기 — 기공소 HOME 의 카운트가 이것입니다
  'assigned',    -- 기공소가 택배사에 접수함
  'done',
  'cancelled'
);

create table pickup_requests (
  id            uuid primary key default gen_random_uuid(),

  clinic_org_id uuid not null references organizations(id) on delete cascade,
  lab_org_id    uuid references organizations(id),      -- 배정 전이면 비어 있습니다

  -- 무엇 때문에 수거하는가. 리페어면 새로 만들어진 주문을 가리킵니다.
  order_id      uuid references orders(id) on delete cascade,

  kind          pickup_kind   not null default 'prosthesis',
  status        pickup_status not null default 'open',

  memo          text,                                   -- 치과가 적은 요청사항
  requested_by_user_id uuid references user_profiles(id),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  handled_at    timestamptz
);

comment on table  pickup_requests      is '치과가 요청하고 기공소가 처리하는 수거 (설계서 Q-4)';
comment on column pickup_requests.memo is '치과가 적은 요청사항. 기공소가 그대로 봅니다';

create index pickup_requests_lab_idx    on pickup_requests (lab_org_id, status);
create index pickup_requests_clinic_idx on pickup_requests (clinic_org_id, created_at desc);

create trigger pickup_requests_touch
  before update on pickup_requests
  for each row execute function touch_updated_at();

-- ---------- 접근 정책 ----------
alter table pickup_requests enable row level security;

-- 요청한 치과와 처리할 기공소만 봅니다.
-- 디자인센터는 중간에서 흐름을 봐야 하므로 거래 치과 것을 함께 봅니다.
create policy pickup_select on pickup_requests
  for select using (
    clinic_org_id = my_org_id()
    or lab_org_id = my_org_id()
    or (my_org_type() = 'design_center' and is_partner_org(clinic_org_id))
  );

-- 요청은 치과만 (Q-4)
create policy pickup_insert on pickup_requests
  for insert with check (
    clinic_org_id = my_org_id() and my_org_type() = 'clinic'
  );

-- 처리는 기공소만. 치과는 상태를 바꾸지 못합니다.
create policy pickup_update on pickup_requests
  for update using (lab_org_id = my_org_id() and my_org_type() = 'lab');
