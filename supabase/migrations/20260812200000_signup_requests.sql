-- =========================================================
-- 가입 신청과 승인. (사용자 결정 2026-08-12 —
--   "치과랑 기공사 회원 가입이 완료되면 디자인 센터가 승인을 해줘야
--    이용할수 잇게 해줘")
--
-- ★ 전에는 초대장이 있어야만 자리에 앉았습니다.
--   그래서 디자인센터가 먼저 거래처를 만들고 초대장을 보내야 했습니다.
--   이제 치과·기공소가 **먼저 문을 두드릴 수 있습니다.** 다만 문을
--   여는 것은 여전히 디자인센터입니다.
--
-- ★ 가입과 이용은 다릅니다.
--   승인 전에는 memberships 가 없습니다 — 소속이 없으면 RLS 가 전부
--   가리므로, 화면을 따로 잠글 필요가 없습니다. 이미 있는 규칙을
--   그대로 씁니다.
-- =========================================================

create type signup_status as enum ('pending', 'approved', 'rejected');

create table signup_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references user_profiles(id) on delete cascade,
  email         text not null,
  name          text not null,
  org_type      org_type not null,
  org_name      text not null,
  tel           text,
  status        signup_status not null default 'pending',
  -- 승인하면 생긴 조직
  org_id        uuid references organizations(id) on delete set null,
  reviewed_by   uuid references user_profiles(id),
  reviewed_at   timestamptz,
  reject_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- ★ 디자인센터로는 신청 자체가 안 만들어집니다.
  --   화면의 셀렉박스에서 지우는 것으로는 아무것도 못 막습니다 —
  --   주소로 직접 보내면 그만입니다. 여기서 끝냅니다.
  constraint signup_requests_no_design check (org_type <> 'design_center')
);

comment on table signup_requests is
  '치과·기공소의 가입 신청. 디자인센터가 승인해야 자리에 앉습니다';

-- 한 사람이 동시에 여러 번 줄 서지 못합니다
create unique index signup_requests_one_pending
  on signup_requests (user_id) where status = 'pending';

create index signup_requests_status_idx on signup_requests (status, created_at desc);

create trigger signup_requests_touch
  before update on signup_requests
  for each row execute function touch_updated_at();

alter table signup_requests enable row level security;

-- ★ 본인은 자기 신청만, 디자인센터는 전부 봅니다.
--   본인이 못 보면 "왜 아직 안 되는지" 를 화면이 말해 줄 수 없습니다.
create policy signup_select on signup_requests
  for select using (
    user_id = auth.uid() or my_org_type() = 'design_center'
  );

-- ★ insert·update 정책을 열지 않습니다.
--   만드는 것은 가입 트리거가, 처리하는 것은 아래 두 함수가 합니다.
--   둘 다 security definer 라 정책을 타지 않습니다. 사람이 직접
--   상태를 'approved' 로 적을 길을 아예 안 만듭니다.

-- ---------- 가입할 때 신청서를 함께 남깁니다 ----------

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_invite   org_invites%rowtype;
  v_org_type text := nullif(new.raw_user_meta_data ->> 'org_type', '');
  v_org_name text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'org_name', '')), '');
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

    return new;
  end if;

  /*
    ★ 초대장이 있으면 신청서를 안 만듭니다.
      이미 자리에 앉았는데 승인 줄에도 서 있으면, 디자인센터 화면에
      "승인해 주세요" 가 뜨는데 그 사람은 벌써 쓰고 있습니다.

    ★ 디자인센터는 여기서도 걸러 냅니다 (check 제약과 이중으로).
      제약에 걸려 예외가 나면 가입 자체가 실패하는데, 그러면 화면에는
      알 수 없는 오류만 뜹니다. 조용히 신청서만 안 만듭니다.
  */
  if v_org_type in ('clinic', 'lab') and v_org_name is not null then
    insert into signup_requests (user_id, email, name, org_type, org_name, tel)
    values (
      new.id,
      coalesce(new.email, ''),
      coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), '이름없음'),
      v_org_type::org_type,
      v_org_name,
      nullif(new.raw_user_meta_data ->> 'tel', '')
    );
  end if;

  return new;
end;
$$;

-- ---------- 승인 ----------

create or replace function approve_signup(p_request_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_req signup_requests%rowtype;
  v_org uuid;
begin
  if my_org_type() <> 'design_center' or my_role() not in ('owner', 'admin') then
    raise exception '디자인센터 관리자만 승인할 수 있습니다';
  end if;

  -- ★ 줄 서 있는 것만 잡습니다. 두 사람이 동시에 눌러도 하나만 통과합니다
  select * into v_req
  from signup_requests
  where id = p_request_id and status = 'pending'
  for update;

  if not found then
    raise exception '이미 처리됐거나 없는 신청입니다';
  end if;

  -- 조직과 거래관계를 함께 세웁니다 (치과는 전속, 기공소는 물량을 받는 쪽)
  v_org := create_partner_org(v_req.org_type, v_req.org_name);

  -- ★ 신청한 사람이 그 기관의 관리자입니다.
  --   먼저 들어온 사람이 자기 조직을 꾸립니다 — 직원은 그 사람이 늘립니다.
  insert into memberships (org_id, user_id, role, is_active)
  values (v_org, v_req.user_id, 'owner', true)
  on conflict do nothing;

  update signup_requests
     set status = 'approved',
         org_id = v_org,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_request_id;

  return v_org;
end;
$$;

comment on function approve_signup is
  '디자인센터가 가입 신청을 승인합니다. 조직·거래관계·자리를 함께 만듭니다';

-- ---------- 반려 ----------

create or replace function reject_signup(p_request_id uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if my_org_type() <> 'design_center' or my_role() not in ('owner', 'admin') then
    raise exception '디자인센터 관리자만 반려할 수 있습니다';
  end if;

  if coalesce(btrim(p_reason), '') = '' then
    raise exception '반려 사유를 적어 주세요';
  end if;

  update signup_requests
     set status = 'rejected',
         reject_reason = btrim(p_reason),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_request_id and status = 'pending';

  if not found then
    raise exception '이미 처리됐거나 없는 신청입니다';
  end if;
end;
$$;

comment on function reject_signup is
  '가입 신청을 반려합니다. 사유는 신청한 본인에게 그대로 보입니다';

revoke all on function approve_signup(uuid) from public;
revoke all on function reject_signup(uuid, text) from public;
grant execute on function approve_signup(uuid) to authenticated;
grant execute on function reject_signup(uuid, text) to authenticated;
