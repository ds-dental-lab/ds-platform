-- =========================================================
-- DS Flow — 공지사항 (설계서 Sprint 9)
-- 파일 위치: supabase/migrations/<타임스탬프>_create_notices.sql
--
-- 사용자 결정 2026-08-12 — *"공지사항은 디자인센터가 글 쓸권한을 줘"*.
-- 쓰는 곳은 디자인센터 하나, 읽는 곳은 치과와 기공소입니다.
--
-- ★ 받는 쪽을 고를 수 있어야 합니다 (audience).
--   "이번 주 배송 일정" 은 치과에게, "재료 입고 지연" 은 기공소에게
--   가는 말입니다. 하나로 묶어 모두에게 보내면 아무도 안 읽습니다.
--
-- ★ 임시저장을 둡니다 (published_at is null).
--   공지는 여러 번 고쳐 씁니다. 쓰다 만 글이 그대로 치과 화면에
--   떠 있으면 그것이 곧 사고입니다. 게시를 눌러야 나갑니다.
--
-- ★ 글쓴이 조직은 자기 글을 다 봅니다 (임시저장·지운 것 포함).
--   읽는 쪽은 '게시됐고 · 안 지워졌고 · 나에게 온' 것만 봅니다.
--   deleted_at 을 읽는 쪽 갈래에만 넣은 이유입니다 —
--   목록에서 지운 글을 거르는 것은 조회가 합니다 (주문과 같은 방식).
-- =========================================================

create type notice_audience as enum ('all', 'clinic', 'lab');

create table notices (
  id           uuid primary key default gen_random_uuid(),
  -- 쓴 조직. 지금은 디자인센터 하나뿐이지만 칸은 열어 둡니다
  org_id       uuid not null references organizations(id) on delete cascade,

  title        text not null,
  body         text not null,
  audience     notice_audience not null default 'all',

  -- 위로 고정. 급한 공지가 아래로 밀리면 안 봅니다
  is_pinned    boolean not null default false,

  -- null 이면 임시저장입니다. 값이 있으면 그때 나갔습니다
  published_at timestamptz,

  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

comment on column notices.published_at is 'null 이면 임시저장 — 읽는 쪽에 안 보입니다';
comment on column notices.audience is '누구에게 가는 말인가. all · clinic · lab';

-- 목록은 늘 '고정 먼저, 최근 먼저' 입니다
create index notices_feed_idx
  on notices (org_id, is_pinned desc, published_at desc nulls first);

create trigger notices_touch
  before update on notices
  for each row execute function touch_updated_at();

alter table notices enable row level security;

-- ---------- 누가 보는가 ----------

create policy notice_select on notices
  for select using (
    -- 쓴 조직은 임시저장까지 다 봅니다
    org_id = my_org_id()
    or (
      deleted_at is null
      and published_at is not null
      and is_partner_org(org_id)
      -- 'all' 이거나, 내 조직 종류로 온 것
      and (audience = 'all' or audience::text = my_org_type()::text)
    )
  );

-- ---------- 누가 쓰는가 ----------
--
-- ★ 디자인센터만입니다. 치과·기공소는 읽기만 합니다.
--   화면에서 버튼을 숨기는 것과 DB 가 못 받는 것은 다릅니다
--   (설계서 §5.3 결정 2).

create policy notice_insert on notices
  for insert with check (
    my_org_type() = 'design_center' and org_id = my_org_id()
  );

create policy notice_update on notices
  for update
  using (my_org_type() = 'design_center' and org_id = my_org_id())
  with check (org_id = my_org_id());

-- 지우기는 deleted_at 을 세우는 update 입니다. delete 정책은 안 만듭니다 —
-- 무엇을 언제 공지했는지는 남아 있어야 합니다
