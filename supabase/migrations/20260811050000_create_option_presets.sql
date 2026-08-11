-- =========================================================
-- DS Flow — 제작옵션 즐겨찾기 (원장별 기본값)
-- 파일 위치: supabase/migrations/<타임스탬프>_create_option_presets.sql
-- 기준: 기능명세서 §4.2.8 제작옵션
--
-- 한 치과 안에 A원장·B원장이 있고 늘 쓰는 제작옵션이 서로 다릅니다.
-- 매번 훅·폰틱타입을 다시 고르는 대신 이름을 붙여 저장해 두고 한 번에 불러옵니다.
--
-- ★ 이름은 고칠 수 있어야 합니다. '원장1' 로 만들어 두고 나중에
--   실제 원장 이름으로 바꾸는 일이 흔합니다.
-- =========================================================

create table clinic_option_presets (
  id            uuid primary key default gen_random_uuid(),
  clinic_org_id uuid not null references organizations(id) on delete cascade,

  name          text not null,
  -- { 옵션그룹id: 옵션값id } — 주문 화면이 그대로 셀렉트에 꽂습니다
  selections    jsonb not null default '{}'::jsonb,

  sort_order    int  not null default 0,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table  clinic_option_presets            is '치과가 저장해 둔 제작옵션 묶음. 원장별로 늘 쓰는 값이 달라 이름을 붙여 나눕니다';
comment on column clinic_option_presets.selections is '{ production_option_groups.id: production_option_values.id }';

-- 같은 치과 안에서 이름이 겹치면 어느 것이 누구 것인지 알 수 없습니다
create unique index clinic_option_presets_name_idx
  on clinic_option_presets (clinic_org_id, name);

create index clinic_option_presets_clinic_idx
  on clinic_option_presets (clinic_org_id, sort_order, created_at);

-- ---------- 접근 정책 (설계서 §8.4) ----------
-- ★ 이건 그 치과 안에서만 쓰는 개인 설정입니다.
--   디자인센터도 기공소도 볼 이유가 없어 자기 치과로만 닫습니다.
alter table clinic_option_presets enable row level security;

create policy option_preset_select on clinic_option_presets
  for select using (clinic_org_id = my_org_id());

create policy option_preset_insert on clinic_option_presets
  for insert with check (
    clinic_org_id = my_org_id()
    and my_org_type() = 'clinic'
  );

create policy option_preset_update on clinic_option_presets
  for update using (
    clinic_org_id = my_org_id()
    and my_org_type() = 'clinic'
  );

create policy option_preset_delete on clinic_option_presets
  for delete using (
    clinic_org_id = my_org_id()
    and my_org_type() = 'clinic'
  );
