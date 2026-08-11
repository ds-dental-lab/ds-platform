-- =========================================================
-- DS Flow — 주문별 대화
-- 파일 위치: supabase/migrations/<타임스탬프>_create_order_messages.sql
-- 기준: 사용자가 준 주문상세 화면의 '대화' 패널
--
-- 한 주문을 두고 치과 · 디자인센터 · 기공소 셋이 주고받습니다.
-- 전화로 하던 "11번 컨택 좀 봐 주세요" 를 주문서에 붙여 둡니다.
--
-- ★ 기공소도 읽고 씁니다 (사용자 결정 2026-08-11).
--   그래서 여기 적힌 글은 §8.5 의 환자 실명 차단을 우회할 수 있습니다.
--   치과가 본문에 실명을 적으면 기공소가 그대로 봅니다.
--   화면에서 "기공소도 함께 봅니다" 를 늘 띄워 알려 줍니다.
--
-- ★ 고치고 지우는 것은 글쓴이 본인과 디자인센터입니다 (사용자 결정).
--   디자인센터가 가운데에서 조율하므로 잘못 적힌 글을 정리할 수 있어야 합니다.
-- =========================================================

create table order_messages (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id) on delete cascade,

  author_org_id  uuid not null references organizations(id),
  author_user_id uuid references user_profiles(id),
  -- 표시용 캐시. 조직 이름이 바뀌어도 지난 대화가 비지 않게 합니다
  author_name    text     not null,
  author_sector  org_type not null,

  body           text not null check (char_length(body) between 1 and 200),

  edited_at      timestamptz,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now()
);

comment on table  order_messages              is '주문별 대화. 치과·디자인센터·기공소 셋이 함께 봅니다';
comment on column order_messages.author_name  is '표시용 캐시. 조직 이름이 바뀌어도 지난 대화가 비지 않습니다';
comment on column order_messages.body         is '★ 기공소도 읽습니다. 환자 실명을 적으면 §8.5 가 뚫립니다';

create index order_messages_order_idx on order_messages (order_id, created_at);

-- ---------- 접근 정책 (설계서 §8.4) ----------
--
-- ★ 주문이 보이면 대화도 보입니다.
--   누가 그 주문을 볼 수 있는지는 orders 의 정책이 이미 정해 두었습니다.
--   여기서 조건을 다시 적으면 두 곳이 어긋날 때 구멍이 납니다.
alter table order_messages enable row level security;

create policy order_message_select on order_messages
  for select using (
    deleted_at is null
    and exists (select 1 from orders o where o.id = order_messages.order_id)
  );

-- 쓰는 것은 자기 조직 이름으로만
create policy order_message_insert on order_messages
  for insert with check (
    author_org_id = my_org_id()
    and exists (select 1 from orders o where o.id = order_messages.order_id)
  );

-- 고치기 — 글쓴이 본인, 또는 그 주문의 디자인센터
create policy order_message_update on order_messages
  for update using (
    exists (
      select 1 from orders o
      where o.id = order_messages.order_id
        and (
          order_messages.author_org_id = my_org_id()
          or (my_org_type() = 'design_center' and o.design_org_id = my_org_id())
        )
    )
  );

-- 지우기도 같은 조건입니다 (deleted_at 을 채우는 update 로 처리)
create policy order_message_delete on order_messages
  for delete using (
    exists (
      select 1 from orders o
      where o.id = order_messages.order_id
        and (
          order_messages.author_org_id = my_org_id()
          or (my_org_type() = 'design_center' and o.design_org_id = my_org_id())
        )
    )
  );
