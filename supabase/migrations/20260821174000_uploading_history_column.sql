-- =========================================================
-- DS Flow — 상태 기록 칸 이름을 바로잡습니다
-- 파일 위치: supabase/migrations/<타임스탬프>_uploading_history_column.sql
--
-- ★ order_status_history 에는 `note` 가 아니라 **`reason`** 입니다.
--   앞 트리거가 없는 칸에 쓰려다 42703 으로 터졌습니다 — 그 바람에
--   파일 줄 지우기까지 통째로 되돌아갔습니다(같은 트랜잭션이라서요).
--
-- ★★ 여기서 배운 것 — **트리거가 터지면 원래 하려던 일도 못 합니다.**
--   기록 한 줄 남기려다 파일 삭제가 막혔습니다. 곁다리로 하는 일은
--   본래 하려던 일을 넘어뜨리지 않아야 합니다.
--   그래서 기록 남기기를 예외 처리로 감쌉니다 — 못 남겨도 상태는 넘어갑니다.
-- =========================================================

create or replace function advance_when_files_landed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order   uuid;
  v_left    int;
  v_landed  int;
begin
  v_order := coalesce(new.order_id, old.order_id);

  if not exists (
    select 1 from orders o
    where o.id = v_order and o.status = 'uploading'
  ) then
    return coalesce(new, old);
  end if;

  select
    count(*) filter (where f.upload_status in ('pending', 'failed')),
    count(*) filter (where f.upload_status = 'uploaded')
  into v_left, v_landed
  from order_files f
  where f.order_id = v_order
    and f.kind <> 'design'
    and f.deleted_at is null;

  if v_left = 0 and v_landed > 0 then
    update orders set status = 'received' where id = v_order;

    /*
      ★ '누가' 는 비워 둡니다. 사람이 아니라 마지막 파일이 옮긴
        것이라, 아무 이름이나 적으면 거짓이 됩니다.

      ★ 못 남겨도 넘어갑니다. 기록은 곁다리인데 그것 때문에
        본래 하려던 일(파일 올리기·지우기)이 넘어지면 안 됩니다.
    */
    begin
      insert into order_status_history (order_id, from_status, to_status, actor_user_id, reason)
      values (v_order, 'uploading', 'received', null, '파일이 다 올라와 접수되었습니다');
    exception when others then
      null;
    end;
  end if;

  return coalesce(new, old);
end;
$$;
