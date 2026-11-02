-- =========================================================
-- DS Flow — 청구서에 찍을 입금 계좌
-- 파일 위치: supabase/migrations/20261102120000_bank_account.sql
-- 기준: 사용자 요청 2026-11-02 — "정산서 계좌입력 만들어줘"
--
-- ★ 전에는 입력 칸이 아예 없어, 청구서가 금액과 납부기한만 말했습니다.
-- ★ 디자인센터 계정정보에서만 넣고, 치과로 가는 청구서에만 찍습니다.
--   기공소 청구서는 디자인센터가 주는 쪽이라 이 계좌를 찍으면 뜻이 뒤집힙니다.
-- ★ 나간 청구서도 지금 값으로 다시 그려집니다 (사업자 정보와 같습니다).
-- =========================================================

alter table organizations
  add column bank_name text,
  add column bank_account text,
  add column bank_holder text;

comment on column organizations.bank_account is '청구서에 찍는 입금 계좌. 디자인센터만 씁니다 (2026-11-02)';
