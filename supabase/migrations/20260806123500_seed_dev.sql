-- =========================================================
-- DS Flow — 개발용 시드
-- 파일 위치: supabase/seed.sql   ← 마이그레이션 폴더가 아닙니다
-- 실행: 여러 번 실행해도 같은 결과가 나옵니다
--
-- 선행 조건 — Supabase → Authentication → Users 에서 먼저 만들어 두세요
--   clinic@test.kr / design@test.kr / lab@test.kr
-- =========================================================

-- ---------- 조직 ----------
insert into organizations (org_type, code, name, status) values
  ('design_center', 'DD-001', 'DS 덴탈랩',  'active'),
  ('clinic',        'DC-001', '테스트치과', 'active'),
  ('lab',           'DL-001', 'DS 기공소',  'active')
on conflict (code) do nothing;

-- ---------- 거래 관계 ----------
-- 테스트치과 → DS 덴탈랩
insert into partnerships (from_org_id, to_org_id, relation, status)
select c.id, d.id, 'clinic_design', 'active'
from organizations c, organizations d
where c.code = 'DC-001' and d.code = 'DD-001'
  and not exists (
    select 1 from partnerships p
    where p.from_org_id = c.id and p.relation = 'clinic_design' and p.status = 'active'
  );

-- DS 덴탈랩 → DS 기공소
insert into partnerships (from_org_id, to_org_id, relation, status)
select d.id, l.id, 'design_lab', 'active'
from organizations d, organizations l
where d.code = 'DD-001' and l.code = 'DL-001'
  and not exists (
    select 1 from partnerships p
    where p.from_org_id = d.id and p.relation = 'design_lab' and p.status = 'active'
  );

-- ---------- 소속 ----------
-- 이메일로 사용자를 찾아 조직에 owner 로 붙입니다.
insert into memberships (org_id, user_id, role)
select o.id, u.id, 'owner'::member_role
from user_profiles u
join organizations o on o.code = case u.email
    when 'clinic@test.kr' then 'DC-001'
    when 'design@test.kr' then 'DD-001'
    when 'lab@test.kr'    then 'DL-001'
  end
where u.email in ('clinic@test.kr', 'design@test.kr', 'lab@test.kr')
  and not exists (
    select 1 from memberships m
    where m.user_id = u.id and m.is_active and m.deleted_at is null
  );

-- ---------- 확인 ----------
select o.code, o.name, o.org_type, u.email, m.role
from memberships m
join organizations o  on o.id = m.org_id
join user_profiles u  on u.id = m.user_id
order by o.code;
