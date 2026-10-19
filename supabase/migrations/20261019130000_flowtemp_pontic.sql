-- =========================================================
-- FlowTemp 도 폰틱이 됩니다 (사용자 2026-10-19 — "FlowTemp 도 폰틱이 존재해")
--
-- ★ 임시 브릿지는 가운데 폰틱까지 한 덩어리로 뽑습니다. 재료에 has_pontic 이 꺼져
--   있어 우클릭(폰틱)이 "이 제품은 폰틱이 될 수 없습니다" 로 막혔습니다.
-- ★ 값은 0 — FlowTemp 는 과금 1안으로 크라운에 묶여 따로 받지 않습니다(price 도 비어 있음).
-- =========================================================

update prosthesis_materials m
   set has_pontic = true,
       pontic_price = 0
  from prosthesis_types t
 where m.type_id = t.id
   and t.code = 'auto_temp'
   and m.code = 'pmma';
