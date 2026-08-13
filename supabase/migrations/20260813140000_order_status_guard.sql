-- =========================================================
-- 상태를 옮길 수 있는 자리를 DB 가 봅니다.
-- (사용자 신고 2026-08-13 — "치과 계정에서 완료처리가 된다니깐")
--
-- ★ 정책이 "이 주문과 관계있는 조직인가" 까지만 봤습니다.
--     order_update: clinic_org_id = my_org_id()
--                   or design_org_id = my_org_id()
--                   or lab_org_id = my_org_id()
--   **어느 칸을 어떻게 바꾸는지는 안 봤습니다.** 그래서 치과 계정이
--   자기 주문의 status 를 곧장 'completed' 로 적을 수 있었습니다.
--   실제로 확인했습니다 — 치과 눈으로 7건이 한 번에 완료로 바뀌었습니다
--   (rollback 함).
--
-- ★ 지금까지는 서비스 계층만 막고 있었습니다.
--   changeOrderStatus 가 canTransition 을 봅니다. 그런데 그건 우리
--   코드를 지나갈 때 이야기입니다. 브라우저는 anon 열쇠와 자기 세션을
--   그대로 들고 있어서, PostgREST 로 곧장 쏘면 그 검사를 건너뜁니다.
--   담당 디자이너를 막을 때와 똑같은 자리입니다 (orders_guard_designer).
--
-- ★ 규칙을 두 곳에 적는 부담은 압니다.
--   domain/order-status 와 여기가 같은 말을 합니다. 그래도 둡니다 —
--   한쪽은 "왜 버튼이 안 보이나" 를 정하고, 다른 쪽은 "무슨 짓을 해도
--   안 된다" 를 정합니다. 둘의 목적이 다릅니다.
--   ★ 전이 규칙을 고칠 일이 생기면 **두 곳을 함께** 고쳐야 합니다.
-- =========================================================

create or replace function orders_guard_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org        uuid;
  seats      text[];
  forward    text;
  owner_seat text;
begin
  -- 상태가 그대로면 볼 것이 없습니다
  if new.status is not distinct from old.status then
    return new;
  end if;

  /*
    ★ auth.uid() 가 없으면 통과시킵니다.
      service_role · 마이그레이션 · 트리거가 여기 걸립니다. 그쪽은
      어차피 무엇이든 할 수 있고, 막으면 데이터 손질이 불가능해집니다.
  */
  if auth.uid() is null then
    return new;
  end if;

  org := my_org_id();
  if org is null then
    raise exception '소속이 없는 계정은 주문 상태를 바꿀 수 없습니다';
  end if;

  -- 이 주문에서 맡은 자리들. 자사 제작이면 둘을 겸합니다
  seats := array_remove(array[
    case when new.clinic_org_id = org then 'clinic' end,
    case when new.design_org_id = org then 'design' end,
    case when new.lab_org_id    = org then 'lab'    end
  ], null);

  -- ---------- 옆으로 · 뒤로 가는 길 ----------

  -- 재스캔 요청 — 디자인센터가 접수·디자인에서
  if new.status = 'rescan' then
    if 'design' = any(seats) and old.status in ('received', 'designing') then
      return new;
    end if;

  -- 주문 취소 — 치과가 접수·재스캔에서
  elsif new.status = 'cancelled' then
    if 'clinic' = any(seats) and old.status in ('received', 'rescan') then
      return new;
    end if;

  -- 디자인으로 되돌리기 — 디자인센터만 (기공소가 수정을 요청했을 때)
  elsif new.status = 'designing' and old.status in ('production_wait', 'production') then
    if 'design' = any(seats) then
      return new;
    end if;
  end if;

  -- ---------- 앞으로 한 칸 ----------
  forward := case old.status
    when 'received'        then 'designing'
    when 'rescan'          then 'received'
    when 'designing'       then 'production_wait'
    when 'production_wait' then 'production'
    when 'production'      then 'shipping'
    when 'shipping'        then 'completed'
    else null                       -- 완료·취소에서 나가는 길은 없습니다
  end;

  owner_seat := case old.status
    when 'received'        then 'design'
    when 'rescan'          then 'clinic'
    when 'designing'       then 'design'
    when 'production_wait' then 'lab'
    when 'production'      then 'lab'
    when 'shipping'        then 'clinic'
    else null
  end;

  if forward is not null and new.status::text = forward and owner_seat = any(seats) then
    return new;
  end if;

  raise exception
    '이 주문을 % 에서 % (으)로 옮길 수 있는 자리가 아닙니다',
    old.status, new.status;
end;
$$;

comment on function orders_guard_status() is
  '상태 전이를 자리로 가릅니다. 서비스 계층(canTransition)과 같은 규칙 — 함께 고쳐야 합니다';

drop trigger if exists orders_guard_status on orders;

create trigger orders_guard_status
  before update of status on orders
  for each row
  execute function orders_guard_status();
