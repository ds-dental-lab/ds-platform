-- =========================================================
-- 에이전트 zip 저장소를 비공개로 (사용자 결정 2026-10-19)
--
-- ★ 왜 — "다운받기를 오픈하는 게 걸린다". 공개 버킷은 주소만 알면 누구나 받습니다.
--   이제 /agent 에서 여섯 자리 번호가 맞을 때만 1분짜리 서명 주소를 내줍니다
--   (actions/agent-download). 올리는 쪽(release.py)은 서비스 열쇠라 그대로 됩니다.
-- ★ 버킷은 대시보드에서 만들어 migration 에 없습니다 — 있으면 바꾸고, 없으면 만듭니다.
-- =========================================================

insert into storage.buckets (id, name, public)
values ('agent-release', 'agent-release', false)
on conflict (id) do update set public = false;
