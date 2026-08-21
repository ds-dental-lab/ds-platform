-- =========================================================
-- DS Flow — 상태 문지기에게 '업로드중' 을 가르칩니다
-- 파일 위치: supabase/migrations/<타임스탬프>_guard_knows_uploading.sql
--
-- ★★ 트리거를 달아 놓고 눌러 보니 여기서 막혔습니다:
--     "이 주문을 uploading 에서 received (으)로 옮길 수 있는 자리가 아닙니다"
--
--   orders_guard_status 는 상태 전이를 '자리' 로 가리는데, 새 상태를
--   모르니 기본값(거절)으로 떨어집니다. **막는 쪽이 기본인 것은
--   맞습니다** — 몰라서 열어 두는 것보다 낫습니다.
--
--   security definer 로 역할은 바뀌어도 `auth.uid()` 는 그대로라,
--   '트리거니까 봐준다'(auth.uid() is null) 길로도 안 빠집니다.
--
-- 어떻게 여나.
--   ★ 깃발(set_config)을 세워 "이건 트리거야" 라고 알리는 방법도
--     있지만, 그러면 **깃발을 세울 수 있는 사람은 누구나** 지나갑니다.
--
--   ★ 대신 **조건을 여기서 다시 확인**합니다. 아직 자리를 못 잡은
--     스캔 줄이 없고, 자리를 잡은 것이 하나라도 있을 때만 엽니다.
--     그러면 누가 어떻게 부르든 — 트리거든, 화면이 직접 찌르든 —
--     파일이 진짜로 다 왔을 때만 접수가 됩니다.
--     문이 아니라 **사실**이 판단합니다.
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
  v_left     int;
  v_landed   int;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  /*
    ★★ 업로드중 → 접수는 **자리가 아니라 파일이** 정합니다
      (작업지시서 §3-3). auth.uid() 를 보기 전에 여기서 가릅니다 —
      사람이 부르든 트리거가 부르든 같은 잣대여야 합니다.
  */
  if old.status = 'uploading' and new.status = 'received' then
    select
      count(*) filter (where f.upload_status in ('pending', 'failed')),
      count(*) filter (where f.upload_status = 'uploaded')
    into v_left, v_landed
    from order_files f
    where f.order_id = new.id
      and f.kind <> 'design'
      and f.deleted_at is null;

    if v_left = 0 and v_landed > 0 then
      return new;
    end if;

    raise exception
      '아직 올라오지 않은 스캔 파일이 있습니다 (올라감 %, 남음 %)', v_landed, v_left;
  end if;

  /*
    ★ auth.uid() 가 없으면 통과시킵니다.
      service_role · 마이그레이션이 여기 걸립니다. 그쪽은 어차피
      무엇이든 할 수 있고, 막으면 데이터 손질이 불가능해집니다.
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
  --
  -- ★ 'uploading' 은 여기 없습니다. 위에서 이미 가렸고, 사람이 미는
  --   길은 애초에 없습니다 (domain/order-status 의 canTransition 도 같습니다).
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
  '상태 전이를 자리로 가립니다. 업로드중→접수만은 자리가 아니라 파일이 정합니다 (§3-3)';

-- ---------- 죽은 함수 하나 치웁니다 ----------
--
-- ★ note_planned_scan_files 는 orders.scan_file_expected 를 읽는데,
--   그 칸은 바로 다음 마이그레이션(20260812060000)이 걷어냈습니다.
--   부르면 터지는 함수가 반년째 남아 있었습니다. 부르는 곳은 없습니다.
--   매니페스트는 이제 '올리기 전에 만들어 두는 order_files 줄' 입니다.
drop function if exists note_planned_scan_files(uuid, smallint);
