-- =========================================================
-- DS Flow — 기공소에 치과 판매가를 감춥니다
-- 파일 위치: supabase/migrations/<타임스탬프>_hide_sale_price_from_lab.sql
-- 기준: 설계서 §8.5 (원가·단가 격리)
--
-- 무엇이 새고 있었나.
--   prosthesis_types 의 조회 정책이 is_partner_org() 로 열려 있어,
--   거래 기공소가 prosthesis_materials 를 통째로 읽었습니다.
--   그 표에는 price(치과 판매가)가 들어 있습니다.
--   확인: 기공소 계정으로 8줄 전부, 판매가까지 보였습니다.
--
--   기공소는 디자인센터가 치과에 얼마에 파는지 알 이유가 없습니다.
--   자기가 받는 기공원가만 알면 됩니다. 반대 방향(치과가 기공원가를 보는 것)은
--   이미 막혀 있습니다 — 이쪽만 뚫려 있었습니다.
--
-- 어떻게 막나.
--   ★ 열은 정책으로 못 막습니다. RLS 는 '행' 단위입니다.
--     그래서 값이 없는 **보기(view)** 를 하나 만들고, 원본 표는 닫습니다.
--
--   기공소도 제품 '이름' 은 알아야 합니다 — 주문서에 'Zir-Cr' 을 찍어야
--   무엇을 만드는지 압니다. 이름·약칭·성질만 담은 보기를 줍니다.
--
-- ★ 보기는 security_invoker = false 입니다.
--   보기를 만든 사람의 권한으로 원본을 읽습니다. 그래서 원본 표를
--   닫아 두어도 이 보기로는 이름을 볼 수 있습니다.
-- =========================================================

create view prosthesis_products_public
with (security_invoker = false) as
select
  t.id            as type_id,
  t.code          as type_code,
  t.name          as type_name,
  t.abbr          as type_abbr,
  t.color,
  t.color_soft,
  t.needs_implant_model,
  t.abbr_material_only,
  t.sort_order     as type_sort_order,
  t.is_active      as type_is_active,

  m.id,
  m.code,
  m.name,
  m.abbr,
  m.has_shade,
  m.has_pontic,
  m.has_pink,
  m.sort_order,
  m.is_active
from prosthesis_types t
join prosthesis_materials m on m.type_id = t.id;

comment on view prosthesis_products_public is
  '값이 빠진 제품 목록. 기공소가 이름만 읽습니다 (설계서 §8.5)';

grant select on prosthesis_products_public to authenticated;

-- ---------- 원본 표는 값을 아는 쪽에만 ----------
--
--   디자인센터  자기가 정한 값이라 전부 봅니다
--   치과        자기에게 매긴 판매가라 봅니다
--   기공소      못 봅니다 — 위 보기로 이름만 봅니다
drop policy if exists prosthesis_type_select on prosthesis_types;

create policy prosthesis_type_select on prosthesis_types
  for select using (
    owner_org_id = my_org_id()
    or (my_org_type() = 'clinic' and is_partner_org(owner_org_id))
  );

-- prosthesis_material_select 는 위 정책을 타고 들어가므로 그대로 둡니다
-- (exists (select 1 from prosthesis_types ...) 안에서 같은 규칙이 걸립니다)
