-- =========================================================
-- DS Flow — 주문
-- Sprint 3
-- 파일 위치: supabase/migrations/<타임스탬프>_create_orders.sql
-- 기준: 시스템설계서 §4.5
--
-- Sprint 3 에 필요한 것만 넣습니다.
-- 정산 금액은 Sprint 8, 리메이크 계보는 Sprint 5 에서 컬럼을 추가합니다.
-- =========================================================

-- ---------- 열거형 ----------
-- 이름은 설계서 §4.5.1 그대로입니다. 코드의 OrderStatus 와 같아야 합니다.
create type order_status as enum (
  'received',         -- 접수
  'rescan',           -- 재스캔
  'designing',        -- 디자인
  'production_wait',  -- 제작대기
  'production',       -- 제작
  'shipping',         -- 배송
  'completed',        -- 완료
  'cancelled'         -- 취소
);

create type order_type as enum (
  'modelless',   -- 모델리스
  'with_model',  -- 모델 포함
  'model_only',  -- 모델만
  'repair'       -- 리페어
);

-- ---------- 주문 ----------
create table orders (
  id             uuid primary key default gen_random_uuid(),
  order_no       text        not null unique,   -- ORD-YYMMDD-###

  clinic_org_id  uuid not null references organizations(id),
  design_org_id  uuid          references organizations(id),
  lab_org_id     uuid          references organizations(id),   -- 치과에 미노출

  patient_id     uuid          references patients(id),
  patient_label  text not null,                                -- 목록 표시용 캐시

  order_type     order_type   not null default 'modelless',
  status         order_status not null default 'received',
  due_date       date         not null,                        -- 요청시한

  notes          text,                                          -- 기타 요청사항

  created_by     uuid references user_profiles(id),
  received_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

comment on table  orders               is '주문. 치과가 등록하고 디자인센터·기공소로 흐릅니다';
comment on column orders.lab_org_id    is '배정 기공소. 치과에는 노출하지 않습니다 (설계서 §8.5)';
comment on column orders.patient_label is '목록 표시용. 기공소 응답에서는 마스킹 값으로 치환합니다';

create index orders_clinic_idx  on orders (clinic_org_id, created_at desc);
create index orders_design_idx  on orders (design_org_id, status);
create index orders_lab_idx     on orders (lab_org_id, status);
create index orders_due_idx     on orders (due_date);
create index orders_status_idx  on orders (status);

create trigger orders_touch
  before update on orders
  for each row execute function touch_updated_at();

-- ---------- 주문 항목 ----------
-- ★ 치아 하나 = 행 하나. 중복 등록된 치아는 slot 1·2 로 두 행입니다.
create table order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,

  tooth_number  smallint not null,
  slot          smallint not null default 1,

  -- 마스터 테이블이 아직 없으므로 코드 문자열로 둡니다.
  -- Sprint 6 에서 마스터를 만들면 FK 로 바꿉니다.
  type_code     text not null,      -- crown / inlay / implant
  material_code text not null,      -- zirconia / pmma / abut_pmma ...

  shade_system  text,               -- vita_classic / vita_3d_master / ivoclar
  shade_cervical text,              -- 치경부
  shade_incisal  text,              -- 절단부

  implant_manufacturer text,
  implant_type         text,
  implant_size         text,
  implant_screw        text,
  implant_option       text,        -- 자유 입력

  is_pontic     boolean not null default false,
  created_at    timestamptz not null default now(),

  -- 한 치아에는 최대 두 개까지 (명세서 §4.2.7)
  constraint order_items_slot_range check (slot in (1, 2)),

  -- 실제 존재하는 치식 번호만
  constraint order_items_tooth_valid check (
    tooth_number between 11 and 48
    and (tooth_number % 10) between 1 and 8
    and (tooth_number / 10) between 1 and 4
  ),

  -- 임플란트면 제조사와 타입이 있어야 합니다 (명세서 §4.2.4)
  constraint order_items_implant_required check (
    type_code <> 'implant'
    or (implant_manufacturer is not null and implant_type is not null)
  ),

  -- 인레이 폰틱은 존재하지 않습니다
  constraint order_items_no_inlay_pontic check (
    not (is_pontic and type_code = 'inlay')
  )
);

create unique index order_items_unique_idx
  on order_items (order_id, tooth_number, slot);
create index order_items_order_idx on order_items (order_id);

comment on column order_items.slot is '중복 등록 시 1 또는 2. 허용 조합은 명세서 §4.2.7';

-- ---------- 브릿지 묶음 ----------
create table order_bridges (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  created_by_rule boolean not null default true,   -- 자동 연결인지 사용자가 이은 것인지
  created_at      timestamptz not null default now()
);

create table order_bridge_members (
  bridge_id     uuid not null references order_bridges(id) on delete cascade,
  order_item_id uuid not null references order_items(id) on delete cascade,
  primary key (bridge_id, order_item_id)
);

create index order_bridges_order_idx on order_bridges (order_id);

-- ---------- 주문 번호 만들기 ----------
-- ORD-260807-001 처럼 하루 단위로 번호를 셉니다.
create or replace function next_order_no()
returns text
language plpgsql as $$
declare
  today_prefix text := 'ORD-' || to_char(now() at time zone 'Asia/Seoul', 'YYMMDD');
  seq int;
begin
  select coalesce(max(substring(order_no from 12)::int), 0) + 1
    into seq
    from orders
   where order_no like today_prefix || '-%';

  return today_prefix || '-' || lpad(seq::text, 3, '0');
end;
$$;

-- ---------- 접근 정책 ----------
alter table orders               enable row level security;
alter table order_items          enable row level security;
alter table order_bridges        enable row level security;
alter table order_bridge_members enable row level security;

-- 내 조직이 관련된 주문만 보입니다.
create policy order_select on orders
  for select using (
    clinic_org_id = my_org_id()
    or design_org_id = my_org_id()
    or lab_org_id = my_org_id()
  );

-- 주문 등록은 치과만
create policy order_insert on orders
  for insert with check (
    clinic_org_id = my_org_id() and my_org_type() = 'clinic'
  );

-- 수정은 관련 조직이면 가능합니다.
-- "접수·재스캔에서만 수정" 규칙은 서버(order-status 모듈)에서 검사합니다.
create policy order_update on orders
  for update using (
    clinic_org_id = my_org_id()
    or design_org_id = my_org_id()
    or lab_org_id = my_org_id()
  );

-- 항목은 주문을 볼 수 있으면 같이 보입니다.
create policy order_item_all on order_items
  for all using (
    exists (select 1 from orders o where o.id = order_items.order_id)
  );

create policy order_bridge_all on order_bridges
  for all using (
    exists (select 1 from orders o where o.id = order_bridges.order_id)
  );

create policy order_bridge_member_all on order_bridge_members
  for all using (
    exists (select 1 from order_bridges b where b.id = order_bridge_members.bridge_id)
  );
