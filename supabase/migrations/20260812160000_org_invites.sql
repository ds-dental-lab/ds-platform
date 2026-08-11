-- =========================================================
-- DS Flow — 직원 계정: 초대장
-- 파일 위치: supabase/migrations/<타임스탬프>_org_invites.sql
--
-- 사용자 요청 2026-08-12 — 조직 안의 사람을 늘립니다.
-- 이게 서야 작업 리스트의 디자이너와 통계의 '디자이너별' 이 뜻을 갖습니다
-- (지금은 조직마다 사람이 한 명뿐입니다).
--
-- ★ 관리자가 계정을 직접 만들지 않습니다. **초대장을 놓아 둡니다.**
--   계정을 대신 만들려면 service_role 열쇠가 있어야 하는데 지금 없고,
--   있더라도 남의 비밀번호를 관리자가 정하는 모양은 좋지 않습니다.
--   초대장을 놓아 두면 본인이 가입하고, 가입하는 순간 자리에 앉습니다.
--
-- ★ 초대장이 없으면 아무 데도 못 들어갑니다.
--   가입 자체는 누구나 할 수 있지만, 소속이 없으면 볼 화면도 데이터도
--   없습니다 — RLS 가 my_org_id() 로 전부 가리기 때문입니다.
--   막는 것은 가입 화면이 아니라 소속입니다.
--
-- ★ 이메일로 짝을 맞춥니다. 대소문자는 무시합니다.
--   Kim@x.com 으로 초대하고 kim@x.com 으로 가입하는 일이 흔합니다.
-- =========================================================

create table if not exists org_invites (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,

  email      text not null,
  role       member_role not null default 'staff',
  -- 미리 적어 두는 이름. 가입 전에도 목록에서 누구인지 알아보려고
  name       text,

  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),

  -- ★ 기한을 둡니다. 반년 지난 초대장이 그대로 살아 있으면,
  --   퇴사자가 그 메일로 가입해 들어옵니다
  expires_at timestamptz not null default now() + interval '14 days',

  accepted_at      timestamptz,
  accepted_user_id uuid references auth.users(id),
  revoked_at       timestamptz
);

-- 살아 있는 초대장은 한 이메일에 하나만
create unique index if not exists org_invites_open_idx
  on org_invites (org_id, lower(email))
  where accepted_at is null and revoked_at is null;

create index if not exists org_invites_email_idx on org_invites (lower(email));

comment on table org_invites is '조직에 사람을 부르는 초대장. 가입하는 순간 memberships 가 만들어집니다';

alter table org_invites enable row level security;

-- ---------- 누가 보고 만드는가 ----------
--
-- ★ 제 조직 것만입니다. 사람을 늘리는 일은 그 조직의 일이지
--   디자인센터가 남의 치과 직원을 만들 일이 아닙니다.

create policy invite_select on org_invites
  for select using (org_id = my_org_id());

create policy invite_insert on org_invites
  for insert with check (
    org_id = my_org_id() and my_role() in ('owner', 'admin')
  );

create policy invite_update on org_invites
  for update
  using (org_id = my_org_id() and my_role() in ('owner', 'admin'))
  with check (org_id = my_org_id());

-- ---------- 가입하면 자리에 앉힙니다 ----------
--
-- ★ 트리거가 security definer 라 RLS 를 지나갑니다.
--   가입하는 그 순간에는 아직 소속이 없어서 my_org_id() 가 비어 있습니다 —
--   정책으로는 자기 초대장조차 못 찾습니다.
--
-- ★ 기한이 지났거나 물린 초대장은 안 씁니다.
--   그런 초대장으로 들어오면, 부른 적 없는 사람이 조직 안에 앉습니다.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_invite org_invites%rowtype;
begin
  insert into user_profiles (id, name, email)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      '이름없음'
    ),
    new.email
  )
  on conflict (id) do nothing;

  -- 살아 있는 초대장 중 가장 최근 것
  select * into v_invite
  from org_invites
  where lower(email) = lower(coalesce(new.email, ''))
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  if found then
    insert into memberships (org_id, user_id, role, is_active)
    values (v_invite.org_id, new.id, v_invite.role, true)
    on conflict do nothing;

    update org_invites
       set accepted_at = now(), accepted_user_id = new.id
     where id = v_invite.id;

    -- 초대장에 적어 둔 이름이 있으면 그것을 씁니다 (본인이 안 적었을 때만)
    if v_invite.name is not null and nullif(new.raw_user_meta_data ->> 'name', '') is null then
      update user_profiles set name = v_invite.name where id = new.id;
    end if;
  end if;

  return new;
end;
$$;

-- ---------- 직원 목록이 서로를 봅니다 ----------
--
-- ★ 같은 조직 사람끼리는 이미 보입니다 (is_same_org_user).
--   memberships 에 select 정책이 있는지만 확인하고, 없으면 엽니다.

drop policy if exists membership_select_own_org on memberships;

create policy membership_select_own_org on memberships
  for select using (org_id = my_org_id());

-- 권한 바꾸기 · 끄기는 owner·admin 만
drop policy if exists membership_update_own_org on memberships;

create policy membership_update_own_org on memberships
  for update
  using (org_id = my_org_id() and my_role() in ('owner', 'admin'))
  with check (org_id = my_org_id());
