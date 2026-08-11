-- =========================================================
-- DS Flow — 보철 제품 마스터 (디자인센터 제품탭)
-- 파일 위치: supabase/migrations/<타임스탬프>_create_prosthesis_products.sql
-- 기준: 사용자 결정 2026-08-11
--
--   기본 단가표는 디자인센터가 제품탭에서 관리한다.
--   제품탭에서 활성화된 것만 치과 주문등록에 나온다.
--   신규 제품을 등록하면 치과에도 새 보철종류가 나타난다.
--
-- ★ 지금까지 보철 종류·재료는 코드에 박혀 있었습니다
--   (domain/prosthesis 의 PROSTHESIS_TYPES). 제품을 하나 늘리려면
--   배포를 해야 했습니다. 그것을 표로 옮깁니다.
--
-- ★ 임플란트 마스터와 같은 모양으로 나눕니다.
--   종류(crown) 아래 재료(zirconia)가 붙습니다. 단가는 그 짝에 붙고,
--   전치·구치로 한 번 더 갈립니다.
--
-- ★ 코드는 바꾸지 않습니다.
--   이미 쌓인 order_items.type_code / material_code 가 이 값을 가리킵니다.
--   이름이나 약칭은 고쳐도 되지만 코드를 고치면 지난 주문이 끊깁니다.
-- =========================================================

create table prosthesis_types (
  id           uuid primary key default gen_random_uuid(),
  owner_org_id uuid not null references organizations(id) on delete cascade,

  code         text not null,      -- 'crown' — order_items.type_code 와 짝입니다
  name         text not null,      -- '크라운'
  abbr         text not null,      -- 'Cr'
  color        text not null default '#4A5567',

  is_active    boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

comment on table  prosthesis_types           is '보철 종류. 디자인센터가 제품탭에서 관리합니다';
comment on column prosthesis_types.code      is 'order_items.type_code 와 짝. 고치면 지난 주문이 끊깁니다';
comment on column prosthesis_types.is_active is '끄면 치과 주문등록 목록에서 사라집니다. 지난 주문은 그대로 남습니다';

create unique index prosthesis_types_code_idx on prosthesis_types (owner_org_id, code);

create table prosthesis_materials (
  id           uuid primary key default gen_random_uuid(),
  type_id      uuid not null references prosthesis_types(id) on delete cascade,

  code         text not null,      -- 'zirconia' — order_items.material_code 와 짝
  name         text not null,      -- '지르코니아'
  abbr         text not null,      -- 'Zir'

  is_active    boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

comment on table prosthesis_materials is '보철 재료. 종류 아래에 붙습니다. 단가는 이 짝에 매깁니다';

create unique index prosthesis_materials_code_idx on prosthesis_materials (type_id, code);

-- ---------- 접근 정책 ----------
-- ★ 치과도 읽어야 합니다 — 주문등록 목록이 여기서 나옵니다.
--   고치는 것은 디자인센터만입니다.
alter table prosthesis_types     enable row level security;
alter table prosthesis_materials enable row level security;

create policy prosthesis_type_select on prosthesis_types
  for select using (owner_org_id = my_org_id() or is_partner_org(owner_org_id));

create policy prosthesis_type_write on prosthesis_types
  for all using (owner_org_id = my_org_id() and my_org_type() = 'design_center')
  with check (owner_org_id = my_org_id() and my_org_type() = 'design_center');

create policy prosthesis_material_select on prosthesis_materials
  for select using (
    exists (select 1 from prosthesis_types t where t.id = prosthesis_materials.type_id)
  );

create policy prosthesis_material_write on prosthesis_materials
  for all using (
    my_org_type() = 'design_center'
    and exists (
      select 1 from prosthesis_types t
      where t.id = prosthesis_materials.type_id and t.owner_org_id = my_org_id()
    )
  )
  with check (
    my_org_type() = 'design_center'
    and exists (
      select 1 from prosthesis_types t
      where t.id = prosthesis_materials.type_id and t.owner_org_id = my_org_id()
    )
  );

-- ---------- 씨앗 ----------
-- 코드에 박혀 있던 목록을 그대로 옮깁니다. 색은 domain/prosthesis 의 TYPE_COLOR.
do $$
declare
  design_org uuid;
  t_crown uuid;
  t_inlay uuid;
  t_impl  uuid;
begin
  for design_org in select id from organizations where org_type = 'design_center' loop
    insert into prosthesis_types (owner_org_id, code, name, abbr, color, sort_order)
      values (design_org, 'crown', '크라운', 'Cr', '#E0409A', 1)
      on conflict do nothing returning id into t_crown;
    if t_crown is null then
      select id into t_crown from prosthesis_types where owner_org_id = design_org and code = 'crown';
    end if;

    insert into prosthesis_types (owner_org_id, code, name, abbr, color, sort_order)
      values (design_org, 'inlay', '인레이', 'In', '#1B63E8', 2)
      on conflict do nothing returning id into t_inlay;
    if t_inlay is null then
      select id into t_inlay from prosthesis_types where owner_org_id = design_org and code = 'inlay';
    end if;

    insert into prosthesis_types (owner_org_id, code, name, abbr, color, sort_order)
      values (design_org, 'implant', '임플란트', 'Im', '#7C6BE8', 3)
      on conflict do nothing returning id into t_impl;
    if t_impl is null then
      select id into t_impl from prosthesis_types where owner_org_id = design_org and code = 'implant';
    end if;

    insert into prosthesis_materials (type_id, code, name, abbr, sort_order) values
      (t_crown, 'zirconia', '지르코니아', 'Zir',  1),
      (t_crown, 'pmma',     'PMMA',       'Pmma', 2),
      (t_inlay, 'hybrid',   '하이브리드', 'Hy',   1),
      (t_inlay, 'zirconia', '지르코니아', 'Zir',  2),
      -- ★ 임플란트는 약칭을 만들지 않고 이름을 그대로 씁니다
      (t_impl,  'abut_zir_scrp', 'Abut+Zir(SCRP)',          'Abut+Zir(SCRP)',          1),
      (t_impl,  'abut_zir_cem',  'Abut + Zir(Cementation)', 'Abut + Zir(Cementation)', 2),
      (t_impl,  'abut_pmma',     'Abut + PMMA',             'Abut + PMMA',             3),
      (t_impl,  'custom_abut',   '커스텀 어버트먼트',        'Custom Abutment',         4)
    on conflict do nothing;
  end loop;
end $$;
