-- =========================================================
-- 저장소(파일 덩어리)도 자리를 봅니다. (2026-08-13 점검)
--
-- ★ 정책이 하나뿐이었고 그것이 `for all` 이었습니다.
--     bucket_id = 'order-files' and can_access_order(foldername(name)[2])
--   can_access_order 는 "이 주문의 세 자리 중 하나인가" 만 봅니다.
--   그래서 **기공소가 치과의 스캔 파일 덩어리를 지울 수 있었습니다.**
--
--   방금 order_files(표)는 좁혔지만 저장소는 다른 문입니다. 표의 줄을
--   못 지워도 덩어리를 지우면 파일은 사라집니다 — 줄만 남고 열리지
--   않는 상태가 됩니다.
--
-- ★ 내려받기는 셋 다 열어 둡니다.
--   기공소는 스캔과 디자인 파일로 물건을 만듭니다. 치과는 자기가 보낸
--   것과 결과를 봅니다. 읽기까지 막으면 일이 안 됩니다.
--
-- ★ 올리고 지우는 것은 치과와 디자인센터뿐입니다.
--   기공소는 받아서 만드는 쪽입니다 — 이 저장소에 올릴 것이 없습니다
--   (디자인 파일은 디자인센터가, 스캔은 치과가 올립니다).
--
-- ★ 파기는 이 정책을 안 지납니다.
--   보관기간 파기는 완료된 건을 지우는 일이라 service_role 로 돕니다
--   (actions/retention). 사용자 열쇠로는 여기서 막힙니다.
-- =========================================================

create or replace function can_write_order_file(target_order uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from orders o
    where o.id = target_order
      and (o.clinic_org_id = my_org_id() or o.design_org_id = my_org_id())
  );
$$;

comment on function can_write_order_file(uuid) is
  '이 주문의 파일을 올리거나 지울 수 있는 자리인가. 기공소는 받아서 만드는 쪽이라 빠집니다';

drop policy if exists "order files all" on storage.objects;

-- 내려받기 — 세 자리 모두
create policy "order files read" on storage.objects
  for select using (
    bucket_id = 'order-files'
    and can_access_order(((storage.foldername(name))[2])::uuid)
  );

-- 올리기 — 치과 · 디자인센터
create policy "order files write" on storage.objects
  for insert with check (
    bucket_id = 'order-files'
    and can_write_order_file(((storage.foldername(name))[2])::uuid)
  );

-- 덮어쓰기 — 치과 · 디자인센터
create policy "order files replace" on storage.objects
  for update using (
    bucket_id = 'order-files'
    and can_write_order_file(((storage.foldername(name))[2])::uuid)
  );

-- 지우기 — 치과 · 디자인센터
create policy "order files remove" on storage.objects
  for delete using (
    bucket_id = 'order-files'
    and can_write_order_file(((storage.foldername(name))[2])::uuid)
  );
