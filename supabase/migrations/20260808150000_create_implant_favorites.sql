-- =========================================================
-- DS Flow — 치과 임플란트 즐겨찾기
-- Sprint 6
-- 파일 위치: supabase/migrations/<타임스탬프>_create_implant_favorites.sql
-- 기준: 시스템설계서 §4.4 clinic_implant_favorites, §8.3 강제 배포, §8.4 RLS
--
-- 치과는 늘 쓰는 조합이 정해져 있습니다. 매번 제조사부터 네 번 고르는
-- 대신 한 번에 집어넣게 합니다.
--
-- 디자인센터도 같은 표에 꽂을 수 있습니다(강제 배포). 누가 넣었는지는
-- source 로 구분합니다 — 배포한 것은 치과가 임의로 뺄 수 없습니다.
-- =========================================================

create type implant_favorite_source as enum (
  'clinic',       -- 치과가 직접 담음
  'design_push'   -- 디자인센터가 배포함
);

create table clinic_implant_favorites (
  id               uuid primary key default gen_random_uuid(),
  clinic_org_id    uuid not null references organizations(id) on delete cascade,

  maker_id         uuid not null references implant_makers(id) on delete cascade,
  type_id          uuid not null references implant_types(id)  on delete cascade,
  size_id          uuid references implant_sizes(id)  on delete cascade,
  screw_id         uuid references implant_screws(id) on delete cascade,

  label            text not null,      -- 'Osstem TS Regular Hex' — 표시용 캐시
  source           implant_favorite_source not null default 'clinic',
  pushed_by_org_id uuid references organizations(id),

  created_at       timestamptz not null default now()
);

comment on table  clinic_implant_favorites        is '치과가 자주 쓰는 임플란트 조합. 디자인센터가 배포할 수도 있습니다';
comment on column clinic_implant_favorites.label  is '표시용 캐시. 마스터 이름이 바뀌어도 목록이 비지 않게 합니다';
comment on column clinic_implant_favorites.source is 'design_push 는 디자인센터가 배포한 것. 치과가 뺄 수 없습니다';

-- 같은 조합을 두 번 담지 못하게 합니다.
-- ★ NULL 끼리는 서로 다르다고 보는 것이 기본이라, 사이즈가 없는 조합이
--   중복으로 들어갑니다. coalesce 로 빈 값을 하나의 값으로 묶습니다.
create unique index clinic_implant_favorites_combo_idx
  on clinic_implant_favorites (
    clinic_org_id,
    maker_id,
    type_id,
    coalesce(size_id,  '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(screw_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index clinic_implant_favorites_clinic_idx
  on clinic_implant_favorites (clinic_org_id, created_at desc);

-- ---------- 접근 정책 (설계서 §8.4) ----------
-- 해당 치과 본인 + 파트너 디자인센터
alter table clinic_implant_favorites enable row level security;

create policy implant_favorite_select on clinic_implant_favorites
  for select using (
    clinic_org_id = my_org_id()
    or (my_org_type() = 'design_center' and is_partner_org(clinic_org_id))
  );

-- 치과는 자기 것만, 그것도 'clinic' 으로만 담을 수 있습니다.
create policy implant_favorite_insert_clinic on clinic_implant_favorites
  for insert with check (
    clinic_org_id = my_org_id()
    and my_org_type() = 'clinic'
    and source = 'clinic'
  );

-- 디자인센터는 거래 치과에 'design_push' 로만 꽂을 수 있습니다.
create policy implant_favorite_insert_design on clinic_implant_favorites
  for insert with check (
    my_org_type() = 'design_center'
    and is_partner_org(clinic_org_id)
    and source = 'design_push'
    and pushed_by_org_id = my_org_id()
  );

-- ★ 치과는 자기가 담은 것만 뺍니다. 배포된 것은 손대지 못합니다.
create policy implant_favorite_delete_clinic on clinic_implant_favorites
  for delete using (
    clinic_org_id = my_org_id()
    and my_org_type() = 'clinic'
    and source = 'clinic'
  );

-- 배포한 디자인센터는 자기가 꽂은 것을 회수할 수 있습니다.
create policy implant_favorite_delete_design on clinic_implant_favorites
  for delete using (
    my_org_type() = 'design_center'
    and is_partner_org(clinic_org_id)
    and source = 'design_push'
  );
