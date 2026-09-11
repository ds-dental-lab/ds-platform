-- =========================================================
-- 가입할 때 휴대전화를 필수로 받음 (사용자 결정 2026-09-11)
--
-- 전에는 가입 화면에 번호 칸이 없어, 가입 알림톡(접수·승인)이 갈 곳이 없었고
-- 승인 뒤에도 알림톡 번호가 비어 있었습니다(운영 전원 번호 없음).
--
-- ★ 가입하는 순간 user_profiles.phone 에 넣습니다 — 알림톡 번호가 곧 이것.
--   초대받은 직원도 같은 길을 지나므로 따로 옮길 필요가 없습니다.
--   받기 싫으면 계정정보에서 끄거나 바꿉니다 (alimtalk_on 기본 켜짐).
-- ★ 신청서(signup_requests.tel)에도 같은 값 — 가입 접수 알림톡이 여기서 번호를 읽습니다.
-- ★ 휴대전화 모양이 아니면 null. 화면이 먼저 막지만, 주소로 직접 가입해도 이상한 값이 안 들어갑니다.
-- =========================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_invite   org_invites%rowtype;
  v_org_type text := nullif(new.raw_user_meta_data ->> 'org_type', '');
  v_org_name text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'org_name', '')), '');
  -- ★ 숫자만. +82 는 0 으로. 휴대전화 모양이 아니면 버립니다 (domain/alimtalk normalizePhone 과 같은 규칙)
  v_tel_raw  text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'tel', ''), '[^0-9]', '', 'g');
  v_tel      text;
begin
  if v_tel_raw like '82%' and length(v_tel_raw) >= 11 then
    v_tel_raw := '0' || substr(v_tel_raw, 3);
  end if;
  if v_tel_raw ~ '^01[016789][0-9]{7,8}$' then
    v_tel := v_tel_raw;
  end if;

  insert into user_profiles (id, name, email, phone)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      '이름없음'
    ),
    new.email,
    v_tel
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
      v_tel
    );
  end if;

  return new;
end;
$$;
