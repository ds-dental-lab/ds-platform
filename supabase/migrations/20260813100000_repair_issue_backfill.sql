-- =========================================================
-- 이미 만들어진 리페어 주문에 딱지를 달아 줍니다.
-- (사용자 요청 2026-08-13 — "리페어 이슈 딱지가 표현되었으면 해")
--
-- ★ 앞으로 만들어지는 건은 services/repair.ts 가 함께 넣습니다.
--   여기는 그 전에 들어온 건들을 따라잡는 한 번짜리입니다.
--
-- ★ reason 은 주문의 notes 에서 가져옵니다.
--   리페어를 넣을 때 "어디가 어떻게 문제인지" 를 거기에 적었습니다.
--   상세화면의 리페어 칸이 이 값을 그대로 읽습니다.
--
-- ★ opened_by_org_id 는 치과입니다.
--   리페어를 신청하는 쪽이 치과(또는 대신 넣은 디자인센터)인데,
--   지난 건은 누가 눌렀는지 order_issues 에 없습니다. 주문의 치과로
--   둡니다 — 화면에서 쓰는 값이 아니고, 비워 두면 '누구도 아님'이
--   되어 나중에 더 헷갈립니다.
-- =========================================================

insert into order_issues (order_id, issue_type, opened_by_org_id, opened_at, reason)
select
  o.id,
  'repair'::order_issue_type,
  o.clinic_org_id,
  coalesce(o.received_at, o.created_at),
  nullif(o.notes, '')
from orders o
where o.is_repair = true
  and o.deleted_at is null
  and not exists (
    select 1 from order_issues i
    where i.order_id = o.id and i.issue_type = 'repair'
  );
