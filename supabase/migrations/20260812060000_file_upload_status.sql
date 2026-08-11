-- =========================================================
-- DS Flow — 올리기 전에 줄을 먼저 만듭니다
-- 파일 위치: supabase/migrations/<타임스탬프>_file_upload_status.sql
-- 기준: 사용자 결정 2026-08-12 — "빠진 파일만 다시 올리기"
--
-- 무엇이 문제였나.
--   지금은 저장소에 올라간 뒤에야 order_files 에 줄이 생깁니다.
--   그래서 올리다 끊긴 파일은 **아무 흔적이 없습니다**.
--   개수만 세어 둔 scan_file_expected 로 (2/3) 은 알렸지만,
--   빠진 것이 무엇인지 모르니 치과에 전화해서 주문을 다시 넣게 해야 했습니다.
--
-- 어떻게 바꾸나.
--   올리기 **전에** pending 줄을 만듭니다. 이름·크기가 함께 남습니다.
--   성공하면 uploaded, 실패하면 failed 로 바꿉니다.
--
--   그러면 —
--     치과 화면    '박미래-preview.png 가 안 올라왔습니다 [다시 올리기]'
--     디자인센터   무엇을 기다리는지 이름으로 압니다
--     전화         필요 없습니다
--
-- ★ 끊긴 채로 남은 pending 줄은 지우지 않습니다.
--   그 줄이 곧 "이 파일이 빠졌다" 는 증거입니다. 지우면 다시 모릅니다.
--
-- ★ scan_file_expected 를 걷어냅니다.
--   같은 것을 두 곳에서 세면 언젠가 어긋납니다. 줄이 더 많은 것을 알고 있으니
--   줄로 셉니다 — 보낸 수 = 전체 줄, 올라온 수 = uploaded 줄.
-- =========================================================

create type file_upload_status as enum ('pending', 'uploaded', 'failed');

alter table order_files
  add column upload_status file_upload_status not null default 'uploaded';

comment on column order_files.upload_status is
  'pending=올리는 중이거나 끊긴 것, uploaded=저장소에 있음, failed=올리다 실패';

-- 지금까지의 줄은 모두 올라간 것입니다 (올라간 뒤에만 만들었으므로)
-- default 'uploaded' 가 그대로 맞습니다.

-- 목록에서 '안 올라온 것' 만 빠르게 찾습니다
create index order_files_pending_idx
  on order_files (order_id, upload_status)
  where upload_status <> 'uploaded';

-- ---------- 옛 셈 방식을 걷어냅니다 ----------
drop function if exists note_planned_scan_files(uuid, smallint);
alter table orders drop column if exists scan_file_expected;

-- ---------- 지울 수 있어야 합니다 ----------
--
-- ★ 다시 올릴 때 못 쓰게 된 줄을 치웁니다.
--   지금까지 order_files 에는 delete 정책이 없어 아무도 못 지웠습니다.
--   주문을 볼 수 있는 사람이면 그 주문의 파일도 지울 수 있게 합니다 —
--   범위는 order_file_select 와 같습니다.
create policy order_file_delete on order_files
  for delete using (
    exists (select 1 from orders o where o.id = order_files.order_id)
  );
