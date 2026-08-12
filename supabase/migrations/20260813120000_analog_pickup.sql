-- =========================================================
-- 아날로그 주문의 수거요청이 실제로 만들어지고, 실제로 닫힐 수 있게 합니다.
-- (사용자 결정 2026-08-13 — "아날로그는 주문시 수거요청으로 가야해.
--  실제 임프로 작업을 진행하니깐")
--
-- 앱은 주문을 넣을 때 pickup_requests 를 함께 만듭니다. 그런데 지금
-- 정책 두 개가 그 길을 막고 있습니다.
--
-- ★ ① 넣는 사람이 치과여야만 했습니다.
--   그런데 디자인센터도 주문을 대신 넣습니다. 그 경로에서는 insert 가
--   RLS 에 막혀 **조용히 실패**합니다.
--   실제로 지금 리페어 주문 하나가 수거요청 없이 남아 있습니다 —
--   디자인센터가 대신 넣은 건입니다. 같은 구멍이었습니다.
--
-- ★ ② 주문할 때는 기공소가 아직 없습니다.
--   아날로그 수거는 접수 시점에 서는데, 기공소는 디자인센터가 나중에
--   배정합니다. pickup_update 정책이 `lab_org_id = my_org_id()` 라,
--   비어 있는 채로 두면 **아무도 수거완료를 누를 수 없습니다.**
--   제작 시작이 영영 막힙니다 (수거가 안 끝나면 제작을 못 엽니다).
--   그래서 배정되는 순간 트리거가 채워 넣습니다.
-- =========================================================

-- ---------- ① 디자인센터도 수거요청을 만들 수 있습니다 ----------

drop policy if exists pickup_insert on pickup_requests;

create policy pickup_insert on pickup_requests
  for insert with check (
    (clinic_org_id = my_org_id() and my_org_type() = 'clinic')
    -- 디자인센터는 자기 거래 치과의 것만. 남의 치과 이름으로는 못 만듭니다
    or (my_org_type() = 'design_center' and is_partner_org(clinic_org_id))
  );

-- ---------- ② 기공소가 배정되면 수거요청에도 채워 넣습니다 ----------

create or replace function pickup_fill_lab()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  /*
    ★ 비어 있는 것만 채웁니다.
      리페어 수거는 원주문의 기공소를 이미 물려받았습니다. 배정이
      바뀌었다고 그것까지 덮으면, 이미 물건을 받아 둔 기공소의 기록이
      다른 곳을 가리키게 됩니다.

    ★ 이미 끝난 수거도 안 건드립니다. 지나간 일입니다.
  */
  update pickup_requests
     set lab_org_id = new.lab_org_id
   where order_id = new.id
     and lab_org_id is null
     and status in ('open', 'assigned');

  return new;
end;
$$;

comment on function pickup_fill_lab() is
  '기공소가 배정되면 그 주문의 수거요청에도 채웁니다. 안 그러면 아무도 수거완료를 못 누릅니다';

drop trigger if exists orders_fill_pickup_lab on orders;

create trigger orders_fill_pickup_lab
  after update of lab_org_id on orders
  for each row
  when (new.lab_org_id is not null and new.lab_org_id is distinct from old.lab_org_id)
  execute function pickup_fill_lab();

-- ---------- 이미 배정된 주문의 빈 수거를 따라잡습니다 ----------

update pickup_requests p
   set lab_org_id = o.lab_org_id
  from orders o
 where o.id = p.order_id
   and p.lab_org_id is null
   and o.lab_org_id is not null
   and p.status in ('open', 'assigned');
