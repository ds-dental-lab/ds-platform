-- 임시치아만 있는 주문의 종류 'temp' (과금 2안, 2026-10-22)
-- ★ 리페어가 order_type = 'repair' 로 갈라지듯, 임시치아만 주문도 종류로 가릅니다.
--   상태 기계는 그대로. 센터 접수 목록·HOME 에서 빠지고, 출력이 끝나면 저절로 완료됩니다.
alter type order_type add value if not exists 'temp';
