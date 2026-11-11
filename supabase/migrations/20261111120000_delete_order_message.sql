-- 대화 글 지우기를 함수로 (2026-11-11, 사용자 "이거 왜 삭제가안되나")
--
-- ★ 증상: 지우기를 누르면 "new row violates row-level security policy for table order_messages".
-- ★ 원인: 지우기는 줄을 없애지 않고 deleted_at 을 채우는 update 입니다. 그런데 읽기 규칙이
--   "deleted_at is null" 입니다. Postgres 는 where 조건이 있는 update 에서 **바뀐 뒤의 줄도
--   읽기 규칙을 통과해야** 한다고 봅니다. 숨기는 순간 그 줄은 읽기 규칙에 안 맞으므로
--   이 update 는 화면 쪽 권한으로는 **어떻게 써도 통과하지 못합니다**.
--   2026-10-28 에 "되돌려 읽지 않으면 된다" 고 고쳤지만 틀린 진단이었습니다 (실제로 지워 보지 않았음).
-- ★ 고침: 권한 검사를 함수 안에서 하고 함수가 직접 숨깁니다. 조건은 전과 같습니다 —
--   글쓴 조직 본인, 또는 그 주문의 디자인센터. 그리고 그 주문이 보이는 사람이어야 합니다.
--   읽기 규칙은 그대로 둡니다 (지운 글은 계속 아무에게도 안 보입니다).

create or replace function delete_order_message(p_message_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order  uuid;
  v_author uuid;
begin
  if auth.uid() is null or my_org_id() is null then
    raise exception '로그인이 필요합니다' using errcode = '28000';
  end if;

  select m.order_id, m.author_org_id into v_order, v_author
  from order_messages m
  where m.id = p_message_id and m.deleted_at is null;

  -- 없는 글·이미 지운 글 — 0줄은 오류가 아닙니다 (부른 쪽이 null 로 압니다)
  if v_order is null then
    return null;
  end if;

  if not can_access_order(v_order) then
    return null;
  end if;

  if not (
    v_author = my_org_id()
    or (
      my_org_type() = 'design_center'
      and exists (select 1 from orders o where o.id = v_order and o.design_org_id = my_org_id())
    )
  ) then
    return null;
  end if;

  update order_messages set deleted_at = now()
  where id = p_message_id and deleted_at is null;

  return v_order;
end;
$$;

revoke all on function delete_order_message(uuid) from public, anon;
grant execute on function delete_order_message(uuid) to authenticated;

comment on function delete_order_message(uuid) is
  '대화 글 숨기기(deleted_at). 글쓴 조직 또는 그 주문의 디자인센터만. 지운 주문 id 를 돌려주고, 못 지우면 null (2026-11-11).';
