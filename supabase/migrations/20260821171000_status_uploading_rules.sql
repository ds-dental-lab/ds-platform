-- =========================================================
-- DS Flow — '업로드중' 이 스스로 접수로 넘어가게 (작업지시서 §3-3)
-- 파일 위치: supabase/migrations/<타임스탬프>_status_uploading_rules.sql
--
-- ★★ **왜 사람이 안 누르나.**
--   누를 사람은 파일을 올리고 있는 치과인데, 그 사람은 몇 개가
--   올라갔는지 셀 이유가 없습니다. 세는 것은 기계가 할 일입니다.
--   버튼으로 두면 덜 올라간 채로 눌러 넘길 수 있고, 그러면 이
--   상태를 만든 이유가 통째로 사라집니다.
--
-- ★ 조건은 하나입니다 — **스캔칸에 아직 자리를 못 잡은 줄이 없는가.**
--   `pending`(올리는 중)도, `failed`(못 올림)도 남아 있으면 안 됩니다.
--   실패가 하나라도 있으면 업로드중에 머무릅니다. 치과 화면이
--   "몇 개 중 몇 개" 와 다시 시도를 보여 줍니다.
--
-- ★ 디자인 파일은 안 셉니다. 그건 디자인센터가 나중에 올리는 것이라
--   접수 여부와 상관이 없습니다.
--
-- ★ 트리거를 **표에** 답니다. 화면에 두면 길이 여럿이라
--   (주문등록·주문수정·재스캔) 언젠가 한 곳을 빠뜨립니다.
-- =========================================================

create or replace function advance_when_files_landed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_left int;
begin
  -- 업로드중인 주문일 때만 봅니다
  if not exists (
    select 1 from orders o
    where o.id = new.order_id and o.status = 'uploading'
  ) then
    return new;
  end if;

  select count(*) into v_left
  from order_files f
  where f.order_id = new.order_id
    and f.kind <> 'design'
    and f.deleted_at is null
    and f.upload_status in ('pending', 'failed');

  if v_left = 0 then
    update orders set status = 'received' where id = new.order_id;

    /*
      ★ 상태 기록에도 남깁니다. '누가' 는 비어 있습니다 — 사람이 아니라
        마지막 파일이 옮긴 것이라, 아무 이름이나 적으면 거짓이 됩니다.
    */
    insert into order_status_history (order_id, from_status, to_status, actor_user_id, note)
    values (new.order_id, 'uploading', 'received', null, '파일이 다 올라와 접수되었습니다');
  end if;

  return new;
end;
$$;

comment on function advance_when_files_landed is
  '마지막 스캔 파일이 자리를 잡으면 업로드중 → 접수 (작업지시서 §3-3)';

drop trigger if exists order_files_advance_status on order_files;

create trigger order_files_advance_status
  after insert or update of upload_status, deleted_at on order_files
  for each row execute function advance_when_files_landed();

-- ---------- 파일을 만질 수 있는 구간에 업로드중을 더합니다 ----------
--
-- ★ 이게 없으면 **다시 시도를 못 합니다.** 파일이 덜 올라가서 만든
--   상태인데 파일을 못 지우면 영영 못 빠져나옵니다.
--   (domain/order-status 의 FILE_EDITABLE_STATUSES 와 같은 목록입니다)
drop policy if exists order_file_update on order_files;
drop policy if exists order_file_delete on order_files;

create policy order_file_update on order_files
  for update using (
    exists (
      select 1 from orders o
      where o.id = order_files.order_id
        and o.status in ('uploading', 'received', 'rescan', 'designing')
        and (
          case when order_files.kind = 'design'
               then o.design_org_id = my_org_id()
               else o.clinic_org_id = my_org_id() or o.design_org_id = my_org_id()
          end
        )
    )
  );

create policy order_file_delete on order_files
  for delete using (
    exists (
      select 1 from orders o
      where o.id = order_files.order_id
        and o.status in ('uploading', 'received', 'rescan', 'designing')
        and (
          case when order_files.kind = 'design'
               then o.design_org_id = my_org_id()
               else o.clinic_org_id = my_org_id() or o.design_org_id = my_org_id()
          end
        )
    )
  );
