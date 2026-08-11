-- =========================================================
-- DS Flow — 임플란트 마스터 (5단계 종속)
-- Sprint 6
-- 파일 위치: supabase/migrations/<타임스탬프>_create_implant_masters.sql
-- 기준: 시스템설계서 §4.4 임플란트 마스터, §8.4 RLS
--
--   제조사 → 타입 → 사이즈 · 스크류 · 옵션
--   ★ 사이즈·스크류는 제조사가 아니라 **타입**에 딸립니다. (기능명세서 §4.2.4)
--
-- 지금까지는 domain/implant/index.ts 에 하드코딩돼 있었습니다.
-- 그 값을 그대로 시드로 옮겨, 화면 동작이 달라지지 않게 합니다.
-- =========================================================

-- ---------- 제조사 ----------
create table implant_makers (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  sort_order smallint not null default 0,
  is_active  boolean  not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------- 타입 ----------
create table implant_types (
  id         uuid primary key default gen_random_uuid(),
  maker_id   uuid not null references implant_makers(id) on delete cascade,
  code       text not null unique,
  name       text not null,
  sort_order smallint not null default 0,
  is_active  boolean  not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index implant_types_name_idx on implant_types (maker_id, name)
  where deleted_at is null;
create index implant_types_maker_idx on implant_types (maker_id, sort_order);

-- ---------- 사이즈 · 스크류 · 옵션 (모두 타입에 딸립니다) ----------
create table implant_sizes (
  id         uuid primary key default gen_random_uuid(),
  type_id    uuid not null references implant_types(id) on delete cascade,
  code       text not null unique,
  name       text not null,
  sort_order smallint not null default 0,
  is_active  boolean  not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table implant_screws (
  id         uuid primary key default gen_random_uuid(),
  type_id    uuid not null references implant_types(id) on delete cascade,
  code       text not null unique,
  name       text not null,
  sort_order smallint not null default 0,
  is_active  boolean  not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 설계서 §4.4 에 있어 구조는 만들어 둡니다.
-- 현재 화면은 옵션을 자유 입력으로 받고 있어 비어 있습니다.
create table implant_options (
  id         uuid primary key default gen_random_uuid(),
  type_id    uuid not null references implant_types(id) on delete cascade,
  code       text not null unique,
  name       text not null,
  sort_order smallint not null default 0,
  is_active  boolean  not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index implant_sizes_name_idx   on implant_sizes   (type_id, name) where deleted_at is null;
create unique index implant_screws_name_idx  on implant_screws  (type_id, name) where deleted_at is null;
create unique index implant_options_name_idx on implant_options (type_id, name) where deleted_at is null;

create index implant_sizes_type_idx   on implant_sizes   (type_id, sort_order);
create index implant_screws_type_idx  on implant_screws  (type_id, sort_order);
create index implant_options_type_idx on implant_options (type_id, sort_order);

create trigger implant_makers_touch  before update on implant_makers
  for each row execute function touch_updated_at();
create trigger implant_types_touch   before update on implant_types
  for each row execute function touch_updated_at();
create trigger implant_sizes_touch   before update on implant_sizes
  for each row execute function touch_updated_at();
create trigger implant_screws_touch  before update on implant_screws
  for each row execute function touch_updated_at();
create trigger implant_options_touch before update on implant_options
  for each row execute function touch_updated_at();

-- ---------- 접근 정책 (설계서 §8.4) ----------
-- 조회는 전 섹터. 주문을 넣으려면 치과도 목록을 봐야 합니다.
-- 쓰기는 디자인센터만.
alter table implant_makers  enable row level security;
alter table implant_types   enable row level security;
alter table implant_sizes   enable row level security;
alter table implant_screws  enable row level security;
alter table implant_options enable row level security;

create policy implant_maker_select  on implant_makers  for select using (true);
create policy implant_type_select   on implant_types   for select using (true);
create policy implant_size_select   on implant_sizes   for select using (true);
create policy implant_screw_select  on implant_screws  for select using (true);
create policy implant_option_select on implant_options for select using (true);

create policy implant_maker_write on implant_makers
  for all using (my_org_type() = 'design_center') with check (my_org_type() = 'design_center');
create policy implant_type_write on implant_types
  for all using (my_org_type() = 'design_center') with check (my_org_type() = 'design_center');
create policy implant_size_write on implant_sizes
  for all using (my_org_type() = 'design_center') with check (my_org_type() = 'design_center');
create policy implant_screw_write on implant_screws
  for all using (my_org_type() = 'design_center') with check (my_org_type() = 'design_center');
create policy implant_option_write on implant_options
  for all using (my_org_type() = 'design_center') with check (my_org_type() = 'design_center');

-- ---------- 시드 ----------
-- domain/implant/index.ts 의 예시 마스터를 그대로 옮깁니다.
insert into implant_makers (code, name, sort_order) values
  ('OST', 'Osstem',     1),
  ('DTM', 'Dentium',    2),
  ('NBT', 'Neobiotech', 3)
on conflict (code) do nothing;

insert into implant_types (maker_id, code, name, sort_order)
select m.id, v.code, v.name, v.sort_order
from implant_makers m
join (values
  ('OST', 'OST_KS',  'KS',           1),
  ('OST', 'OST_SS',  'SS',           2),
  ('OST', 'OST_TS',  'TS',           3),
  ('OST', 'OST_US',  'US',           4),
  ('DTM', 'DTM_SL',  'Super Line',   1),
  ('DTM', 'DTM_SL2', 'Super Line 2', 2),
  ('NBT', 'NBT_IS',  'IS',           1)
) as v(maker_code, code, name, sort_order) on v.maker_code = m.code
on conflict (code) do nothing;

insert into implant_sizes (type_id, code, name, sort_order)
select t.id, v.code, v.name, v.sort_order
from implant_types t
join (values
  ('OST_KS',  'OST_KS_MINI',  'Mini',    1),
  ('OST_KS',  'OST_KS_REG',   'Regular', 2),
  ('OST_SS',  'OST_SS_MINI',  'Mini',    1),
  ('OST_SS',  'OST_SS_REG',   'Regular', 2),
  ('OST_SS',  'OST_SS_WIDE',  'Wide',    3),
  ('OST_TS',  'OST_TS_MINI',  'Mini',    1),
  ('OST_TS',  'OST_TS_REG',   'Regular', 2),
  ('DTM_SL',  'DTM_SL_REG',   'Regular', 1),
  ('DTM_SL2', 'DTM_SL2_REG',  'Regular', 1),
  ('NBT_IS',  'NBT_IS_REG',   'Regular', 1),
  ('NBT_IS',  'NBT_IS_WIDE',  'Wide',    2)
) as v(type_code, code, name, sort_order) on v.type_code = t.code
on conflict (code) do nothing;

-- ★ US 타입은 사이즈 구분이 없습니다. 행을 넣지 않는 것이 곧 "고를 것이 없음"입니다.
--   도메인의 isComplete 가 "고를 게 없어서 빈 것"과 "안 고른 것"을 구분합니다.

insert into implant_screws (type_id, code, name, sort_order)
select t.id, v.code, v.name, v.sort_order
from implant_types t
join (values
  ('OST_KS',  'OST_KS_HEX',   'Hex',      1),
  ('OST_KS',  'OST_KS_NHEX',  'Non-Hex',  2),
  ('OST_SS',  'OST_SS_OCTA',  'Octa',     1),
  ('OST_SS',  'OST_SS_NOCTA', 'Non-Octa', 2),
  ('OST_TS',  'OST_TS_HEX',   'Hex',      1),
  ('OST_TS',  'OST_TS_NHEX',  'Non-Hex',  2),
  ('OST_US',  'OST_US_HEX',   'Hex',      1),
  ('OST_US',  'OST_US_NHEX',  'Non-Hex',  2),
  ('DTM_SL',  'DTM_SL_HEX',   'Hex',      1),
  ('DTM_SL',  'DTM_SL_NHEX',  'Non-Hex',  2),
  ('DTM_SL2', 'DTM_SL2_HEX',  'Hex',      1),
  ('DTM_SL2', 'DTM_SL2_NHEX', 'Non-Hex',  2),
  ('NBT_IS',  'NBT_IS_HEX',   'Hex',      1),
  ('NBT_IS',  'NBT_IS_NHEX',  'Non-Hex',  2)
) as v(type_code, code, name, sort_order) on v.type_code = t.code
on conflict (code) do nothing;
