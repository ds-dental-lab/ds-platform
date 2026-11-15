-- =========================================================
-- 임플란트 **폰틱**에는 제조사·타입을 요구하지 않습니다. (2026-11-15)
--
-- ★ 사고: ORD-261111-031 을 고치다 "violates check constraint
--   order_items_implant_required" 로 저장이 막혔고, 그때의 수정 코드는 먼저 지우고
--   넣었기 때문에 **보철 항목이 0개인 주문**이 남았습니다.
-- ★ 원인: 화면과 서버 검사는 "폰틱은 픽스처가 없으니 임플란트 모델을 안 묻는다" 인데
--   이 규칙만 폰틱에도 모델을 요구했습니다. 두 곳의 규칙이 어긋나 있었습니다.
--   폰틱은 심은 것이 없습니다 — 화면 쪽이 맞습니다.
-- =========================================================

alter table order_items drop constraint order_items_implant_required;

alter table order_items add constraint order_items_implant_required check (
  type_code <> 'implant'
  or is_pontic
  or (implant_manufacturer is not null and implant_type is not null)
);
