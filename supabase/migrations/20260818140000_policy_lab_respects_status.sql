-- =========================================================
-- DS Flow — 처리방침의 수탁자 목록이 '거래중지' 를 따르게
-- 파일 위치: supabase/migrations/20260818140000_policy_lab_respects_status.sql
-- 기준: 사용자 요청 2026-08-18 — "ds기공소 내용은 지워줘"
--
-- ★ 찾은 구멍.
--   수탁자(위탁받는 기공소) 목록은 partnerships.status 만 봤습니다.
--   그런데 사용자탭의 '거래중지' 는 **organizations.status** 를 내립니다
--   (20260812010000 의 결정 — 관계를 내리면 지난 주문까지 안 보이게
--   되기 때문입니다). 둘이 어긋나 있었습니다.
--
--   그래서 거래를 끊은 기공소가 **공개 처리방침에 수탁자로 계속 남습니다.**
--   개인정보를 맡기지도 않는 곳을 맡긴다고 공개하는 셈이고, 반대로
--   그 기공소 입장에서는 남의 문서에 이름이 걸려 있는 것입니다.
--
-- ★ 두 조건을 다 봅니다. 관계가 살아 있고(active) 조직도 거래중일 때만.
--   이제 사용자탭에서 '거래중지' 로 내리면 처리방침에서도 빠집니다 —
--   한 곳에서 끊으면 다 끊깁니다.
-- =========================================================

create or replace function public_privacy_policy()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'orgName',     o.name,
    'bizNo',       o.biz_no,
    'address',     o.address,
    'tel',         o.tel,
    'officerName', p.name,
    'officerDept', o.privacy_officer_dept,
    'officerTel',  coalesce(o.privacy_officer_tel, o.tel),
    'officerEmail', coalesce(o.privacy_officer_email, p.email),
    'effectiveOn', o.privacy_policy_effective_on,
    'keepDays', (
      select json_object_agg(r.target, r.keep_days)
      from retention_settings r
      where r.org_id = o.id
    ),
    'labs', (
      -- 위탁받는 자(수탁자) — 관계도 살아 있고 조직도 거래중인 기공소만
      select json_agg(json_build_object('name', l.name) order by l.name)
      from partnerships pt
      join organizations l on l.id = pt.to_org_id
      where pt.from_org_id = o.id
        and pt.relation = 'design_lab'
        and pt.status = 'active'
        and l.status = 'active'          -- ★ 이 줄이 빠져 있었습니다
        and l.deleted_at is null
    )
  )
  from organizations o
  left join user_profiles p on p.id = o.privacy_officer_user_id
  where o.org_type = 'design_center' and o.deleted_at is null
  order by o.created_at
  limit 1;
$$;

comment on function public_privacy_policy is
  '처리방침에 싣는 사업자·책임자·보관기간·수탁자. 수탁자는 거래중인 기공소만';
