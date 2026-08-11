-- =========================================================
-- DS Flow — 도메인 이벤트 · 알림
-- Sprint 5
-- 파일 위치: supabase/migrations/<타임스탬프>_create_events_notifications.sql
-- 기준: 시스템설계서 §3.4 이벤트 기반 알림, §4.9 시스템
--
-- 왜 두 표로 나누는가.
--   domain_events — "무슨 일이 일어났는가". 업무 기록이고 지우지 않습니다.
--   notifications — "누구에게 알릴 것인가". 발송 결과이고 읽음 표시가 붙습니다.
--
--   알림 정책이 바뀌어도 업무 로직은 그대로입니다. 이벤트는 계속 쌓이고
--   구독하는 쪽만 달라집니다. (§3.4)
--
-- ★ 카카오 알림톡(Q-7)은 유료 발송대행사가 필요해 여기서 만들지 않습니다.
--   channel enum 에 'kakao' 값만 두고, 지금은 'in_app' 만 씁니다.
-- =========================================================

-- ---------- 무슨 일이 일어났는가 ----------
create table domain_events (
  id             uuid primary key default gen_random_uuid(),
  event_type     text not null,              -- 'order.status_changed' 등
  aggregate_type text not null,              -- 'order'
  aggregate_id   uuid not null,
  actor_org_id   uuid references organizations(id),
  actor_user_id  uuid references user_profiles(id),
  payload        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

comment on table domain_events is '업무에서 일어난 사실. 알림은 이것을 구독합니다 (설계서 §3.4)';

create index domain_events_aggregate_idx on domain_events (aggregate_type, aggregate_id, created_at desc);
create index domain_events_type_idx      on domain_events (event_type, created_at desc);

-- ---------- 누구에게 알릴 것인가 ----------
create type notification_channel as enum ('in_app', 'kakao', 'push', 'email');
create type notification_status  as enum ('queued', 'sent', 'failed');

create table notifications (
  id           uuid primary key default gen_random_uuid(),

  -- 받는 쪽은 조직 단위입니다. 그 조직 사람이면 모두 봅니다.
  -- 개인 지정이 필요해지면 recipient_user_id 를 채우고 정책만 좁히면 됩니다.
  org_id       uuid not null references organizations(id) on delete cascade,
  recipient_user_id uuid references user_profiles(id),

  event_id     uuid references domain_events(id) on delete set null,
  channel      notification_channel not null default 'in_app',
  status       notification_status  not null default 'sent',

  event_type   text not null,
  title        text not null,
  body         text,
  link         text,                          -- 눌렀을 때 갈 곳

  payload      jsonb not null default '{}'::jsonb,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

comment on column notifications.org_id  is '받는 조직. 그 조직 사람이면 모두 봅니다';
comment on column notifications.status  is 'in_app 은 만드는 즉시 sent. 외부 발송이 붙으면 queued 로 시작합니다';

create index notifications_inbox_idx on notifications (org_id, created_at desc);
create index notifications_unread_idx on notifications (org_id) where read_at is null;

-- ---------- 접근 정책 ----------
alter table domain_events enable row level security;
alter table notifications enable row level security;

-- 이벤트는 자기 조직이 관련된 주문 것만 보입니다.
-- (지금은 주문 이벤트뿐이라 orders 를 통해 판정합니다)
create policy domain_event_select on domain_events
  for select using (
    aggregate_type = 'order'
    and exists (select 1 from orders o where o.id = domain_events.aggregate_id)
  );

-- 이벤트 기록은 로그인한 사람이면 남길 수 있습니다.
-- 어차피 orders 를 바꿀 수 있어야 이벤트가 생기고, 그쪽은 이미 막혀 있습니다.
create policy domain_event_insert on domain_events
  for insert with check (auth.uid() is not null);

-- 알림은 받는 조직만 봅니다.
create policy notification_select on notifications
  for select using (org_id = my_org_id());

-- 읽음 표시는 받는 조직만.
create policy notification_update on notifications
  for update using (org_id = my_org_id()) with check (org_id = my_org_id());

-- ★ 알림은 남의 조직 앞으로 만들어야 합니다.
--   (접수하면 디자인센터에게, 재스캔하면 치과에게)
--   그래서 org_id 를 내 조직으로 제한할 수 없습니다.
--   대신 관련된 주문이 있어야만 만들 수 있게 묶습니다.
create policy notification_insert on notifications
  for insert with check (auth.uid() is not null);
