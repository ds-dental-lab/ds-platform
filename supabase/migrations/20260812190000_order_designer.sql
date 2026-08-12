-- =========================================================
-- 담당 디자이너. (사용자 결정 2026-08-12 —
--   "두명의 디자이너가 한 주문을 하면 안되잖아")
--
-- ★ 전에는 담당자를 order_status_history 에서 캐냈습니다.
--   '디자인 단계로 옮긴 사람' 이 곧 디자이너였습니다. 읽기에는 됐지만
--   **막을 수는 없었습니다** — 두 사람이 같은 주문을 열고 나란히 눌러도
--   둘 다 통과했습니다. 이력은 지나간 일이라 앞을 막지 못합니다.
--
-- ★ 그래서 사실을 표에 둡니다. 트리거가 그 사실을 지킵니다.
--   서비스 코드에서만 막으면, RLS 로 열려 있는 update 를 타고
--   디자이너가 직접 designer_user_id 를 자기 것으로 덮어쓸 수 있습니다.
-- =========================================================

alter table orders
  add column designer_user_id uuid references auth.users(id) on delete set null;

comment on column orders.designer_user_id is
  '담당 디자이너. 디자인을 잡는 순간 정해지고, 그 뒤에는 관리자만 바꿉니다';

-- 작업 리스트가 "내 것만" 을 이 열로 셉니다
create index orders_designer_idx on orders (designer_user_id, status)
  where designer_user_id is not null;

-- ---------- 지난 주문 채우기 ----------
--
-- ★ 트리거를 잠시 끕니다.
--   orders_touch 가 updated_at 을 지금으로 밀어 버립니다. 마이그레이션
--   한 번에 모든 주문이 "방금 고쳐진" 것이 되면, 그 값을 보는 화면과
--   정렬이 통째로 흔들립니다. (완료일로 updated_at 을 쓰다 데인 적이
--   있습니다 — 20260812180000 참고)
alter table orders disable trigger orders_touch;

update orders o
set designer_user_id = h.actor_user_id
from (
  select distinct on (order_id) order_id, actor_user_id
  from order_status_history
  where to_status = 'designing' and actor_user_id is not null
  order by order_id, created_at desc
) h
where h.order_id = o.id
  and o.designer_user_id is null;

alter table orders enable trigger orders_touch;

-- ---------- 자리를 지키는 트리거 ----------

create or replace function orders_guard_designer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if new.designer_user_id is not distinct from old.designer_user_id then
    return new;
  end if;

  -- ★ 사람이 누른 것만 봅니다.
  --   서버 열쇠(service_role)와 마이그레이션은 auth.uid() 가 없습니다.
  --   그쪽은 이미 무엇이든 할 수 있어, 여기서 막아 봐야 뜻이 없습니다.
  if actor is null then
    return new;
  end if;

  -- 아무도 안 잡은 자리는 누구나 잡습니다 (먼저 잡은 사람이 임자)
  if old.designer_user_id is null then
    return new;
  end if;

  -- 내가 잡은 것을 내가 내려놓는 것
  if old.designer_user_id = actor and new.designer_user_id is null then
    return new;
  end if;

  if my_role() in ('owner', 'admin') then
    return new;
  end if;

  raise exception '이미 다른 디자이너가 맡은 주문입니다'
    using errcode = 'check_violation';
end;
$$;

create trigger orders_guard_designer
  before update of designer_user_id on orders
  for each row execute function orders_guard_designer();

-- ---------- 디자인 파일도 자리를 봅니다 ----------
--
-- ★ 상태만 막으면 충분하지 않습니다.
--   디자인 파일은 접수 상태에서도 올릴 수 있어서, 잡지 않은 사람이
--   남의 주문에 파일을 얹을 수 있었습니다. 파일이 곧 작업입니다.
--   업로드는 브라우저에서 곧장 들어오므로 여기서 막아야 진짜로 막힙니다.

drop policy if exists order_file_insert on order_files;

create policy order_file_insert on order_files
  for insert with check (
    exists (
      select 1 from orders o
      where o.id = order_files.order_id
        and (
          order_files.kind <> 'design'
          or my_org_type() <> 'design_center'
          or o.designer_user_id is null
          or o.designer_user_id = auth.uid()
          or my_role() in ('owner', 'admin')
        )
    )
  );
