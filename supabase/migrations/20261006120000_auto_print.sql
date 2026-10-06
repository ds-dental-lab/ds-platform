-- =========================================================
-- 자동 템포러리 — 치과 프린터로 원격출력 (사용자 요청 2026-10-06)
--
-- 한 주문이 디자인 → 슬라이스 → 치과 전송 → 출력까지 가는 길을 한 줄로 둡니다.
-- 고리가 다섯이라(기공소 사람 → 기공소 PC → 서버 → 치과 PC → 프린터)
-- 끊긴 자리를 말할 수 있어야 고칠 수 있습니다.
--
-- ★ **프린터의 액세스 코드는 이 표에 없습니다.**
--   치과 PC 의 설정 파일에만 둡니다. 남의 하드웨어 열쇠를 우리가 들고 있을
--   이유가 없고, 표가 새면 그 치과 프린터가 그대로 열립니다.
--   여기 두는 것은 기종·필라멘트뿐이고, 슬라이스 프로파일 고르는 데만 씁니다.
--
-- ★ **포트포워딩을 쓰지 않습니다.**
--   치과 쪽으로 들어오는 연결이 없습니다. 치과 PC 가 밖으로 물어보고(HTTPS)
--   작업을 받아 가는 길 하나입니다. 그래서 이 표에 치과 IP 칸이 없습니다.
--
-- ★ 기종은 2026-10-06 현재 미정입니다. 그래서 model 은 비어 있어도 됩니다.
-- =========================================================

-- ---------- 치과에 있는 프린터 ----------

create table if not exists clinic_printers (
  id                 uuid primary key default gen_random_uuid(),
  clinic_org_id      uuid not null references organizations(id) on delete cascade,
  name               text not null,

  -- 기종·필라멘트는 **슬라이스 프로파일을 고르는 데만** 씁니다.
  -- 아직 안 정했으면 비워 둡니다.
  model              text not null default '',
  filament           text not null default '',

  -- 출력 시작 전에 치과가 '베드 비움' 을 눌러야 하는가.
  -- ★ 기본값은 켜 둡니다. 치과에는 기공사가 없습니다 — 전 출력물 위에
  --   덮어 뽑는 일을 막는 유일한 잠금입니다.
  require_bed_check  boolean not null default true,

  -- 어느 PC 가 이 프린터에 붙여 주는가 (스캐너 PC 와 같은 PC 일 수 있습니다)
  device_id          uuid references clinic_devices(id) on delete set null,

  created_at         timestamptz not null default now(),
  last_seen_at       timestamptz,
  revoked_at         timestamptz
);

comment on table clinic_printers is
  '치과에 있는 프린터. 액세스 코드는 여기 두지 않습니다 — 치과 PC 에만 (2026-10-06)';

comment on column clinic_printers.model is
  '슬라이스 프로파일을 고르는 데만 씁니다. 기종 미정이면 빈 문자열';

comment on column clinic_printers.require_bed_check is
  '출력 시작 전 치과가 출력판을 비웠다고 눌러야 하는가. 기본 켬';

create index if not exists clinic_printers_org_idx
  on clinic_printers (clinic_org_id)
  where revoked_at is null;

-- ---------- 한 주문의 자동 진행 ----------

