-- =========================================================
-- DS Flow — 휴일 관리
-- 파일 위치: supabase/migrations/<타임스탬프>_create_holidays.sql
--
-- 사용자 요청 2026-08-12 —
--   "매해마다 빨간날은 자동기입해주고"
--   "임시공휴일 같은 휴일을 추가 입력할수 있는 칸이 있으면 좋겠어"
--
-- ★ 표가 하나입니다. 디자인센터가 쥡니다.
--   쉬는 날은 '만드는 곳이 쉬는 날' 입니다. 치과마다 다른 날을 쉬어도
--   물건은 안 나갑니다. 치과·기공소는 읽기만 합니다.
--
-- ★ 하루에 한 줄입니다 (unique).
--   같은 날에 '추석' 과 '개천절' 두 줄이 있으면 화면이 둘 다 그리고,
--   지울 때 하나만 지워져 반쯤 쉬는 날이 됩니다.
--   겹치는 날은 이름을 이어 붙입니다 — '개천절 · 추석'.
--
-- ★ 자동으로 채운 줄도 지울 수 있습니다 (source 로 갈라만 둡니다).
--   대체공휴일 규칙은 법이 바뀌고, 음력 표는 틀릴 수 있습니다.
--   자동이 손보다 세면 고칠 방법이 없어집니다.
-- =========================================================

create type holiday_source as enum ('auto', 'manual');

create table holidays (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,

  date       date not null,
  name       text not null,
  -- 'auto' 는 자동 채우기가 넣은 줄. 화면이 딱지를 답니다
  source     holiday_source not null default 'manual',

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (org_id, date)
);

comment on table holidays is '쉬는 날. 요청시한 계산에서 빠집니다';
comment on column holidays.source is 'auto = 자동 채우기가 넣음. 그래도 고치고 지울 수 있습니다';

create index holidays_date_idx on holidays (date);

create trigger holidays_touch
  before update on holidays
  for each row execute function touch_updated_at();

alter table holidays enable row level security;

-- ---------- 누가 보는가 ----------
--
-- ★ 모두 봅니다. 요청시한 달력이 이 표로 그려집니다 —
--   치과가 못 읽으면 쉬는 날인 줄 모르고 골라 버립니다.

create policy holiday_select on holidays
  for select using (
    org_id = my_org_id() or is_partner_org(org_id)
  );

-- ---------- 누가 고치는가 ----------
--
-- ★ 디자인센터만입니다 (설계서 §5.3 결정 2 — 화면과 DB 양쪽에서).

create policy holiday_insert on holidays
  for insert with check (
    my_org_type() = 'design_center' and org_id = my_org_id()
  );

create policy holiday_update on holidays
  for update
  using (my_org_type() = 'design_center' and org_id = my_org_id())
  with check (org_id = my_org_id());

-- ★ 여기서는 진짜로 지웁니다.
--   공지와 다릅니다 — 공지는 "그런 안내 받은 적 없다" 의 근거로 남겨야
--   하지만, 잘못 넣은 휴일은 남아 있으면 요청시한을 계속 틀리게 만듭니다.
create policy holiday_delete on holidays
  for delete using (
    my_org_type() = 'design_center' and org_id = my_org_id()
  );
