-- =========================================================
-- DS Flow — 파일 이름 마스킹을 되돌립니다
-- 파일 위치: supabase/migrations/<타임스탬프>_unmask_file_names.sql
--
-- 사용자 결정 2026-08-12 — *"파일명은 나오게끔 다시 만들어주고"*.
-- 개인정보 쪽은 뒤로 미루고 화면 완성도를 먼저 봅니다.
--
-- ★ 이미 바뀐 18줄의 원래 이름은 되살릴 수 없습니다.
--   앞 마이그레이션(20260812110000)이 file_name 을 덮어썼고, 원본을 어디에도
--   남기지 않았습니다 — 그게 그 마이그레이션의 목적이었습니다.
--   저장소 경로도 처음부터 uuid 라 거기서도 못 꺼냅니다.
--   앞으로 올리는 파일은 원래 이름 그대로 남습니다.
--
-- ★ 나중에 다시 하게 되면 —
--   그때는 원본을 지우지 말고 **화면에 보일 이름을 따로** 두는 편이 낫습니다.
--   되돌릴 수 있어야 합니다. (git 2591e71 에 그때 만든 것이 다 있습니다)
-- =========================================================

drop trigger if exists order_files_mask_name on order_files;

drop function if exists mask_order_file_name();
drop function if exists order_file_kind_tag(order_file_kind);
drop function if exists order_file_ext(text);
