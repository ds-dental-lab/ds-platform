-- =========================================================
-- 알림 · 이벤트 · 열람 기록을 아무나 만들 수 있었습니다. (2026-08-13 점검)
--
-- ★ ① 남의 종에 가짜 알림을 꽂을 수 있었습니다.
--     notification_insert: auth.uid() is not null
--   로그인만 했으면 **어느 조직 앞으로든** 제목·본문·링크를 마음대로 넣어
--   만들 수 있었습니다. 링크는 종에서 누르면 그대로 이동합니다 —
--   "[가짜] 청구서를 확인해 주세요 → https://evil.example.com" 이
--   디자인센터 종에 실제로 꽂혔습니다.
--
--   ★ 처음 정책의 주석은 이렇게 적혀 있었습니다.
--     "대신 **관련된 주문이 있어야만** 만들 수 있게 묶습니다"
--   묶는 코드가 없었습니다. 이번 주에 계속 나온 그 모양입니다.
--
-- ★ ② 남의 이름으로 도메인 이벤트를 심을 수 있었습니다.
--
-- ★ ③ 열람 기록에 **남의 사용자 이름**을 적을 수 있었습니다.
--   actor_org_id 만 봤고 actor_user_id 는 안 봤습니다. 개인정보를 누가
--   봤는지 남기는 표인데, 그 '누가' 를 위조할 수 있으면 기록이 아닙니다.
-- =========================================================

-- ---------------------------------------------------------
-- ① 알림 — 같은 주문에 매인 사이끼리만
-- ---------------------------------------------------------
--
-- ★ payload 의 orderId 로 묶습니다.
--   알림을 만드는 네 곳(events/index.ts)이 모두 그 값을 넣습니다.
--   보내는 사람도 받는 조직도 **그 주문의 자리**여야 합니다.
--
-- ★ 내 조직 앞으로는 언제든 만들 수 있습니다.
--   주문과 무관한 알림(가입 승인·청구서 발행 같은)이 나중에 생겨도
--   자기 조직에 남기는 것은 위험하지 않습니다.

create or replace function can_notify(target_org uuid, body jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  raw text := body->>'orderId';
  oid uuid;
begin
  -- 내 조직 앞으로는 언제든
  if target_org = my_org_id() then
    return true;
  end if;

  -- 주문 id 가 없거나 모양이 아니면 남의 조직 앞으로는 못 만듭니다
  if raw is null or raw !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return false;
  end if;

  oid := raw::uuid;

  return exists (
    select 1 from orders o
    where o.id = oid
      -- 보내는 사람이 그 주문의 자리여야 하고
      and (o.clinic_org_id = my_org_id()
           or o.design_org_id = my_org_id()
           or o.lab_org_id = my_org_id())
      -- 받는 조직도 그 주문의 자리여야 합니다
      and target_org in (o.clinic_org_id, o.design_org_id, o.lab_org_id)
  );
end;
$$;

comment on function can_notify(uuid, jsonb) is
  '남의 종에 알림을 꽂을 수 있는가. 같은 주문에 매인 사이끼리만';

drop policy if exists notification_insert on notifications;

create policy notification_insert on notifications
  for insert with check (auth.uid() is not null and can_notify(org_id, payload));

-- ---------------------------------------------------------
-- ② 도메인 이벤트 — 내 이름으로, 내가 닿는 주문에만
-- ---------------------------------------------------------

drop policy if exists domain_event_insert on domain_events;

create policy domain_event_insert on domain_events
  for insert with check (
    actor_org_id = my_org_id()
    and aggregate_type = 'order'
    and can_access_order(aggregate_id)
  );

-- ---------------------------------------------------------
-- ③ 열람 기록 — 나로만 남깁니다
-- ---------------------------------------------------------
--
-- ★ record_access 는 security definer 가 아니라 부르는 사람 권한으로
--   돕니다. 세션의 사용자 id 를 그대로 넣으므로 이 조건에 걸리지 않습니다.

drop policy if exists audit_log_insert on audit_logs;

create policy audit_log_insert on audit_logs
  for insert with check (
    actor_org_id = my_org_id()
    and actor_user_id = auth.uid()
  );
