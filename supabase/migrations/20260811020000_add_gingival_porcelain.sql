-- =========================================================
-- DS Flow — 치은포셀린
-- 파일 위치: supabase/migrations/<타임스탬프>_add_gingival_porcelain.sql
-- 기준: 시안 주문등록 (휠클릭 = 핑크 포셀린), 사용자 확정 (2026-08-11)
--
-- 치은포셀린은 치아마다 붙였다 뗄 수 있는 추가 항목입니다.
-- 붙이면 그 치아의 기공료에 추가 금액이 더해집니다.
--
-- ★ 인레이에는 붙지 않습니다.
--   인레이는 치아 안쪽을 메우는 것이라 잇몸 부위가 없습니다.
--   DB 제약으로 막고, 화면과 서비스에서도 각각 막습니다.
-- =========================================================

alter table order_items add column has_gingival boolean not null default false;

comment on column order_items.has_gingival is
  '치은포셀린. 붙으면 추가 과금됩니다. 인레이에는 붙지 않습니다';

-- 인레이에는 붙일 수 없습니다
alter table order_items add constraint order_items_no_inlay_gingival
  check (not (has_gingival and type_code = 'inlay'));

-- ---------- 추가 항목 가격 ----------
-- 디자인센터가 치과별로 금액을 정합니다. 단가표(price_lists)가 생기기 전까지
-- 추가 항목만 따로 두어, 제품탭에서 바로 고칠 수 있게 합니다.
create table surcharge_prices (
  id            uuid primary key default gen_random_uuid(),
  owner_org_id  uuid not null references organizations(id) on delete cascade,
  -- 비우면 그 디자인센터의 모든 거래 치과에 적용되는 기본값입니다
  target_clinic_org_id uuid references organizations(id) on delete cascade,

  code          text not null,              -- 'gingival'
  name          text not null,              -- '치은포셀린'
  amount        numeric(12,2) not null default 0,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table surcharge_prices is
  '치은포셀린 같은 추가 항목의 금액. 디자인센터가 치과별로 정합니다';

-- 치과별 값과 기본값이 각각 한 줄씩만 있어야 합니다.
-- NULL 끼리는 서로 다르다고 보므로 기본값 줄은 따로 막습니다.
create unique index surcharge_prices_target_idx
  on surcharge_prices (owner_org_id, code, target_clinic_org_id)
  where target_clinic_org_id is not null;

create unique index surcharge_prices_default_idx
  on surcharge_prices (owner_org_id, code)
  where target_clinic_org_id is null;

create trigger surcharge_prices_touch
  before update on surcharge_prices
  for each row execute function touch_updated_at();

-- ---------- 접근 정책 ----------
alter table surcharge_prices enable row level security;

-- 디자인센터는 자기 것을, 치과는 자기에게 적용되는 것을 봅니다.
-- 치과가 금액을 보는 이유 — 주문등록에서 추가 과금을 알려 줘야 합니다.
create policy surcharge_select on surcharge_prices
  for select using (
    owner_org_id = my_org_id()
    or target_clinic_org_id = my_org_id()
    or (target_clinic_org_id is null and is_partner_org(owner_org_id))
  );

-- 금액을 정하는 것은 디자인센터뿐입니다 (설계서 §8.3 단가표 설정)
create policy surcharge_write on surcharge_prices
  for all
  using      (owner_org_id = my_org_id() and my_org_type() = 'design_center')
  with check (owner_org_id = my_org_id() and my_org_type() = 'design_center');

-- ---------- 기본값 ----------
-- 시안의 PINK_PRICE 를 그대로 씁니다.
insert into surcharge_prices (owner_org_id, code, name, amount)
select id, 'gingival', '치은포셀린', 15000
from organizations
where org_type = 'design_center'
on conflict do nothing;
