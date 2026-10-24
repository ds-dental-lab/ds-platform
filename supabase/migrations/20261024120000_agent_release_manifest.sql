-- =========================================================
-- 에이전트 저장소에 안내 파일(JSON)도 받게 (사용자 2026-10-24 — 에이전트 스스로 업데이트)
--
-- ★ release.py 가 zip 과 함께 beta.json·stable.json 을 올립니다 — 받을 판·sha256·zip 이름.
--   버킷이 zip 만 받게 막혀 있어 415(invalid_mime_type)로 거절됐습니다.
-- ★ 비공개는 그대로 — 읽는 쪽은 서버(/api/device/agent/update)가 서비스 열쇠로 읽습니다.
-- =========================================================

update storage.buckets
   set allowed_mime_types = array['application/zip', 'application/x-zip-compressed', 'application/json']
 where id = 'agent-release';
