-- =========================================================
-- DS Flow — 스캔 파일이 '몇 개 중 몇 개' 올라왔는지
-- 파일 위치: supabase/migrations/<타임스탬프>_scan_file_count.sql
-- 기준: 사용자 요청 2026-08-12 — File Count (1/1)
--
-- 무엇을 재는가.
--   좌측  실제로 저장소에 올라온 개수 (order_files 줄 수)
--   우측  치과가 보내려고 한 개수 (여기 담습니다)
--
-- 왜 필요한가.
--   스캔 데이터는 한 개가 수백 MB 입니다. 올리다 끊기면 주문은 들어오고
--   파일만 빠집니다. 지금은 표에 줄이 없으니 **아무도 빠진 줄 모릅니다** —
--   디자인센터는 "원래 파일이 없는 주문" 으로 봅니다.
--   보내려던 개수를 남겨 두면 (2/3) 처럼 어긋남이 눈에 보입니다.
--
-- ★ 줄 수를 세어 두는 것이 아니라 '보내려 한 수' 를 담습니다.
--   둘이 같으면 이 칸은 쓸모가 없습니다. 다를 때를 잡는 것이 목적입니다.
-- =========================================================

alter table orders
  add column scan_file_expected smallint not null default 0
    check (scan_file_expected >= 0);

comment on column orders.scan_file_expected is
  '치과가 보내려고 한 스캔 파일 수. 실제 올라온 수(order_files)와 다르면 빠진 것이 있습니다';

-- 지난 주문은 올라온 만큼을 보내려 한 것으로 봅니다 — (n/n) 으로 보입니다
update orders o
   set scan_file_expected = coalesce((
     select count(*) from order_files f
     where f.order_id = o.id and f.kind = 'scan' and f.deleted_at is null
   ), 0);

-- ---------- 올리기 시작할 때 세어 둡니다 ----------
--
-- ★ 정책이 아니라 함수로 엽니다.
--   주문을 수정할 수 있는 사람만 이 칸을 건드려야 하는데, 그 판단은
--   이미 order_update 정책이 하고 있습니다. 그대로 얹습니다.
--
-- ★ 더하기만 합니다.
--   재스캔으로 두 번 올리면 보낸 수가 늘어납니다. 덮어쓰면 앞의 것이
--   사라져 "3개 보냈는데 1개만 왔다" 를 놓칩니다.
create or replace function note_planned_scan_files(p_order_id uuid, p_count smallint)
returns smallint
language plpgsql security invoker set search_path = public as $$
declare
  v_next smallint;
begin
  if p_count is null or p_count <= 0 then
    select scan_file_expected into v_next from orders where id = p_order_id;
    return coalesce(v_next, 0);
  end if;

  -- RLS(order_update)를 그대로 지납니다. 남의 주문이면 0행이라 null 이 옵니다
  update orders
     set scan_file_expected = scan_file_expected + p_count
   where id = p_order_id
   returning scan_file_expected into v_next;

  return coalesce(v_next, 0);
end;
$$;

comment on function note_planned_scan_files is
  '스캔 파일을 올리기 직전에 보내려는 개수를 더합니다. 끊겨도 흔적이 남습니다';

grant execute on function note_planned_scan_files(uuid, smallint) to authenticated;
