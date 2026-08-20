-- =========================================================
-- DS Flow — 제품 보기의 문지기를 바꿉니다 (Supabase Advisor CRITICAL)
-- 파일 위치: supabase/migrations/<타임스탬프>_products_view_invoker.sql
-- 기준: Supabase Advisor 2026-08-21 — security_definer_view
--
-- 무엇이 걸렸나.
--   prosthesis_products_public 이 security_invoker = false 였습니다.
--   보기를 만든 사람(postgres)의 권한으로 원본을 읽습니다. 그런데
--   그 계정은 **RLS 를 통째로 건너뜁니다**(bypassrls).
--
--   그래서 값(판매가)은 안 새지만 **행이 샜습니다.**
--   로그인한 사람이면 누구나 **모든 디자인센터**의 제품 목록을
--   읽었습니다. 지금은 센터가 하나뿐이라 눈에 안 보였을 뿐입니다.
--   거래처가 늘면 남의 제품 이름·약칭이 그대로 보입니다.
--
-- 왜 그냥 security_invoker = true 로 못 바꾸나.
--   그러면 기공소가 아무것도 못 봅니다. prosthesis_types 의 조회
--   정책이 기공소를 막아 두었기 때문입니다 — 그 표에 치과 판매가가
--   들어 있어 일부러 닫은 것입니다 (§8.5, 2026-08-12).
--
--   ★ 열은 정책으로 못 막습니다. RLS 는 '행' 단위입니다.
--     그래서 값이 빠진 보기가 필요했고, 그 보기가 원본을 읽으려면
--     누군가는 정책을 넘어야 했습니다.
--
-- 어떻게 바꾸나.
--   ★ 넘는 자리를 **보기에서 함수로 옮깁니다.**
--     보기는 invoker 로 돌려 Advisor 를 통과시키고, 정책을 넘는 일은
--     security definer 함수 하나가 맡습니다. 그 함수 안에서 **직접**
--     행을 가릅니다 — 내 조직 것이거나, 거래 중인 곳의 것만.
--
--     바깥에서 보기에 거는 질의는 그대로입니다. 화면 코드는 한 줄도
--     안 바뀝니다 (.from('prosthesis_products_public')).
--
--   ★ 값 칸은 여전히 없습니다. 함수가 이름·약칭·성질만 돌려줍니다.
--     price / pontic_price / pink_price 는 여기 들어오지 않습니다.
-- =========================================================

-- ---------- 값이 빠진 제품 목록을 만드는 함수 ----------
create or replace function prosthesis_products_visible()
returns table (
  type_id             uuid,
  type_code           text,
  type_name           text,
  type_abbr           text,
  color               text,
  color_soft          text,
  needs_implant_model boolean,
  abbr_material_only  boolean,
  type_sort_order     int,
  type_is_active      boolean,

  id                  uuid,
  code                text,
  name                text,
  abbr                text,
  has_shade           boolean,
  has_pontic          boolean,
  has_pink            boolean,
  sort_order          int,
  is_active           boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id, t.code, t.name, t.abbr,
    t.color, t.color_soft,
    t.needs_implant_model, t.abbr_material_only,
    t.sort_order, t.is_active,

    m.id, m.code, m.name, m.abbr,
    m.has_shade, m.has_pontic, m.has_pink,
    m.sort_order, m.is_active
  from prosthesis_types t
  join prosthesis_materials m on m.type_id = t.id
  /*
    ★ 여기가 새 문지기입니다.
      전에는 아무 조건이 없어 모든 센터의 제품이 나왔습니다.
      원본 표의 조회 정책과 같은 규칙을 그대로 적습니다 —
      다만 기공소도 통과합니다(값이 없는 목록이므로).

    ★ my_org_id() 가 null 이면(로그인 전·소속 없음) 둘 다 거짓이라
      한 줄도 안 나옵니다. `<>` 로 적었다가 null 이 문을 안 잠근
      일이 있었습니다 — 여기서는 등호만 씁니다.
  */
  where t.owner_org_id = my_org_id()
     or is_partner_org(t.owner_org_id);
$$;

comment on function prosthesis_products_visible is
  '값이 빠진 제품 목록. 정책을 넘는 자리를 여기 한 곳에 모읍니다 (§8.5)';

revoke all on function prosthesis_products_visible() from public;
grant execute on function prosthesis_products_visible() to authenticated;

-- ---------- 보기는 부르는 사람의 권한으로 ----------
--
-- ★ 이름·열 순서는 그대로 둡니다. 화면이 select('*') 로 읽습니다.
drop view if exists prosthesis_products_public;

create view prosthesis_products_public
with (security_invoker = true) as
select * from prosthesis_products_visible();

comment on view prosthesis_products_public is
  '값이 빠진 제품 목록. 기공소가 이름만 읽습니다 (설계서 §8.5)';

grant select on prosthesis_products_public to authenticated;
