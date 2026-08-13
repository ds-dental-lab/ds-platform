-- =========================================================
-- 청구서 발행·취소를 DB 도 봅니다. (2026-08-13 돈 흐름 점검)
--
-- 마감 → 발행 → 입금 → 마이너스 청구서까지 끝까지 태워 봤습니다.
-- 나머지는 다 맞았고, 한 군데만 화면에만 있었습니다.
--
-- ★ **입금이 적힌 청구서의 발행을 무를 수 있었습니다.**
--   submitCancelInvoice 는 입금 줄을 먼저 세고 막습니다. 그런데 그건
--   우리 코드를 지나갈 때 이야기입니다. 곧장 update 를 쏘면 통과했습니다.
--
--   무르면 issued_at 이 비고, 청구 내역 목록은 발행된 것만 보여 주므로
--   그 청구서가 **목록에서 사라집니다.** 그런데 입금 줄은 그대로
--   남습니다 — 받은 돈이 어느 청구서 것인지 화면에서 사라집니다.
--
-- ★ 마감 안 한 기간을 발행하는 것도 함께 막습니다.
--   앱은 `.not('closed_at','is',null)` 로 거르지만 같은 이유입니다.
--   굳지 않은 금액에 번호를 붙이면, 그 뒤에 주문을 손대는 순간
--   청구서와 실제가 어긋납니다.
-- =========================================================

create or replace function billing_periods_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  paid_count int;
begin
  if auth.uid() is null then
    return new;                       -- service_role · 마이그레이션
  end if;

  -- ① 발행을 무르는 경우 — 입금이 있으면 막습니다
  if old.issued_at is not null and new.issued_at is null then
    select count(*) into paid_count
      from billing_payments
     where period_id = old.id;

    if paid_count > 0 then
      raise exception
        '입금이 적힌 청구서입니다 (%건). 입금을 먼저 되돌려 주세요', paid_count;
    end if;
  end if;

  -- ② 마감하지 않은 기간에 번호를 붙이는 경우
  if new.issued_at is not null and old.issued_at is null and new.closed_at is null then
    raise exception '마감한 기간만 청구서를 발행할 수 있습니다';
  end if;

  return new;
end;
$$;

comment on function billing_periods_guard() is
  '발행 취소는 입금이 없을 때만. 발행은 마감한 기간만 — 서비스 계층과 같은 규칙';

drop trigger if exists billing_periods_guard on billing_periods;

create trigger billing_periods_guard
  before update on billing_periods
  for each row
  execute function billing_periods_guard();
