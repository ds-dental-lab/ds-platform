-- =========================================================
-- DS Flow — 되돌림 줄은 되돌리지 못하게 (DB 쪽 문지기)
-- 파일 위치: supabase/migrations/<타임스탬프>_payment_reversal_guard.sql
--
-- ★ 고유 색인이 '한 입금에 되돌림 하나' 는 막았습니다. 그런데
--   **되돌림 줄을 가리키는 되돌림** 은 그냥 들어갔습니다 —
--   진짜 계정으로 찔러 보고 알았습니다(201).
--   코드는 막고 있지만, 이 프로젝트 규칙은 **DB 부터** 입니다.
--
-- ★ 금액도 함께 봅니다. 되돌림은 원래 금액의 **정확한 음수** 여야
--   합니다. 아니면 '되돌렸다' 고 적힌 줄이 실제로는 다른 금액을
--   움직이게 됩니다 — 장부에서 제일 나쁜 종류의 거짓말입니다.
-- =========================================================

create or replace function billing_payments_guard_reversal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target record;
begin
  if new.reverses_payment_id is null then
    return new;
  end if;

  select id, period_id, amount, reverses_payment_id
    into target
  from billing_payments
  where id = new.reverses_payment_id;

  if target.id is null then
    raise exception '되돌릴 입금을 찾을 수 없습니다';
  end if;

  if target.reverses_payment_id is not null then
    raise exception '되돌림 줄은 되돌릴 수 없습니다';
  end if;

  if target.period_id <> new.period_id then
    raise exception '다른 청구서의 입금은 되돌릴 수 없습니다';
  end if;

  if new.amount <> -target.amount then
    raise exception '되돌림 금액이 원래 입금과 맞지 않습니다 (원래 %, 되돌림 %)',
      target.amount, new.amount;
  end if;

  return new;
end;
$$;

drop trigger if exists billing_payments_reversal_guard on billing_payments;

create trigger billing_payments_reversal_guard
  before insert or update of reverses_payment_id, amount on billing_payments
  for each row execute function billing_payments_guard_reversal();
