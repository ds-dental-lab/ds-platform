-- =========================================================
-- 화면 말고 DB 를 직접 찔러 봤더니 네 군데가 뚫렸습니다 (2026-08-13).
-- 상태 문지기(20260813140000)와 같은 종류입니다 — 서비스 계층만 막고
-- 있었고, 브라우저는 자기 세션으로 PostgREST 에 곧장 쏠 수 있습니다.
--
--   ③ 치과가 자기 조직의 **정산 기준일**을 바꿀 수 있었습니다
--   ④ 치과가 **완료된 주문의 보철 재료**를 바꿀 수 있었습니다 (금액 변조)
--   ⑤ 기공소가 **주문 항목을 지울** 수 있었습니다
--   ⑥ 치과가 **완료된 건의 파일**을 지울 수 있었습니다
--
-- ★ ①(역할 승격)과 ②(조직 종류 둔갑)는 이미 막혀 있었습니다.
--   membership_update_own_org 의 using 에 my_role() 검사가 있습니다.
-- =========================================================

-- ---------------------------------------------------------
-- ③ 조직이 자기 자신을 고칠 때 만지면 안 되는 칸
-- ---------------------------------------------------------
--
-- ★ 자기 조직 정보(상호·대표·연락처·청구 이메일)는 스스로 고칩니다.
--   그런데 **정산 기준일과 거래 상태는 다릅니다.** 기준일은 디자인센터가
--   거래처마다 정하는 값이고(사용자탭), 치과가 스스로 옮기면 이번 달에
--   나갈 청구가 다음 달로 밀립니다.
--
-- ★ 디자인센터가 거래처를 고치는 길은 그대로 둡니다.
--   org_update 정책의 뒷가지(is_my_partner_any_status)가 그것입니다.

create or replace function organizations_guard_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;                      -- service_role · 마이그레이션
  end if;

  -- 남이(=디자인센터가 거래처를) 고치는 경우는 여기서 안 봅니다
  if new.id is distinct from my_org_id() then
    return new;
  end if;

  if new.closing_day is distinct from old.closing_day then
    raise exception '정산 기준일은 디자인센터가 정합니다';
  end if;

  if new.org_type is distinct from old.org_type then
    raise exception '조직 종류는 바꿀 수 없습니다';
  end if;

  if new.status is distinct from old.status then
    raise exception '거래 상태는 스스로 바꿀 수 없습니다';
  end if;

  return new;
end;
$$;

drop trigger if exists organizations_guard_columns on organizations;

create trigger organizations_guard_columns
  before update on organizations
  for each row
  execute function organizations_guard_columns();

-- ---------------------------------------------------------
-- ④⑤ 주문 항목 · 제작옵션
-- ---------------------------------------------------------
--
-- ★ 전에는 "그 주문이 보이면 무엇이든" 이었습니다.
--     using (exists (select 1 from orders o where o.id = order_items.order_id))
--   기공소도 그 주문이 보이므로 항목을 지울 수 있었고, 치과는 완료된
--   주문의 재료를 바꿔 **금액을 바꿀** 수 있었습니다.
--
-- ★ 넣는 것과 고치는 것을 나눕니다.
--   리페어·리메이크는 **이미 제작대기인 새 주문**에 항목을 넣습니다
--   (치과 세션으로). 그래서 insert 까지 상태로 막으면 리페어가 깨집니다.
--   대신 고치기·지우기는 사양을 고칠 수 있는 동안만 엽니다 —
--   domain/order-status 의 canEditSpec 과 같은 규칙입니다.

drop policy if exists order_item_all on order_items;

create policy order_item_insert on order_items
  for insert with check (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and (o.clinic_org_id = my_org_id() or o.design_org_id = my_org_id())
    )
  );

create policy order_item_change on order_items
  for update using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and (o.clinic_org_id = my_org_id() or o.design_org_id = my_org_id())
        and (my_org_type() = 'design_center' or o.status in ('received', 'rescan'))
    )
  );

create policy order_item_remove on order_items
  for delete using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and (o.clinic_org_id = my_org_id() or o.design_org_id = my_org_id())
        and (my_org_type() = 'design_center' or o.status in ('received', 'rescan'))
    )
  );

create policy order_item_read on order_items
  for select using (
    exists (select 1 from orders o where o.id = order_items.order_id)
  );

-- 제작옵션도 같은 규칙입니다
drop policy if exists order_option_all on order_options;

create policy order_option_read on order_options
  for select using (
    exists (select 1 from orders o where o.id = order_options.order_id)
  );

create policy order_option_insert on order_options
  for insert with check (
    exists (
      select 1 from orders o
      where o.id = order_options.order_id
        and (o.clinic_org_id = my_org_id() or o.design_org_id = my_org_id())
    )
  );

create policy order_option_change on order_options
  for update using (
    exists (
      select 1 from orders o
      where o.id = order_options.order_id
        and (o.clinic_org_id = my_org_id() or o.design_org_id = my_org_id())
        and (my_org_type() = 'design_center' or o.status in ('received', 'rescan'))
    )
  );

create policy order_option_remove on order_options
  for delete using (
    exists (
      select 1 from orders o
      where o.id = order_options.order_id
        and (o.clinic_org_id = my_org_id() or o.design_org_id = my_org_id())
        and (my_org_type() = 'design_center' or o.status in ('received', 'rescan'))
    )
  );

-- ---------------------------------------------------------
-- ⑥ 파일 고치기 · 지우기
-- ---------------------------------------------------------
--
-- ★ domain/order-status 의 canDeleteFile 과 같은 규칙을 답니다.
--     · 접수 · 재스캔 · 디자인 상태에서만
--     · 디자인 파일은 디자인센터만
--     · 스캔 파일은 치과와 디자인센터
--   기공소는 어느 파일도 못 지웁니다 — 받아서 만드는 쪽입니다.
--
-- ★ 올리는 중인 줄의 upload_status 를 바꾸는 것도 update 입니다.
--   그래서 '접수·재스캔·디자인' 안에서는 열려 있어야 합니다.
--   그 세 상태가 곧 파일을 만질 수 있는 구간입니다 (canEditFiles).

drop policy if exists order_file_update on order_files;
drop policy if exists order_file_delete on order_files;

create policy order_file_update on order_files
  for update using (
    exists (
      select 1 from orders o
      where o.id = order_files.order_id
        and o.status in ('received', 'rescan', 'designing')
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
        and o.status in ('received', 'rescan', 'designing')
        and (
          case when order_files.kind = 'design'
               then o.design_org_id = my_org_id()
               else o.clinic_org_id = my_org_id() or o.design_org_id = my_org_id()
          end
        )
    )
  );
