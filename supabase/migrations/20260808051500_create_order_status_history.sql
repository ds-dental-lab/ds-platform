-- =========================================================
-- DS Flow — 상태 이력
-- Sprint 4
-- 파일 위치: supabase/migrations/<타임스탬프>_create_order_status_history.sql
-- 기준: 시스템설계서 §4.5 order_status_history
--
-- 주문의 status 는 "지금 어디에 있는가" 하나만 들고 있습니다.
-- 누가 언제 어디서 어디로 옮겼는지는 여기에 쌓입니다.
-- =========================================================

create table order_status_history (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,

  from_status   order_status,              -- 생성 시점에는 비어 있습니다
  to_status     order_status not null,

  actor_org_id  uuid references organizations(id),
  actor_user_id uuid references user_profiles(id),

  reason        text,                       -- 재스캔 요청 · 취소 사유
  created_at    timestamptz not null default now()
);

comment on table  order_status_history        is '상태가 바뀔 때마다 한 줄씩 쌓입니다. 지우지 않습니다';
comment on column order_status_history.reason is '재스캔·취소처럼 사유가 필요한 전이에서만 채워집니다';

create index order_status_history_order_idx
  on order_status_history (order_id, created_at desc);

-- ---------- 접근 정책 ----------
alter table order_status_history enable row level security;

-- 주문을 볼 수 있으면 그 이력도 보입니다.
create policy order_status_history_select on order_status_history
  for select using (
    exists (select 1 from orders o where o.id = order_status_history.order_id)
  );

-- 이력은 쌓기만 합니다. 수정·삭제 정책은 만들지 않습니다.
create policy order_status_history_insert on order_status_history
  for insert with check (
    exists (select 1 from orders o where o.id = order_status_history.order_id)
  );
