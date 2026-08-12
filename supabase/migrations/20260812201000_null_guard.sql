-- =========================================================
-- ★ `my_org_type() <> 'design_center'` 은 문을 안 잠급니다.
--
--   소속이 아직 없는 사람은 my_org_type() 이 **null** 입니다.
--   `null <> 'design_center'` 은 true 가 아니라 **null** 이라, if 가
--   그냥 지나갑니다. 즉 **아무 조직에도 안 속한 사람이 문을 통과합니다.**
--
--   실제로 잡혔습니다: 승인 대기 중인 치과 가입자가 approve_signup 을
--   직접 불렀더니 권한 검사를 지나쳐, 한참 안쪽의 not-null 제약에
--   걸려서야 멈췄습니다. 우연히 막힌 것이지 막은 것이 아닙니다.
--   그 열이 nullable 이었다면 조직이 생겼을 겁니다.
--
--   `is distinct from` 은 null 을 값처럼 비교합니다.
--   role 은 coalesce 로 빈 문자열을 만들어 놓고 봅니다.
--
-- 같은 함정이 create_partner_org 에도 있었습니다 (먼저 만든 함수).
-- 세 곳을 한꺼번에 고칩니다.
-- =========================================================

create or replace function approve_signup(p_request_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_req signup_requests%rowtype;
  v_org uuid;
begin
  if my_org_type() is distinct from 'design_center'
     or coalesce(my_role()::text, '') not in ('owner', 'admin') then
    raise exception '디자인센터 관리자만 승인할 수 있습니다';
  end if;

  select * into v_req
  from signup_requests
  where id = p_request_id and status = 'pending'
  for update;

  if not found then
    raise exception '이미 처리됐거나 없는 신청입니다';
  end if;

  v_org := create_partner_org(v_req.org_type, v_req.org_name);

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

create or replace function reject_signup(p_request_id uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if my_org_type() is distinct from 'design_center'
     or coalesce(my_role()::text, '') not in ('owner', 'admin') then
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

-- ---------- create_partner_org 의 같은 구멍 ----------
--
-- 본문은 그대로 두고 첫 검사만 고칩니다.
create or replace function create_partner_org(
  p_org_type       org_type,
  p_name           text,
  p_ceo_name       text default null,
  p_tel            text default null,
  p_biz_no         text default null,
  p_address        text default null,
  p_invoice_method invoice_method default 'all',
  p_invoice_email  text default null,
  p_fax            text default null,
  p_tax_email      text default null,
  p_closing_day    smallint default 26,
  p_active         boolean default true
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me     uuid := my_org_id();
  v_prefix text;
  v_code   text;
  v_id     uuid;
begin
  -- ★ null 이면 여기서 멈춥니다 (소속 없는 사람)
  if v_me is null or my_org_type() is distinct from 'design_center' then
    raise exception '디자인센터만 거래처를 등록할 수 있습니다';
  end if;

  if p_org_type not in ('clinic', 'lab') then
    raise exception '치과 또는 기공소만 등록할 수 있습니다';
  end if;

  if coalesce(btrim(p_name), '') = '' then
    raise exception '상호를 넣어 주세요';
  end if;

  v_prefix := case when p_org_type = 'clinic' then 'DC' else 'DL' end;

  select v_prefix || '-' || lpad((count(*) + 1)::text, 3, '0')
    into v_code
    from organizations
   where org_type = p_org_type;

  while exists (select 1 from organizations where code = v_code) loop
    v_code := v_prefix || '-' || lpad(
      (coalesce(nullif(right(v_code, 3), '')::int, 0) + 1)::text, 3, '0');
  end loop;

  insert into organizations (
    org_type, code, name, ceo_name, tel, biz_no, address,
    status, invoice_method, invoice_email, fax, tax_email, closing_day
  ) values (
    p_org_type, v_code, btrim(p_name), p_ceo_name, p_tel, p_biz_no, p_address,
    case when p_active then 'active' else 'suspended' end::org_status,
    p_invoice_method, p_invoice_email, p_fax, p_tax_email, p_closing_day
  )
  returning id into v_id;

  if p_org_type = 'clinic' then
    insert into partnerships (from_org_id, to_org_id, relation, status)
      values (v_id, v_me, 'clinic_design', 'active');
  else
    insert into partnerships (from_org_id, to_org_id, relation, status)
      values (v_me, v_id, 'design_lab', 'active');
  end if;

  return v_id;
end;
$$;
