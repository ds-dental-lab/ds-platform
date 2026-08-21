-- =========================================================
-- DS Flow — 입금 되돌리기는 한 번만 (사용자 신고 2026-08-21)
-- 파일 위치: supabase/migrations/<타임스탬프>_payment_reversal.sql
--
-- 무엇이 났나.
--   '되돌리기' 를 누를 때마다 음수 줄이 **하나씩 더** 생겼습니다.
--   같은 입금 하나에 되돌림이 세 개 붙었습니다(2초 간격 세 번 클릭).
--   화면에는 되돌린 줄에도 여전히 '되돌리기' 가 떠 있었습니다.
--
--   50,000 짜리 입금 하나가 -150,000 이 되어, 합계가 10만원 어긋났습니다.
--
-- ★★ 그리고 이것이 **발행취소를 영영 막았습니다.**
--   발행취소는 '입금 줄이 하나라도 있으면' 막고 "입금을 먼저
--   되돌려 주세요" 라고 말합니다. 그런데 되돌리기는 줄을 **더 만듭니다.**
--   시키는 대로 할수록 더 못 하게 되는 안내였습니다.
--   (그 판단은 코드에서 '남은 금액' 으로 바꿉니다)
--
-- 어떻게 막나.
--   음수 줄이 **어느 입금을 되돌린 것인지** 적게 합니다. 그러면
--   "이미 되돌린 입금인가" 를 물을 수 있고, 한 입금에 되돌림이
--   둘 붙는 것을 DB 가 막습니다.
-- =========================================================

alter table billing_payments
  add column if not exists reverses_payment_id uuid
    references billing_payments(id) on delete restrict;

comment on column billing_payments.reverses_payment_id is
  '이 음수 줄이 되돌린 입금. 한 입금은 한 번만 되돌립니다 (2026-08-21)';

-- ★ 한 입금에 되돌림은 하나뿐입니다. 화면이 실수해도 여기서 막힙니다
create unique index if not exists billing_payments_reversal_once
  on billing_payments (reverses_payment_id)
  where reverses_payment_id is not null;

-- ---------- 이미 쌓인 줄에 짝을 붙입니다 ----------
--
-- ★ 옛 줄에는 이 값이 없습니다. 그대로 두면 "되돌린 적 없음" 으로
--   보여 또 되돌릴 수 있습니다.
--
-- ★ 금액과 시각으로 짝을 찾습니다 — 음수 줄마다, 아직 짝이 없는
--   **자기보다 먼저 생긴** 같은 금액의 양수 줄 중 가장 최근 것.
--   사람이 누른 순서가 그렇습니다.
--
-- ★ 짝을 못 찾은 음수 줄은 그냥 둡니다. 세 번 눌러 생긴 여분이
--   그런 줄이고, 그건 자료를 손보는 일이라 여기서 안 합니다.
do $$
declare
  neg record;
  target uuid;
begin
  for neg in
    select id, period_id, amount, created_at
    from billing_payments
    where amount < 0 and reverses_payment_id is null
    order by created_at
  loop
    select p.id into target
    from billing_payments p
    where p.period_id = neg.period_id
      and p.amount = -neg.amount
      and p.created_at < neg.created_at
      and not exists (
        select 1 from billing_payments r where r.reverses_payment_id = p.id
      )
    order by p.created_at desc
    limit 1;

    if target is not null then
      update billing_payments set reverses_payment_id = target where id = neg.id;
    end if;
  end loop;
end $$;
