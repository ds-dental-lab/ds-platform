-- =========================================================
-- DS Flow — 사용자 · 소속
-- Sprint 1 Day 2
-- 파일 위치: supabase/migrations/<타임스탬프>_create_users.sql
-- 선행: 01_create_organizations (touch_updated_at 함수를 재사용합니다)
-- =========================================================

-- ---------- 사용자 프로필 ----------
-- Supabase 인증(auth.users)을 확장합니다.
-- 비밀번호 · 이메일 인증은 auth 스키마가 관리하고, 우리는 표시용 정보만 가집니다.
create table user_profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text not null,
  phone_cc     text default '+82',
  phone        text,
  email        text unique,
  last_org_id  uuid references organizations(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

comment on table  user_profiles             is 'auth.users 확장 프로필';
comment on column user_profiles.last_org_id is '마지막 접속 조직. 단일 소속 단계에서는 참고용입니다';

create trigger user_profiles_touch
  before update on user_profiles
  for each row execute function touch_updated_at();

-- ---------- 소속과 권한 ----------
create type member_role as enum ('owner', 'admin', 'staff', 'designer', 'technician');

create table memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid not null references user_profiles(id) on delete cascade,
  role        member_role not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

comment on table memberships is '사용자와 조직의 연결. 권한(role)은 여기에 있습니다';

create trigger memberships_touch
  before update on memberships
  for each row execute function touch_updated_at();

-- 사용자는 하나의 조직에만 속합니다 (설계서 §4.3).
-- 나중에 다중 소속을 열려면 이 인덱스만 지우면 됩니다.
create unique index memberships_one_org_idx
  on memberships (user_id) where is_active and deleted_at is null;

create index memberships_org_idx on memberships (org_id, role);
