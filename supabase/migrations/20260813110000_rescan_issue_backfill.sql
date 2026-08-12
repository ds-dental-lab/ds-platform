-- =========================================================
-- 지금 재스캔 상태인 주문에 딱지를 달아 줍니다.
-- (사용자 신고 2026-08-13 — "재스캔 이슈 조회가 되질 않는다")
--
-- ★ 원인은 딱지를 **여는 곳이 없었다**는 것입니다.
--   rescan.ts 에 닫는 코드는 있었지만 열린 적이 없어 늘 헛돌았습니다.
--   앞으로는 changeOrderStatus 가 재스캔으로 넘길 때 함께 넣습니다.
--
-- ★ 지나간 재스캔까지 되살리지는 않습니다.
--   지금 재스캔 상태인 건만 답니다. 이미 재업로드까지 끝난 건에
--   'resolved' 딱지를 뿌리면, 목록의 이슈 칸이 그쪽으로 바뀝니다
--   (안 풀린 것이 없으면 가장 최근 것을 보여 주는 규칙). 끝난 일로
--   지금 화면을 흔들 이유가 없습니다.
--
-- ★ 사유는 마지막 '재스캔으로' 이력에서 가져옵니다.
--   디자인센터가 재스캔을 걸 때 반드시 적게 되어 있는 그 글입니다.
-- =========================================================

insert into order_issues (order_id, issue_type, opened_by_org_id, opened_at, reason)
select
  o.id,
  'rescan'::order_issue_type,
  h.actor_org_id,
  h.created_at,
  h.reason
from orders o
join lateral (
  select h.actor_org_id, h.created_at, h.reason
  from order_status_history h
  where h.order_id = o.id and h.to_status = 'rescan'
  order by h.created_at desc
  limit 1
) h on true
where o.status = 'rescan'
  and o.deleted_at is null
  and not exists (
    select 1 from order_issues i
    where i.order_id = o.id
      and i.issue_type = 'rescan'
      and i.resolved_at is null
  );
