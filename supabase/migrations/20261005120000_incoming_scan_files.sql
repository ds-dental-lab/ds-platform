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
