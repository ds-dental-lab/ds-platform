-- 제작옵션이 빈 리메이크 9건을 채웁니다 (2026-11-24, 한 번만 실행).
--
-- 원주문에 값이 있으면 그 값을, 없으면 기본값을 넣습니다.
-- 이미 값이 있는 주문·그룹은 건드리지 않습니다 (on conflict do nothing).
-- 다시 실행해도 더 들어가지 않습니다.

with defaults as (
  select distinct on (g.id) g.id as group_id, v.id as value_id
  from production_option_groups g
  join production_option_values v on v.group_id = g.id
  order by g.id, v.is_default desc, v.sort_order, v.value
),
target as (
  select o.id, o.parent_order_id
  from orders o
  where o.deleted_at is null
    and o.is_remake
    and not exists (select 1 from order_options x where x.order_id = o.id)
),
filled as (
  insert into order_options (order_id, option_group_id, option_value_id)
  select t.id, d.group_id, coalesce(po.option_value_id, d.value_id)
  from target t
  cross join defaults d
  left join order_options po
    on po.order_id = t.parent_order_id and po.option_group_id = d.group_id
  on conflict (order_id, option_group_id) do nothing
  returning order_id
)
select count(*) as rows_added, count(distinct order_id) as orders_filled from filled;
