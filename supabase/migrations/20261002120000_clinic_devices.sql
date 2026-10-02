-- =========================================================
-- 치과 스캐너 PC 연결 + 들어온 스캔 (사용자 요청 2026-10-02)
--
-- 치과 PC 의 작은 프로그램이 구강스캐너 내보내기 폴더를 보고 있다가, 새 dxd 가
-- 생기면 덴플로우로 올립니다. 올린 것은 주문에 붙기 전까지 '들어온 스캔' 으로 둡니다.
--
-- ★ **비밀번호를 PC 에 저장하지 않습니다.** 치과 관리자가 여섯 자리 코드를 발급하고,
--   프로그램이 그 코드를 한 번 내밀어 **기기 열쇠**를 받아 둡니다. 열쇠는 그 치과의
--   '스캔 올리기' 에만 쓰입니다 — 주문을 보거나 고칠 수는 없습니다.
-- ★ 열쇠는 **해시로만** 저장합니다. 표가 새어도 그대로 쓸 수 없습니다.
-- ★ 생년월일은 받지 않습니다 (사용자 결정 2026-10-02). 환자 이름·차트번호까지입니다.
-- ★ 스캐너에 적힌 치과 이름(clinic_name_in_file)은 **안내용**입니다 — 막는 조건이
--   아닙니다. '2510' 처럼 숫자만 적어 둔 곳이 있습니다.
-- =========================================================

-- ---------- 연결된 PC ----------

create table if not exists clinic_devices (
  id              uuid primary key default gen_random_uuid(),
  clinic_org_id   uuid not null references organizations(id) on delete cascade,
  name            text not null,
  token_hash      text not null unique,
  created_by      uuid references user_profiles(id),
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz,
  revoked_at      timestamptz
);

comment on table clinic_devices is
  '치과의 스캐너 PC. 열쇠는 해시로만 둡니다 (2026-10-02)';

create index if not exists clinic_devices_org_idx on clinic_devices (clinic_org_id)
  where revoked_at is null;

-- ---------- 연결용 여섯 자리 코드 ----------

create table if not exists device_link_codes (
  code          text primary key,
  clinic_org_id uuid not null references organizations(id) on delete cascade,
  created_by    uuid references user_profiles(id),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  used_at       timestamptz,
  device_id     uuid references clinic_devices(id) on delete set null
);

comment on table device_link_codes is
  '스캐너 PC 를 묶는 일회용 코드. 10분 뒤 만료, 한 번 쓰면 끝 (2026-10-02)';

-- ---------- 들어온 스캔 ----------

create table if not exists incoming_scans (
  id                   uuid primary key default gen_random_uuid(),
  clinic_org_id        uuid not null references organizations(id) on delete cascade,
  device_id            uuid references clinic_devices(id) on delete set null,

  -- dxd 안의 DentalCase.xml 에서 읽은 것 (생년월일은 안 받습니다)
  patient_name         text not null default '',
  chart_no             text not null default '',
  clinic_name_in_file  text not null default '',
  case_guid            text not null default '',
  scanned_at           text not null default '',
  teeth                smallint[] not null default '{}',

  file_name            text not null,
  file_size            bigint,
  storage_path         text not null,
  upload_status        text not null default 'pending',   -- pending · uploaded · failed

  -- 주문에 붙으면 그 주문
  order_id             uuid references orders(id) on delete set null,
  attached_at          timestamptz,

  created_at           timestamptz not null default now(),
  deleted_at           timestamptz
);

comment on table incoming_scans is
  '치과 PC 가 올린 스캔. 주문에 붙기 전까지 여기 있습니다 (2026-10-02)';

comment on column incoming_scans.case_guid is
  '스캐너가 매긴 케이스 번호. 같은 케이스를 다시 내보내도 두 번 안 올리게 막는 열쇠';

create index if not exists incoming_scans_clinic_idx
  on incoming_scans (clinic_org_id, created_at desc)
  where deleted_at is null and order_id is null;

-- 같은 케이스를 두 번 올리지 않습니다 (케이스 번호가 있는 것만)
create unique index if not exists incoming_scans_case_unique
  on incoming_scans (clinic_org_id, case_guid)
  where case_guid <> '' and deleted_at is null;

-- ---------- 문지기 ----------
--
-- ★ 치과는 **자기 것만** 봅니다. 디자인센터는 주문에 붙은 뒤에 보면 되므로
--   여기서는 안 엽니다 — 아직 주문이 아닌 환자 이름 목록입니다.
-- ★ 넣고 고치는 것은 **서비스 열쇠(API)** 뿐입니다. 기기 열쇠를 검사한 뒤
--   서버가 대신 씁니다. 그래서 insert·update 정책을 안 만듭니다.

alter table clinic_devices   enable row level security;
alter table device_link_codes enable row level security;
alter table incoming_scans   enable row level security;

drop policy if exists clinic_devices_select on clinic_devices;
create policy clinic_devices_select on clinic_devices
  for select using (clinic_org_id = my_org_id());

drop policy if exists incoming_scans_select on incoming_scans;
create policy incoming_scans_select on incoming_scans
  for select using (clinic_org_id = my_org_id());

-- 치과가 자기 스캔을 지울 수는 있습니다 (잘못 올라온 것)
drop policy if exists incoming_scans_delete on incoming_scans;
create policy incoming_scans_delete on incoming_scans
  for delete using (clinic_org_id = my_org_id());
