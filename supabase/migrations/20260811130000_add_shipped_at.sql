-- =========================================================
-- DS Flow — 실제 배송일 기록
-- 파일 위치: supabase/migrations/<타임스탬프>_add_shipped_at.sql
-- 기준: 사용자 결정 2026-08-11 — 정산 기간 귀속은 실제 배송일로
--
-- 왜 요청시한이 아니라 배송일인가.
--   ① 요청시한은 바뀝니다. 치과가 접수에서 고치고, 디자인센터는 그 뒤로도
--      고칩니다. 기간을 가르는 기준이 움직이면 날짜만 바꿔 청구를 미룰 수
--      있습니다.
--   ② 늦어진 주문이 어디에도 안 잡힙니다. 요청시한 8/20 인 주문이 9/5 에
--      배송되면, 8월엔 배송 전이라 빠지고 9월엔 요청시한이 범위 밖이라
--      빠집니다. 영영 청구되지 않습니다.
--
--   배송으로 넘어간 날은 바꿀 수 없는 사실이고, "물건이 나간 달에 청구한다"
--   가 상식에도 맞습니다. 늦어져도 나간 달에 반드시 한 번 잡힙니다.
--
-- ★ 요청시한은 버리지 않습니다.
--   아직 안 나간 건까지 더한 '이번 달 예상 청구액' 을 보여주는 데 씁니다.
--   치과는 미리 알고 싶어 합니다.
-- =========================================================

alter table orders add column shipped_at timestamptz;

comment on column orders.shipped_at is '배송 상태로 넘어간 시각. 정산 기간을 가르는 기준입니다';

create index orders_shipped_idx on orders (shipped_at);

-- 이미 배송·완료로 넘어간 주문은 이력에서 그 시각을 찾아 채웁니다.
-- 이력이 없는 옛 주문은 비워 둡니다 — 없는 사실을 지어내지 않습니다.
update orders o
   set shipped_at = h.first_at
  from (
    select order_id, min(created_at) as first_at
      from order_status_history
     where to_status = 'shipping'
     group by order_id
  ) h
 where h.order_id = o.id
   and o.shipped_at is null;
