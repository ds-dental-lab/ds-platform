-- =========================================================
-- DS Flow — 청구서 번호 · 납부기한 · 입금 기록
-- 파일 위치: supabase/migrations/<타임스탬프>_invoice_and_payment.sql
--
-- 사용자 요청 2026-08-12 (쓰던 시스템 화면을 기준으로) —
--   청구 내역 목록 · 정산 내려받기 · 재발송 · 취소 · 정산(입금)
--   "정산을 클릭시 할당된 정산금액 입력시 상태가 입금으로 변경되게"
--
-- ★ 청구서는 '그때 그 주소로 나간 문서' 입니다 — 발행 시점을 굳힙니다.
--   치과가 나중에 이메일을 바꿔도, 지난 청구서가 "새 주소로 보냈다" 고
--   말하면 안 됩니다. 방법(이메일/팩스)과 받는 곳을 발행할 때 베껴 둡니다.
--   금액을 billing_lines 로 굳히는 것과 같은 이유입니다.
--
-- ★ 입금은 여러 번 나눠 들어옵니다.
--   paid_at 한 칸으로는 '반만 들어왔다' 를 적을 수 없습니다.
--   줄로 쌓고, 미납은 청구액에서 빼서 셉니다.
--   paid_at 은 '다 받은 날' 로 남겨 둡니다 (마지막 입금이 채운 순간).
-- =========================================================

-- ---------- 청구서 번호 ----------
--
-- INV-26000489 — INV + 두 자리 연도 + 여섯 자리.
-- ★ 해가 바뀌어도 번호를 안 돌립니다.
--   1월에 000001 로 되돌리면, 지난해 것과 헷갈리는 순간이 반드시 옵니다.
--   앞의 연도는 눈으로 읽는 표시일 뿐이고 번호는 계속 이어집니다.

create sequence if not exists invoice_no_seq start 1;

create or replace function next_invoice_no()
returns text
language sql volatile as $$
  select 'INV-' || to_char(now() at time zone 'Asia/Seoul', 'YY')
      || lpad(nextval('invoice_no_seq')::text, 6, '0');
$$;

-- ---------- 청구서가 된 기간 ----------

alter table billing_periods
  add column if not exists invoice_no     text unique,
  -- 발행 시점에 베낀 값들. 나중에 거래처 정보가 바뀌어도 안 따라갑니다
  add column if not exists invoice_method invoice_method,
  add column if not exists invoice_to     text,
  add column if not exists due_date       date,
  -- 다시 보낸 횟수. 실제 발송이 붙기 전까지는 '사람이 보내고 눌러 둔 기록'
  add column if not exists sent_count     smallint not null default 0,
  add column if not exists last_sent_at   timestamptz;

comment on column billing_periods.invoice_to is
  '발행할 때 베낀 받는 곳 (이메일 또는 팩스). 거래처가 바뀌어도 안 따라갑니다';
comment on column billing_periods.due_date is '납부기한. 발행할 때 정해집니다';

-- ---------- 입금 ----------

create table if not exists billing_payments (
  id         uuid primary key default gen_random_uuid(),
  period_id  uuid not null references billing_periods(id) on delete cascade,

  -- ★ 음수도 받습니다. 잘못 넣은 입금을 지우지 않고 되돌리기 위해서입니다 —
  --   지워 버리면 "왜 금액이 달라졌지" 가 아무 데도 안 남습니다.
  amount     bigint not null,
  paid_on    date not null default (now() at time zone 'Asia/Seoul')::date,
  memo       text,

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists billing_payments_period_idx on billing_payments (period_id);

comment on table billing_payments is '입금 기록. 미납은 청구액에서 이 합을 뺀 값입니다';

alter table billing_payments enable row level security;

-- ---------- 누가 보는가 ----------
--
-- ★ 자기 청구서의 입금은 당사자도 봅니다.
--   "넣었는데 왜 미납이냐" 는 물음이 가장 흔합니다. 보여 주면 안 물어봅니다.

create policy payment_select on billing_payments
  for select using (
    exists (
      select 1 from billing_periods p
      where p.id = billing_payments.period_id
        and (p.owner_org_id = my_org_id() or p.party_org_id = my_org_id())
    )
  );

-- ★ 적는 쪽은 청구한 쪽뿐입니다. 받는 쪽이 스스로 '냈다' 고 적으면
--   그건 입금 기록이 아니라 주장입니다.
create policy payment_insert on billing_payments
  for insert with check (
    exists (
      select 1 from billing_periods p
      where p.id = billing_payments.period_id and p.owner_org_id = my_org_id()
    )
  );

create policy payment_delete on billing_payments
  for delete using (
    exists (
      select 1 from billing_periods p
      where p.id = billing_payments.period_id and p.owner_org_id = my_org_id()
    )
  );
