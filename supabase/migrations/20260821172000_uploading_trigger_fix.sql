-- =========================================================
-- DS Flow — 넘어가는 조건을 다듬습니다 (앞 파일의 빈틈 둘)
-- 파일 위치: supabase/migrations/<타임스탬프>_uploading_trigger_fix.sql
--
-- 빈틈 ①  **지우는 것을 안 봤습니다.**
--   파일 줄은 소프트 삭제가 아니라 **통째로 지웁니다**
--   (actions/order-file). after update 만 걸어 두면, 못 올린 줄을
--   지워서 남은 것이 없어져도 트리거가 안 돕니다 — 주문이 업로드중에
--   영영 갇힙니다.
--
-- 빈틈 ②  **올라간 것이 하나도 없어도 넘어갔습니다.**
--   '못 올린 줄이 없다' 만 봤기 때문입니다. 세 개를 올리려다 전부
--   지우면 남은 줄이 0이 되고, 스캔이 한 장도 없는 주문이 접수로
--   섭니다. **한 장이라도 자리를 잡았을 때만** 넘어갑니다.
--
-- ★ '보내려 한 수'(scan_file_expected)와는 견주지 않습니다.
--   못 올린 파일을 다시 시도하는 대신 **빼기로 마음먹는** 일이
--   있습니다. 그때 보내려 한 수는 그대로라, 견주면 주문이 영영
--   안 넘어갑니다. 지금 남은 것으로 판단하는 편이 사람의 뜻에
--   가깝습니다.
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
  -- ★ 지울 때는 new 가 없습니다
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
      ★ '누가' 는 비어 있습니다. 사람이 아니라 마지막 파일이 옮긴
        것이라, 아무 이름이나 적으면 거짓이 됩니다.
    */
    insert into order_status_history (order_id, from_status, to_status, actor_user_id, note)
    values (v_order, 'uploading', 'received', null, '파일이 다 올라와 접수되었습니다');
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists order_files_advance_status on order_files;

create trigger order_files_advance_status
  after insert or update or delete on order_files
  for each row execute function advance_when_files_landed();
