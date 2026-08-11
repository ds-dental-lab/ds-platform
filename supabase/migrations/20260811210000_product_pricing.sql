-- =========================================================
-- DS Flow — 제품에 속성과 가격을 싣습니다 (디자인센터 제품탭)
-- 파일 위치: supabase/migrations/<타임스탬프>_product_pricing.sql
-- 기준: 사용자가 준 제품탭 화면 + 결정 2026-08-11
--
-- 화면이 말하는 것
--   보철물 종류 · 재료 · SHADE · PONTIC · 판매가격 ·
--   가격(Pontic) · 가격(핑크 포셀린) · 표시순서 · 판매상태
--
-- ★ 쉐이드·폰틱·핑크포셀린 가능 여부가 '제품' 의 속성이 됩니다.
--   지금까지는 종류로 코드에 박혀 있었습니다 —
--     브릿지 연결은 crown·implant, 치은포셀린은 inlay 만 빼고.
--   그런데 화면의 '커스텀 어버트먼트' 는 임플란트인데 SHADE·PONTIC 이 N 입니다.
--   같은 종류 안에서도 다릅니다. 종류로는 표현할 수 없습니다.
--
-- ★ 전치·구치를 나누지 않습니다 (사용자 결정 — 통일).
--   제품 하나에 값 하나입니다. price_lists 의 tooth_group 을 버립니다.
--
-- ★ '못 쓴다' 와 '쓸 수 있는데 0원' 은 다릅니다.
--   화면에서도 '-' 와 '0' 으로 갈립니다. NULL 과 0 으로 나눕니다.
--
-- ★ 단가 스냅샷은 나중으로 미룹니다 (사용자 결정 — 우선순위 낮음).
--   지금은 제품 가격을 고치면 지난 정산도 그 값으로 보입니다.
--   운영을 시작한 뒤 order_items 에 단가를 복사하는 방식으로 옮깁니다.
-- =========================================================

-- ---------- 제품 속성과 기본 가격 ----------

alter table prosthesis_materials
  add column has_shade   boolean not null default true,
  add column has_pontic  boolean not null default false,
  add column has_pink    boolean not null default false,

  -- 비어 있으면 '아직 값을 안 정했다' 입니다. 0 은 '무료' 입니다
  add column price       integer check (price >= 0),
  add column pontic_price integer check (pontic_price >= 0),
  add column pink_price   integer check (pink_price >= 0);

comment on column prosthesis_materials.has_shade   is '쉐이드를 고르는 제품인가. 끄면 주문등록에서 쉐이드창이 안 뜹니다';
comment on column prosthesis_materials.has_pontic  is '폰틱으로 쓸 수 있는가. 끄면 우클릭 폰틱이 막힙니다';
comment on column prosthesis_materials.has_pink    is '핑크(치은) 포셀린을 붙일 수 있는가. 끄면 휠클릭이 막힙니다';
comment on column prosthesis_materials.price       is '판매가. 비어 있으면 아직 안 정한 것, 0 은 무료';
comment on column prosthesis_materials.pontic_price is '폰틱 자리의 값. 폰틱이 안 되는 제품은 비어 있습니다';
comment on column prosthesis_materials.pink_price  is '핑크 포셀린 추가금. 안 되는 제품은 비어 있습니다';

-- 지금 코드에 박혀 있던 규칙을 그대로 옮겨 심습니다.
--   브릿지(폰틱) — 크라운 · 임플란트
--   핑크 포셀린 — 인레이만 빼고
update prosthesis_materials m
   set has_pontic = t.code in ('crown', 'implant'),
       has_pink   = t.code <> 'inlay'
  from prosthesis_types t
 where t.id = m.type_id;

-- ---------- 치과별 단가 (사용자탭 > 치과) ----------
--
-- ★ 제품 기본가를 덮어씁니다. 줄이 없으면 기본가를 씁니다.
--   치과마다 거래 조건이 달라 같은 제품도 값이 다릅니다.
create table clinic_product_prices (
  id             uuid primary key default gen_random_uuid(),
  owner_org_id   uuid not null references organizations(id) on delete cascade,
  clinic_org_id  uuid not null references organizations(id) on delete cascade,
  material_id    uuid not null references prosthesis_materials(id) on delete cascade,

  price          integer check (price >= 0),
  pontic_price   integer check (pontic_price >= 0),
  pink_price     integer check (pink_price >= 0),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table clinic_product_prices is '치과별 판매가. 비어 있는 칸은 제품 기본가를 씁니다';

create unique index clinic_product_prices_idx
  on clinic_product_prices (clinic_org_id, material_id);

-- ---------- 기공소별 기공원가 (사용자탭 > 기공소) ----------
--
-- ★ 기공소마다 다릅니다 (사용자 결정).
--   외주를 주는 곳마다 단가가 달라 한 값으로 묶을 수 없습니다.
--   자사 제작이면 지급이 없어 정산에서 빠집니다 (Q-6).
create table lab_product_costs (
  id            uuid primary key default gen_random_uuid(),
  owner_org_id  uuid not null references organizations(id) on delete cascade,
  lab_org_id    uuid not null references organizations(id) on delete cascade,
  material_id   uuid not null references prosthesis_materials(id) on delete cascade,

  lab_cost      integer not null default 0 check (lab_cost >= 0),
  pontic_cost   integer check (pontic_cost >= 0),
  pink_cost     integer check (pink_cost >= 0),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table lab_product_costs is '기공소별 기공원가. 외주처마다 단가가 다릅니다';

create unique index lab_product_costs_idx
  on lab_product_costs (lab_org_id, material_id);

-- ---------- 옛 표 정리 ----------
--
-- price_lists 는 전치/구치와 시점별 단가를 담으려던 것인데,
-- 둘 다 쓰지 않기로 했습니다. 아직 아무도 쓰지 않아 지웁니다.
drop table if exists price_lists;
drop type if exists tooth_group;

-- ★ surcharge_prices(치은포셀린 금액)는 제품의 pink_price 로 옮겨 갑니다.
--   지금 화면(디자인센터 제품탭 SurchargeEditor)이 아직 쓰고 있어
--   이번에는 남겨 둡니다. 제품탭을 새로 만들 때 함께 걷어냅니다.

-- ---------- 접근 정책 ----------
alter table clinic_product_prices enable row level security;
alter table lab_product_costs     enable row level security;

-- 치과는 자기 단가만 봅니다. 남의 치과 값은 보이지 않습니다
create policy clinic_price_select on clinic_product_prices
  for select using (
    owner_org_id = my_org_id()
    or (my_org_type() = 'clinic' and clinic_org_id = my_org_id())
  );

create policy clinic_price_write on clinic_product_prices
  for all using (owner_org_id = my_org_id() and my_org_type() = 'design_center')
  with check (owner_org_id = my_org_id() and my_org_type() = 'design_center');

-- ★ 기공원가는 치과에 보이지 않습니다 (설계서 §8.5).
--   기공소는 자기 것만 봅니다.
create policy lab_cost_select on lab_product_costs
  for select using (
    owner_org_id = my_org_id()
    or (my_org_type() = 'lab' and lab_org_id = my_org_id())
  );

create policy lab_cost_write on lab_product_costs
  for all using (owner_org_id = my_org_id() and my_org_type() = 'design_center')
  with check (owner_org_id = my_org_id() and my_org_type() = 'design_center');
