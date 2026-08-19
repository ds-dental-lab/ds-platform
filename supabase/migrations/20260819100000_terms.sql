-- =========================================================
-- DS Flow — 이용약관 공개
-- 파일 위치: supabase/migrations/20260819100000_terms.sql
-- 기준: 사용자 요청 2026-08-19 — 전 직장 약관을 버리고 새로 쓴 뒤
--       "만들어줘" (공개 화면 + 가입 동의)
--
-- ★ 처리방침과 **같은 방식**을 씁니다.
--   문구는 코드(domain/terms)에 데이터로 두고, 상호·사업자등록번호·
--   주소·연락처·시행일만 표에서 읽습니다. 약관 본문에 상호를 박아 두면
--   상호가 바뀌었을 때 문서만 옛 이름을 답니다 — 처리방침에서 이미
--   겪은 일입니다 (20260812220000).
--
-- ★ 시행일을 처리방침과 **따로** 둡니다.
--   두 문서는 검토가 끝나는 시점이 다릅니다. 하나로 묶으면 약관을
--   고쳤을 뿐인데 처리방침 시행일까지 움직입니다.
--
-- ★ 시행일이 없으면 초안입니다.
--   날짜를 넣는 행위가 곧 "법률 검토를 마쳤다" 는 뜻입니다.
--   지금은 사업자등록 전이라 비어 있는 것이 맞습니다.
-- =========================================================

alter table organizations
  add column terms_effective_on date;

comment on column organizations.terms_effective_on is
  '이용약관 시행일. 비어 있으면 초안이며 공개 화면에 그렇게 뜹니다';

-- ---------- 로그인 없이 읽는 창구 ----------
--
-- ★ 약관은 **가입하기 전에** 읽을 수 있어야 합니다.
--   가입한 사람만 볼 수 있는 약관은 약관이 아닙니다. 그런데
--   organizations 는 RLS 로 잠겨 있으므로, 처리방침과 마찬가지로
--   공개해도 되는 값만 골라 주는 함수를 둡니다.
--
-- ★ 처리방침 함수(public_privacy_policy)에 얹지 않습니다.
--   그쪽은 보관기간과 수탁자 목록까지 실어 옵니다. 약관 화면이
--   쓰지도 않는 값을 받아 가면, 나중에 그 값이 왜 필요한지 아무도
--   설명하지 못합니다.
create or replace function public_terms()
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
    'email',       o.privacy_officer_email,
    'effectiveOn', o.terms_effective_on
  )
  from organizations o
  where o.org_type = 'design_center' and o.deleted_at is null
  order by o.created_at
  limit 1;
$$;

comment on function public_terms is
  '이용약관에 싣는 사업자 정보와 시행일. 시행일이 비면 화면이 초안이라고 밝힙니다';

grant execute on function public_terms() to anon, authenticated;
