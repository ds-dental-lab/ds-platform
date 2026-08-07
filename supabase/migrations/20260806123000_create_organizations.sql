-- =========================================================
-- DS Flow — 조직 · 거래관계
-- Sprint 1 Day 1
-- 파일 위치: supabase/migrations/<타임스탬프>_create_organizations.sql
-- =========================================================

-- ---------- 열거형 ----------
create type org_type   as enum ('clinic', 'design_center', 'lab');
create type org_status as enum ('pending', 'active', 'suspended');

-- ---------- 조직 ----------
-- 치과 · 디자인센터 · 기공소를 한 테이블에서 org_type 으로 구분합니다.
-- DS 덴탈랩은 디자인센터이면서 자사 기공을 겸합니다(통합 운영).
create table organizations (
  id          uuid primary key default gen_random_uuid(),
  org_type    org_type    not null,
  code        text        unique,          -- DC-001 / DD-001 / DL-001
  name        text        not null,
  biz_no      text,
  ceo_name    text,
  tel         text,
  zip_code    text,
  address     text,
  status      org_status  not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index  organizations_type_status_idx on organizations (org_type, status);
create unique index organizations_bizno_idx  on organizations (biz_no)
  where deleted_at is null and biz_no is not null;

comment on table  organizations      is '치과 · 디자인센터 · 기공소';
comment on column organizations.code is '조직 코드. DC=치과, DD=디자인센터, DL=기공소';

-- ---------- 거래 관계 (1:1 전속) ----------
create type partner_relation as enum ('clinic_design', 'design_lab');
create type partner_status   as enum ('pending', 'active', 'terminated');

create table partnerships (
  id          uuid primary key default gen_random_uuid(),
  from_org_id uuid not null references organizations(id) on delete cascade,
  to_org_id   uuid not null references organizations(id) on delete cascade,
  relation    partner_relation not null,
  status      partner_status   not null default 'pending',
  is_default  boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 1:1 전속 강제 — 한 조직은 활성 거래처를 하나만 가집니다.
-- 나중에 다대다로 열려면 이 인덱스만 바꾸면 됩니다.
create unique index partnerships_one_active_idx
  on partnerships (from_org_id, relation) where status = 'active';
create index partnerships_to_idx
  on partnerships (to_org_id, relation, status);

-- ---------- updated_at 자동 갱신 ----------
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger organizations_touch
  before update on organizations
  for each row execute function touch_updated_at();

-- ---------- 시드 데이터 ----------
insert into organizations (org_type, code, name, status) values
  ('design_center', 'DD-001', 'DS 덴탈랩',  'active'),
  ('clinic',        'DC-001', '테스트치과', 'active');

-- 테스트치과 → DS 덴탈랩 전속 연결
insert into partnerships (from_org_id, to_org_id, relation, status)
select c.id, d.id, 'clinic_design', 'active'
from organizations c, organizations d
where c.code = 'DC-001' and d.code = 'DD-001';
