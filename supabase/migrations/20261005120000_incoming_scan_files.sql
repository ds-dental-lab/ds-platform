-- =========================================================
-- 들어온 스캔 한 건에 파일이 여럿 (사용자 요청 2026-10-05 — Medit)
--
-- dxd 는 한 건이 파일 하나입니다. Medit 은 다릅니다 — 한 케이스가 obj 여러 개로
-- 나옵니다 (상악·하악·교합). 실제로 받은 내보내기가 세 개였습니다.
--
--     2026-09-09-최정여-maxillary.obj
--     2026-09-09-최정여-mandibular.obj
--     2026-09-09-최정여-occlusionfirst.obj
--
-- ★ 묶어서 zip 하나로 올리지 않습니다. exocad 런처가 **파일 이름의 부위 낱말**로
--   상악·하악·교합을 가려 넣습니다 (maxillary·mandibular·occlusionfirst). zip 으로
--   올리면 그 자리에서 사람이 풀어야 합니다.
-- ★ 표를 새로 만들지 않고 줄 안에 목록으로 둡니다. 스캔은 주문에 붙는 순간
--   order_files 로 옮겨 가 사라지는, 수명이 짧은 줄입니다 — 거기에 딸린 표를
--   하나 더 만들면 지울 것만 늘어납니다.
-- ★ 예전 줄(dxd)은 files 가 비어 있습니다. 읽는 쪽이 비면 storage_path 하나로
--   봅니다 — 지난 줄을 건드려 고치지 않습니다.
-- =========================================================

alter table incoming_scans
  add column if not exists files jsonb not null default '[]'::jsonb;

comment on column incoming_scans.files is
  '한 케이스의 파일들 [{name, path, size}]. 비어 있으면 storage_path 하나 (2026-10-05)';


-- ---------------------------------------------------------
-- 같은 케이스를 **다시 스캔해서** 내보냈을 때 (2026-10-05)
--
-- ★★ 지금 색인은 '같은 케이스 번호면 한 줄' 이라, 이미 주문에 붙은 케이스를
--   다시 내보내면 **아예 못 올라갑니다** (unique 위반). 그런데 다시 내보내는
--   가장 흔한 이유가 **재스캔** 입니다 — 디자인센터가 "스캔이 이상하니 다시
--   올려 달라" 고 한 그 케이스입니다. 막아 두면 그 길이 끊깁니다.
--
-- ★ 그래서 '아직 주문에 안 붙은 것' 끼리만 막습니다. 목록에 두 줄이 생기는
--   것은 그대로 막고, 붙고 난 뒤의 새 스캔은 받습니다.
-- ---------------------------------------------------------

drop index if exists incoming_scans_case_unique;

create unique index if not exists incoming_scans_case_unique
  on incoming_scans (clinic_org_id, case_guid)
  where case_guid <> '' and deleted_at is null and order_id is null;
