-- =========================================================
-- DS Flow — 제품 하나가 **몇 개로 세어지는가**
-- 파일 위치: supabase/migrations/20261012100000_unit_count.sql
-- 기준: 사용자 요청 2026-10-12 — "임플란트 + 크라운 상품의 경우는
--       치아갯수를 2개로 산출해줄수 있어?"
--
-- ★★ 'Abut+Zir(SCRP)' 는 **어버트먼트와 크라운 둘**을 만드는 일입니다.
--   주문서에는 치식 하나지만 손은 두 번 갑니다. 통계에서 1로 세면
--   임플란트를 많이 맡은 사람의 일량이 실제보다 작아 보입니다.
--
-- ★ 코드에 재료 이름을 박지 않습니다. prosthesis/index.ts 가 말하는
--   원칙 그대로 — **"종류가 자기 성질을 들고 있어야 합니다"**.
--   제품을 더할 때 이 칸만 정하면 통계가 저절로 따라옵니다.
--
-- ★ 커스텀 어버트먼트는 **1** 입니다. 어버트먼트만 만들고 크라운은
--   없습니다. 이름이 비슷하다고 같이 2로 두면 조용히 틀립니다.
--
-- ★ 값은 통계에서만 씁니다. 단가는 제품마다 따로 매기므로 금액에는
--   영향이 없습니다 — 2개로 센다고 두 배로 청구되지 않습니다.
-- =========================================================

alter table prosthesis_materials
  add column unit_count integer not null default 1 check (unit_count between 1 and 9);

comment on column prosthesis_materials.unit_count is
  '통계에서 몇 개로 세는가. Abut+크라운처럼 한 치식에 둘을 만드는 제품은 2 (2026-10-12)';

-- 어버트먼트 **와** 크라운을 같이 만드는 제품만 2 입니다
update prosthesis_materials m
   set unit_count = 2
  from prosthesis_types t
 where t.id = m.type_id
   and t.code = 'implant'
   and m.code in ('abut_zir_scrp', 'abut_zir_cem', 'abut_pmma');
