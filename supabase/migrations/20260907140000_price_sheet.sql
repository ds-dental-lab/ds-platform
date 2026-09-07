-- =========================================================
-- 수가표 보내기. (사용자 요청 2026-09-07 — "수가표 보내기 버튼,
-- 보내기 전에 조정, 지금 값이 기본값")
--
-- ★ organizations.price_sheet — 센터가 '기본값으로 저장' 한 표.
--   비어 있으면 코드의 기본값(domain/price-sheet)을 씁니다.
-- ★ contact_requests.price_sheet_sent / _at — 그 문의에 **무엇을 언제**
--   보냈는지. 단가가 바뀌어도 이 줄은 그때 값을 말해야 합니다.
-- =========================================================

alter table organizations
  add column if not exists price_sheet jsonb;

comment on column organizations.price_sheet is
  '수가표 기본값 [{group,item,price}]. null 이면 코드의 기본값';

alter table contact_requests
  add column if not exists price_sheet_sent    jsonb,
  add column if not exists price_sheet_sent_at timestamptz;

comment on column contact_requests.price_sheet_sent is
  '이 문의에 보낸 수가표 (보낸 그때의 값)';
