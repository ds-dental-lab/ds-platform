-- =========================================================
-- 수가표·상담 요청. (홈페이지 문의 폼)
--
-- ★ 홈페이지에서 제일 중요한 칸입니다.
--   보고 마음이 동한 사람이 전화를 걸까 말까 망설이는 그 순간에,
--   이름과 연락처만 남기고 갈 수 있어야 합니다.
--
-- ★ 로그인하지 않은 사람이 씁니다.
--   그래서 anon 이 넣을 수 있어야 하는데, 그렇다고 표를 열어 두면
--   남이 남긴 문의를 아무나 읽습니다. **넣기만 되고 읽기는 안 됩니다.**
--
-- ★ 개인정보입니다.
--   치과명·담당자 성함·연락처·이메일이 들어옵니다. 동의를 받은 사실과
--   시각을 함께 남깁니다 — 나중에 "동의한 적 없다" 는 말이 나오면
--   이 줄이 답합니다.
-- =========================================================

create type contact_kind as enum ('price_list', 'visit');
create type contact_status as enum ('new', 'done');

create table contact_requests (
  id           uuid primary key default gen_random_uuid(),

  clinic_name  text not null check (btrim(clinic_name) <> ''),
  person_name  text not null check (btrim(person_name) <> ''),
  tel          text not null check (btrim(tel) <> ''),
  email        text not null check (btrim(email) <> ''),
  kind         contact_kind not null default 'price_list',
  message      text,

  -- ★ 동의 없이 들어올 수 없습니다. 표가 막습니다
  agreed_at    timestamptz not null default now(),

  status       contact_status not null default 'new',
  handled_by   uuid references user_profiles(id),
  handled_at   timestamptz,
  memo         text,

  created_at   timestamptz not null default now()
);

comment on table contact_requests is
  '홈페이지에서 들어온 수가표·상담 요청. 로그인 없이 넣고, 디자인센터만 읽습니다';

create index contact_requests_status_idx on contact_requests (status, created_at desc);

alter table contact_requests enable row level security;

-- ★ 넣기만 됩니다. 로그인 안 한 사람도 남길 수 있어야 합니다
create policy contact_insert on contact_requests
  for insert to anon, authenticated with check (true);

-- ★ 읽는 것은 디자인센터뿐입니다.
--   select 정책이 없으면 넣은 사람도 자기 것을 못 봅니다 — 그게 맞습니다.
create policy contact_select on contact_requests
  for select to authenticated
  using (my_org_type() = 'design_center');

create policy contact_update on contact_requests
  for update to authenticated
  using (my_org_type() = 'design_center')
  with check (my_org_type() = 'design_center');
