-- =========================================================
-- DS Flow — 앞 마이그레이션의 흠 하나 (열거형 타입)
-- 파일 위치: supabase/migrations/<타임스탬프>_mark_file_status_cast.sql
--
-- ★ upload_status 는 `file_upload_status` 열거형입니다.
--   글자(text)를 그대로 넣으면 Postgres 가 42804 로 거절합니다:
--     "column upload_status is of type file_upload_status but
--      expression is of type text"
--
--   진짜 계정으로 눌러 보고 알았습니다. 마이그레이션이 통과한 것과
--   함수가 도는 것은 다른 일입니다 — 안쪽은 부를 때 터집니다.
-- =========================================================

create or replace function mark_order_file_status(p_file_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order uuid;
  v_now   text;   -- 열거형을 글자로 받습니다. 비교만 하므로 이게 편합니다
begin
  if p_status not in ('uploaded', 'failed') then
    raise exception '올린 결과는 uploaded 나 failed 만 적을 수 있습니다';
  end if;

  select order_id, upload_status into v_order, v_now
  from order_files
  where id = p_file_id and deleted_at is null;

  if v_order is null then
    raise exception '그 파일 줄을 찾을 수 없습니다';
  end if;

  -- ★ 올리는 중이던 줄만입니다
  if v_now <> 'pending' then
    raise exception '이미 % 로 적힌 줄입니다', v_now;
  end if;

  -- ★ 올릴 수 있는 자리인가 — 저장소 정책과 **같은** 물음입니다
  if not can_write_order_file(v_order) then
    raise exception '이 주문에 파일을 올릴 수 있는 자리가 아닙니다';
  end if;

  update order_files
     set upload_status = p_status::file_upload_status
   where id = p_file_id;
end;
$$;

revoke execute on function mark_order_file_status(uuid, text) from public, anon;
grant execute on function mark_order_file_status(uuid, text) to authenticated, service_role;