create table if not exists auto_jobs (
  id                 uuid primary key default gen_random_uuid(),

  -- ★ 한 주문에 한 줄입니다. 두 줄이 생기면 같은 것을 두 번 뽑습니다.
  order_id           uuid not null unique references orders(id) on delete cascade,
  clinic_org_id      uuid not null references organizations(id) on delete cascade,
  printer_id         uuid references clinic_printers(id) on delete set null,

  -- src/server/domain/auto-print 의 AutoStep 과 같은 말이어야 합니다
  step               text not null default 'waiting_design'
                       check (step in ('waiting_design', 'slicing', 'queued',
                                       'sending', 'printing', 'done', 'failed')),

  -- 치과가 출력판을 비웠다고 누른 때.
  -- ★ 단계를 늘리지 않고 도장 하나로 풉니다. queued 에 머문 채 도장이
  --   없으면 "치과 확인 대기", 찍히면 치과 PC 가 집어갈 수 있는 것.
  bed_cleared_at     timestamptz,
  bed_cleared_by     uuid references user_profiles(id) on delete set null,

  percent            smallint check (percent is null or (percent between 0 and 100)),
  tries              smallint not null default 0,

  failed_at          text check (failed_at is null or
                                 failed_at in ('waiting_design', 'slicing', 'queued',
                                               'sending', 'printing')),
  failed_reason      text,

  -- 만들어진 것들
  design_file_id     uuid references order_files(id) on delete set null,
  print_file_path    text not null default '',

  -- ★ **실제로 쓴 각도를 적어 둡니다.**
  --   목표가 "동일한 각도로 슬라이스" 입니다. 적어 두지 않으면 어느 날
  --   달라져도 알 수가 없습니다. 나중에 두 건을 견줄 수 있어야 합니다.
  rotate_x           numeric,
  rotate_y           numeric,
  rotate_z           numeric,

  claimed_at         timestamptz,
  claimed_device_id  uuid references clinic_devices(id) on delete set null,
  started_at         timestamptz,
  finished_at        timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table auto_jobs is
  '자동 템포러리 한 건이 디자인·슬라이스·출력까지 가는 길 (2026-10-06)';

comment on column auto_jobs.bed_cleared_at is
  '치과가 출력판을 비웠다고 누른 때. 이게 없으면 치과 PC 가 집어가지 않습니다';

comment on column auto_jobs.rotate_x is
  '실제로 슬라이스에 쓴 각도. "동일한 각도" 를 나중에 확인할 수 있게 남깁니다';

-- 치과 PC 가 집어갈 것을 찾는 길
create index if not exists auto_jobs_claimable_idx
  on auto_jobs (clinic_org_id)
  where step = 'queued' and bed_cleared_at is not null;

-- 기공소 쪽이 할 일을 찾는 길
create index if not exists auto_jobs_pending_idx
  on auto_jobs (step, created_at)
  where step in ('waiting_design', 'slicing');

-- ---------- 문지기 ----------
--
-- ★ 넣고 고치는 것은 **서비스 열쇠(API)** 뿐입니다. 기기 열쇠를 검사한 뒤
--   서버가 대신 씁니다 — clinic_devices 와 같은 방식입니다.
-- ★ 치과는 자기 것만, 디자인센터는 거래하는 치과 것을 봅니다.

alter table clinic_printers enable row level security;
alter table auto_jobs       enable row level security;

drop policy if exists clinic_printers_select on clinic_printers;
create policy clinic_printers_select on clinic_printers
  for select using (
    clinic_org_id = my_org_id()
    or (my_org_type() = 'design_center' and is_partner_org(clinic_org_id))
  );

drop policy if exists auto_jobs_select on auto_jobs;
create policy auto_jobs_select on auto_jobs
  for select using (
    clinic_org_id = my_org_id()
    or (my_org_type() = 'design_center' and is_partner_org(clinic_org_id))
  );

-- ---------- 제품에 성질 둘 ----------
--
-- ★ '자동 템포러리' 는 아직 상품이 아닙니다 (사용자 2026-10-06 —
--   "상품화하긴 이르니깐 DenFlow 홈페이지에는 눈에 아직 안띄게").
--   is_active 를 끄면 치과에서 사라지지만 **시험도 못 합니다.** 그래서
--   감추기와 켜기를 따로 둡니다.
--
-- ★ 코드에 'AUTO_TEMP' 를 박지 않습니다. prosthesis/index.ts 가 말하는
--   원칙 그대로 — "종류가 자기 성질을 들고 있어야 합니다".

alter table prosthesis_types
  add column if not exists is_internal boolean not null default false;

alter table prosthesis_types
  add column if not exists auto_pipeline boolean not null default false;

comment on column prosthesis_types.is_internal is
  '아직 상품이 아니다. 치과 주문등록에서 감추고 센터 화면에서만 고른다 (2026-10-06)';

comment on column prosthesis_types.auto_pipeline is
  '주문이 들어오면 사람 손 없이 디자인·슬라이스·출력까지 간다 (2026-10-06)';
