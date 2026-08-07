-- =========================================================
-- DS Flow — RLS (행 수준 보안)
-- Sprint 1 Day 2 ★ 이 파일을 건너뛰면 누구나 남의 데이터를 봅니다
-- 파일 위치: supabase/migrations/<타임스탬프>_enable_rls.sql
-- 기준: 설계서 §8.4
-- =========================================================

alter table organizations  enable row level security;
alter table partnerships   enable row level security;
alter table user_profiles  enable row level security;
alter table memberships    enable row level security;

-- =========================================================
-- 판정 함수
-- 모두 security definer 입니다. 정책 안에서 다른 테이블을 조회할 때
-- 그 테이블의 RLS 가 다시 걸려 무한 재귀가 나는 것을 막습니다.
-- =========================================================

-- 내 조직 id
create or replace function my_org_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from memberships
  where user_id = auth.uid() and is_active and deleted_at is null
  limit 1;
$$;

-- 내 권한
create or replace function my_role()
returns member_role
language sql stable security definer set search_path = public as $$
  select role from memberships
  where user_id = auth.uid() and is_active and deleted_at is null
  limit 1;
$$;

-- 내 조직의 종류 (clinic / design_center / lab)
create or replace function my_org_type()
returns org_type
language sql stable security definer set search_path = public as $$
  select o.org_type
  from memberships m
  join organizations o on o.id = m.org_id
  where m.user_id = auth.uid() and m.is_active and m.deleted_at is null
  limit 1;
$$;

-- 대상 조직이 내 활성 거래처인가
-- 치과는 자기 디자인센터를, 디자인센터는 치과와 기공소를 볼 수 있습니다.
-- 치과와 기공소는 직접 연결이 없으므로 서로 보이지 않습니다 (설계서 §8.5).
create or replace function is_partner_org(target_org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from partnerships p
    where p.status = 'active'
      and (
        (p.from_org_id = my_org_id() and p.to_org_id   = target_org) or
        (p.to_org_id   = my_org_id() and p.from_org_id = target_org)
      )
  );
$$;

-- 대상 사용자가 나와 같은 조직 사람인가
create or replace function is_same_org_user(target_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.user_id = target_user
      and m.is_active and m.deleted_at is null
      and m.org_id = my_org_id()
  );
$$;

-- =========================================================
-- 정책
-- 정책이 없으면 아무것도 안 보입니다. 이것이 기본값입니다.
-- =========================================================

-- ---------- organizations ----------
drop policy if exists org_select         on organizations;
drop policy if exists org_update         on organizations;
drop policy if exists profile_select     on user_profiles;
drop policy if exists profile_update     on user_profiles;
drop policy if exists membership_select  on memberships;
drop policy if exists membership_write   on memberships;
drop policy if exists partnership_select on partnerships;
create policy org_select on organizations
  for select using (id = my_org_id() or is_partner_org(id));

create policy org_update on organizations
  for update
  using      (id = my_org_id() and my_role() in ('owner', 'admin'))
  with check (id = my_org_id());

-- insert 정책은 만들지 않습니다.
-- 조직 생성(회원가입)은 서버에서 service_role 키로 처리합니다.

-- ---------- user_profiles ----------
create policy profile_select on user_profiles
  for select using (id = auth.uid() or is_same_org_user(id));

create policy profile_update on user_profiles
  for update
  using      (id = auth.uid())
  with check (id = auth.uid());

-- ---------- memberships ----------
create policy membership_select on memberships
  for select using (org_id = my_org_id());

-- 구성원 추가 · 권한 변경 · 비활성화는 owner / admin 만
create policy membership_write on memberships
  for all
  using      (org_id = my_org_id() and my_role() in ('owner', 'admin'))
  with check (org_id = my_org_id() and my_role() in ('owner', 'admin'));

-- ---------- partnerships ----------
create policy partnership_select on partnerships
  for select using (from_org_id = my_org_id() or to_org_id = my_org_id());

-- 거래 관계 연결 · 해지도 서버(service_role)에서 처리합니다.
