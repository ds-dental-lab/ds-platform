-- =========================================================
-- 개인정보 처리방침 공개. (사용자 결정 2026-08-12 —
--   "개인정보 보호책임자는 나로 하고 처리방침 화면 만들어줘")
--
-- ★ 문구를 코드에 박지 않습니다.
--   처리방침이 실제 동작과 어긋나는 것이 가장 큰 위험이고, 그 어긋남은
--   대개 **시스템만 바뀌고 문서가 안 바뀌어서** 생깁니다.
--   그래서 화면이 표에서 직접 읽습니다 — 보관기간은 retention_settings,
--   사업자 정보는 organizations, 책임자는 그 사람의 계정에서.
--   보관기간을 730일로 고치면 처리방침의 숫자도 그날 바뀝니다.
--
-- ★ 책임자는 이름이 아니라 **계정**을 가리킵니다.
--   이름을 글자로 박아 두면 사람이 바뀌었을 때 문서만 옛 이름을 답니다.
--
-- ★ 시행일이 없으면 '초안' 입니다.
--   법률 검토 전에 공개된 문서가 되면 안 됩니다. 날짜를 넣는 행위가
--   곧 "검토를 마쳤다" 는 뜻이 됩니다.
-- =========================================================

alter table organizations
  add column privacy_officer_user_id uuid references user_profiles(id) on delete set null,
  add column privacy_officer_dept    text,
  add column privacy_officer_tel     text,
  add column privacy_officer_email   text,
  add column privacy_policy_effective_on date;

comment on column organizations.privacy_officer_user_id is
  '개인정보 보호책임자. 이름·이메일은 그 사람 계정에서 따라옵니다';
comment on column organizations.privacy_policy_effective_on is
  '처리방침 시행일. 비어 있으면 초안이며 공개 화면에 그렇게 뜹니다';

-- ---------- 책임자 기본값: 그 조직의 관리자 ----------
--
-- ★ "보호책임자는 나로" — 지금 각 조직의 관리자를 앉힙니다.
--   화면에서 언제든 바꿉니다.
update organizations o
set privacy_officer_user_id = m.user_id
from (
  select distinct on (org_id) org_id, user_id
  from memberships
  where is_active and deleted_at is null and role in ('owner', 'admin')
  order by org_id, created_at
) m
where m.org_id = o.id and o.privacy_officer_user_id is null;

-- ---------- 로그인 없이 읽는 창구 ----------
--
-- ★ 처리방침은 **누구나** 볼 수 있어야 합니다.
--   그런데 organizations·retention_settings 는 RLS 로 잠겨 있습니다.
--   표를 열어 주는 대신, 처리방침에 실릴 값만 골라 주는 함수를 둡니다.
--   여기서 돌려주는 것은 전부 처리방침에 어차피 공개되는 항목입니다.
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
      -- 위탁받는 자(수탁자) — 거래 중인 기공소
      select json_agg(json_build_object('name', l.name) order by l.name)
      from partnerships pt
      join organizations l on l.id = pt.to_org_id
      where pt.from_org_id = o.id
        and pt.relation = 'design_lab'
        and pt.status = 'active'
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
  '처리방침 화면이 쓰는 값. 로그인 없이 부를 수 있습니다';

grant execute on function public_privacy_policy() to anon, authenticated;
