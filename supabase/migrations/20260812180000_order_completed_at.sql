-- =========================================================
-- DS Flow — 주문이 '완료된 날' 을 따로 둡니다
-- 파일 위치: supabase/migrations/<타임스탬프>_order_completed_at.sql
--
-- 왜 필요한가.
--   보관기간(20260812170000)이 파일을 '주문이 완료된 날' 부터 셉니다.
--   그런데 셀 것이 updated_at 뿐이었습니다 — orders_touch 트리거가
--   **아무 수정에나** 그 값을 밀어 올립니다.
--
--   실제로 재 봤습니다: ORD-260808-004 는 08-08 에 완료됐는데
--   updated_at 은 08-11 입니다. 리메이크가 걸리거나 메모 한 줄만 고쳐도
--   시계가 뒤로 갑니다. 그러면 **파기가 조용히 안 일어납니다** —
--   화면에는 "완료된 날부터 1년" 이라고 적혀 있는데도.
--
-- ★ 이력에서 그때그때 찾지 않고 칸으로 둡니다.
--   order_status_history 를 뒤지면 매번 max() 를 떠야 하고,
--   파일 표에서 그 값으로 거르기가 어렵습니다.
--
-- ★ 다시 열리면 지웁니다.
--   완료를 되돌린 주문은 '완료된 적 없는' 상태로 돌아가야 합니다.
--   값이 남아 있으면 아직 진행 중인 주문의 파일이 파기 대상이 됩니다.
-- =========================================================

alter table orders add column if not exists completed_at timestamptz;

comment on column orders.completed_at is
  '완료로 넘어간 시각. 보관기간이 이 날부터 셉니다 (updated_at 은 아무 수정에나 밀립니다)';

create index if not exists orders_completed_at_idx on orders (completed_at)
  where completed_at is not null;

-- ---------- 있던 것 채우기 ----------
--
-- 이력에 남아 있는 마지막 '완료' 시각으로.

update orders o
set completed_at = h.at
from (
  select order_id, max(created_at) as at
  from order_status_history
  where to_status = 'completed'
  group by order_id
) h
where h.order_id = o.id
  and o.status = 'completed'
  and o.completed_at is null;

-- 이력이 없는 옛 주문은 마지막으로 손댄 날로 둡니다 (없는 것보다 낫습니다)
update orders
set completed_at = updated_at
where status = 'completed' and completed_at is null;

-- ---------- 앞으로 ----------
--
-- ★ 서비스 코드가 아니라 트리거가 찍습니다.
--   상태를 바꾸는 길이 여럿입니다 (다음 단계 · 되돌리기 · 리페어).
--   한 곳이라도 빠뜨리면 그 주문만 영영 안 지워집니다.

create or replace function touch_completed_at()
returns trigger
language plpgsql as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := now();
  elsif new.status <> 'completed' then
    -- 되돌렸으면 지웁니다 — 아직 끝난 주문이 아닙니다
    new.completed_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_completed_at on orders;

create trigger orders_completed_at
  before update of status on orders
  for each row execute function touch_completed_at();
