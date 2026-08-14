-- =========================================================
-- 리메이크 사유 (사용자 요청 2026-08-14 — "재발방지하고 싶거든")
--
-- ★ 한 주문에 **줄 여럿**입니다. 사유를 중복으로 고를 수 있어서입니다.
--   한 칸에 쉼표로 이어 붙이면 세는 순간 문자열을 쪼개야 하고,
--   'CS-1' 과 'CS-01' 같은 것이 조용히 섞입니다.
--
-- ★ 목록(무슨 코드가 있는가)은 **표에 안 둡니다.** 코드에 있습니다
--   (domain/remake-reason). 이건 통계의 잣대라, 항목이 조용히 바뀌면
--   지난달과 이번달이 다른 것을 세게 됩니다. 여기에는 고른 결과만 남습니다.
--
-- ★ 그래서 code 에 외래키가 없습니다. 대신 화면과 서버 양쪽에서
--   목록에 있는 값인지 걸러 넣습니다.
-- =========================================================

create table if not exists remake_reasons (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,

  -- 'CS-01' 같은 값. 화면 글이 바뀌어도 이 값은 안 바뀝니다
  code        text not null,

  -- 기타(ET-01)를 골랐을 때만 채웁니다
  note        text,

  created_by  uuid not null default auth.uid() references auth.users(id),
  created_at  timestamptz not null default now(),

  -- ★ 같은 주문에 같은 사유가 두 번 들어가면 통계가 부풀어 오릅니다
  unique (order_id, code)
);

comment on table  remake_reasons        is '리메이크 사유. 한 주문에 여러 줄 (중복 선택)';
comment on column remake_reasons.code   is '고른 사유 코드. 목록은 domain/remake-reason 에 있습니다';
comment on column remake_reasons.note   is '기타(ET-01) 를 골랐을 때의 자유 입력';

create index if not exists remake_reason_order_idx on remake_reasons (order_id);

-- 통계가 기간으로 훑습니다
create index if not exists remake_reason_code_idx  on remake_reasons (code, created_at desc);

-- ---------- 접근 정책 ----------
--
-- ★ **디자인센터만** 만집니다 (사용자 결정 2026-08-14 —
--   "디자인센터와 디자이너 모두 리메이크 사유를 입력할수 있고").
--   치과와 기공소에는 보이지도 않습니다. 이 표는 '누구 탓인가' 로
--   읽힐 수 있는 자료라, 거래 상대에게 그대로 보이면 안 됩니다.
--
-- ★ 관리자·사용자를 안 가릅니다. 둘 다 넣을 수 있습니다.
--   **통계를 보는 것만** 관리자입니다 — 그건 화면에서 막습니다
--   (requireManagerSector). 넣는 것까지 막으면 정작 그 일을 하는
--   디자이너가 못 넣습니다.
--
-- ★ 조건을 orders 에 기대어 씁니다. 그 표의 정책이 이미
--   '누가 이 주문을 볼 수 있는가' 를 정해 두었습니다.

alter table remake_reasons enable row level security;

create policy remake_reason_select on remake_reasons
  for select using (
    my_org_type() = 'design_center'
    and exists (
      select 1 from orders o
      where o.id = remake_reasons.order_id
        and o.design_org_id = my_org_id()
    )
  );

create policy remake_reason_insert on remake_reasons
  for insert with check (
    my_org_type() = 'design_center'
    and exists (
      select 1 from orders o
      where o.id = remake_reasons.order_id
        and o.design_org_id = my_org_id()
    )
  );

-- ★ 고치는 정책은 안 만듭니다.
--   저장은 '지우고 다시 넣기' 입니다 — 화면이 고른 것 전체를 한 번에
--   보내므로, 무엇이 빠졌는지 서버가 따로 셈할 필요가 없습니다.
create policy remake_reason_delete on remake_reasons
  for delete using (
    my_org_type() = 'design_center'
    and exists (
      select 1 from orders o
      where o.id = remake_reasons.order_id
        and o.design_org_id = my_org_id()
    )
  );
