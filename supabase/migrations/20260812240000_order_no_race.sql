-- =========================================================
-- 주문번호가 부딪히던 것. (사용자 신고 2026-08-12 —
--   "리페어를 만들지 못했습니다: duplicate key ... orders_order_no_key")
--
-- ★ 원인 ① — 함수가 RLS 를 그대로 받았습니다.
--   next_order_no() 는 `select max(...) from orders` 로 오늘 번호를
--   셉니다. 그런데 security definer 가 아니라서 **부르는 사람의 눈**으로
--   봅니다. 치과는 자기 주문만 보이므로, 디자인센터가 다른 치과 건으로
--   이미 001 을 쓴 날에도 치과는 001 을 다시 계산합니다 → 충돌.
--
-- ★ 원인 ② — 세는 것과 넣는 것 사이에 틈이 있었습니다.
--   max 를 읽고 insert 하기까지 다른 요청이 끼어들면 둘 다 같은 번호를
--   듭니다. select 는 서로를 막지 않습니다.
--
-- ★ 그래서 '세어서 맞히는' 방식을 버립니다.
--   날짜별 counter 를 두고 **한 문장으로** 올려 받습니다.
--   insert … on conflict do update … returning 은 원자적이라 두 요청이
--   같은 값을 받을 수 없습니다.
--
--   대신 번호가 **비어 있을 수** 있습니다 — 번호를 받은 뒤 주문이
--   실패하면 그 번호는 안 쓰입니다. 청구서 번호와 같은 판단입니다
--   (20260812150000): 빈 번호보다 겹치는 번호가 훨씬 나쁩니다.
-- =========================================================

create table if not exists order_no_counters (
  day   date primary key,
  last  int  not null
);

comment on table order_no_counters is
  '날짜별 주문번호 카운터. 세는 것과 넣는 것 사이의 틈을 없앱니다';

-- 지금까지 쓴 번호에서 이어 갑니다
insert into order_no_counters (day, last)
select
  to_date(substring(order_no from 5 for 6), 'YYMMDD'),
  max(substring(order_no from 12)::int)
from orders
where order_no like 'ORD-______-%'
group by 1
on conflict (day) do update set last = greatest(order_no_counters.last, excluded.last);

-- ---------- 번호 만들기 ----------

create or replace function next_order_no()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  seq   int;
begin
  /*
    ★ 한 문장입니다. 두 요청이 같은 값을 받을 수 없습니다.
      전에는 max 를 읽고 나서 넣었는데, 그 사이에 남이 끼어들었습니다.
  */
  insert into order_no_counters (day, last)
  values (today, 1)
  on conflict (day) do update set last = order_no_counters.last + 1
  returning last into seq;

  return 'ORD-' || to_char(today, 'YYMMDD') || '-' || lpad(seq::text, 3, '0');
end;
$$;

-- ★ 카운터 표는 아무도 직접 안 봅니다. 함수만 만집니다
alter table order_no_counters enable row level security;

revoke all on function next_order_no() from public;
grant execute on function next_order_no() to authenticated;
