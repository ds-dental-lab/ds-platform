-- =========================================================
-- exocad 로 보낸 기록. (2026-09-09, 설계서 exocad-연동-설계서.md v2)
--
-- ★ 큐가 아닙니다. 런처는 버튼이 준 토큰으로 바로 API 를 부르고, 이 표는
--   "언제 누가 보냈고, 런처가 받아 갔고, 어떻게 끝났나" 만 남깁니다.
--   결과가 안 적히면 런처가 안 뜬 것 — 사람이 알아챌 단서입니다.
-- ★ 센터만 읽고 씁니다 (요청 줄). 런처는 service_role 로 받아감·결과만 적습니다.
-- =========================================================

create table exocad_exports (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  requested_by  uuid not null references user_profiles(id),
  requested_at  timestamptz not null default now(),
  fetched_at    timestamptz,                       -- 런처가 정보를 받아 간 시각
  status        text check (status in ('done', 'failed')),
  message       text,
  finished_at   timestamptz
);

create index exocad_exports_order_idx on exocad_exports (order_id, requested_at desc);

comment on table exocad_exports is 'exocad 로 보내기 버튼 기록. 런처(PC)가 결과를 적습니다';

alter table exocad_exports enable row level security;

create policy exocad_exports_select on exocad_exports
  for select using (my_org_type() = 'design_center');

create policy exocad_exports_insert on exocad_exports
  for insert with check (my_org_type() = 'design_center' and requested_by = auth.uid());
