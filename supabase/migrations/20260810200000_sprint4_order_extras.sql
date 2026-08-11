-- =========================================================
-- DS Flow — 주문 부가 정보 (메모 · 제작옵션 · 이슈 · 리메이크 계보)
-- 구현계획서 Sprint 4 (+ Sprint 3 잔여)
-- 파일 위치: supabase/migrations/<타임스탬프>_sprint4_order_extras.sql
-- 기준: 기능명세서 §4.2.8 §4.3 §4.4 §4.10, 설계서 §4.4 §4.5
--
-- 무엇을 채우는가.
--   주문목록의 '이슈' · '리메이크 횟수' 열과 주문상세의 '제작옵션' · '메모'가
--   기댈 표가 없었습니다. Sprint 3~5 에 흩어져 정의된 것들을 여기서 만듭니다.
-- =========================================================

-- ---------- 제작옵션 마스터 (명세서 §4.2.8) ----------
create table production_option_groups (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,        -- hook / pontic_type
  name       text not null,               -- 훅 / 폰틱타입
  sort_order smallint not null default 0
);

create table production_option_values (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references production_option_groups(id) on delete cascade,
  value      text not null,
  is_default boolean not null default false,
  sort_order smallint not null default 0
);

create unique index production_option_values_idx
  on production_option_values (group_id, value);

insert into production_option_groups (code, name, sort_order) values
  ('hook',        '훅',       1),
  ('pontic_type', '폰틱타입', 2);

insert into production_option_values (group_id, value, is_default, sort_order)
select g.id, v.value, v.is_default, v.sort_order
from production_option_groups g
join (values
  ('hook',        '미사용',              true,  1),
  ('hook',        '사용',                false, 2),
  ('pontic_type', 'ridge lap',           true,  1),
  ('pontic_type', 'modified ridge lap',  false, 2),
  ('pontic_type', 'sanitary',            false, 3),
  ('pontic_type', 'ovate',               false, 4),
  ('pontic_type', 'conical',             false, 5)
) as v(group_code, value, is_default, sort_order) on v.group_code = g.code;

-- ---------- 주문별 제작옵션 ----------
create table order_options (
  order_id        uuid not null references orders(id) on delete cascade,
  option_group_id uuid not null references production_option_groups(id),
  option_value_id uuid not null references production_option_values(id),
  primary key (order_id, option_group_id)
);

comment on table order_options is '주문 한 건의 제작옵션. 그룹당 한 값만 (명세서 §4.2.8)';

-- ---------- 메모 (명세서 §4.4 — 200자, 작성자·시각 기록) ----------
create table order_memos (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id) on delete cascade,
  author_org_id  uuid references organizations(id),
  author_user_id uuid references user_profiles(id),
  body           text not null check (char_length(body) <= 200),
  created_at     timestamptz not null default now()
);

comment on column order_memos.body is '200자 제한. 화면과 DB 양쪽에서 막습니다';

create index order_memos_order_idx on order_memos (order_id, created_at desc);

-- ---------- 이슈 (명세서 §4.3 이슈 필터) ----------
-- 상태는 '지금 어디에 있는가', 이슈는 '무슨 일이 있었는가'입니다 (설계서 C-2).
-- 재스캔은 상태이면서 동시에 이슈로 남습니다.
create type order_issue_type as enum (
  'rescan',    -- 재스캔
  'remake',    -- 리메이크
  'repair',    -- 리페어
  'analog'     -- 아날로그
);

create table order_issues (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references orders(id) on delete cascade,
  issue_type        order_issue_type not null,
  opened_by_org_id  uuid references organizations(id),
  opened_at         timestamptz not null default now(),
  resolved_at       timestamptz,
  reason            text
);

create index order_issues_order_idx on order_issues (order_id, opened_at desc);
create index order_issues_type_idx  on order_issues (issue_type, resolved_at);

-- ---------- 리메이크 계보 (설계서 §4.5.2, Sprint 3 잔여) ----------
-- parent_order_id 는 리페어에서 이미 추가했습니다.
alter table orders add column is_remake     boolean  not null default false;
alter table orders add column root_order_id uuid references orders(id);
alter table orders add column remake_seq    smallint not null default 0;
alter table orders add column remake_count  smallint not null default 0;

comment on column orders.root_order_id is '한 케이스의 첫 주문. 사슬을 거슬러 오르지 않고 한 번에 조회합니다';
comment on column orders.remake_seq    is '몇 차 리메이크인가. 원주문은 0';
comment on column orders.remake_count  is '이 주문이 몇 번 다시 만들어졌는가. 목록의 리메이크 횟수 열';

create index orders_root_idx on orders (root_order_id, remake_seq);

-- 기존 주문은 자기 자신이 뿌리입니다
update orders set root_order_id = id where root_order_id is null;

-- ---------- 접근 정책 ----------
alter table production_option_groups enable row level security;
alter table production_option_values enable row level security;
alter table order_options            enable row level security;
alter table order_memos              enable row level security;
alter table order_issues             enable row level security;

-- 마스터는 전 섹터 조회. 주문을 넣으려면 목록이 필요합니다.
create policy production_option_group_select on production_option_groups
  for select using (true);
create policy production_option_value_select on production_option_values
  for select using (true);

-- 주문에 딸린 것들은 그 주문을 볼 수 있으면 함께 보입니다.
create policy order_option_all on order_options
  for all using (exists (select 1 from orders o where o.id = order_options.order_id));

create policy order_memo_select on order_memos
  for select using (exists (select 1 from orders o where o.id = order_memos.order_id));

-- 메모는 관련 조직이면 남길 수 있습니다. 고치거나 지우지는 못합니다.
create policy order_memo_insert on order_memos
  for insert with check (
    author_org_id = my_org_id()
    and exists (select 1 from orders o where o.id = order_memos.order_id)
  );

create policy order_issue_select on order_issues
  for select using (exists (select 1 from orders o where o.id = order_issues.order_id));

create policy order_issue_write on order_issues
  for all using (exists (select 1 from orders o where o.id = order_issues.order_id));
