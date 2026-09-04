-- =========================================================
-- 홈페이지 문의에서 '담당자 성함' 을 뺍니다. (사용자 요청 2026-09-04)
--
-- ★ 열은 **남깁니다.** 이미 들어온 문의에는 이름이 적혀 있고, 그걸
--   지울 이유가 없습니다. 앞으로 안 받을 뿐입니다 — not null 과
--   빈 문자열 검사만 풉니다.
--
-- ★ 개인정보 항목이 하나 줄어듭니다. 동의 문구(domain/contact CONSENT)
--   도 같이 바꿨습니다 — 화면과 저장이 같은 글을 봐야 합니다.
-- =========================================================

alter table contact_requests
  alter column person_name drop not null;

alter table contact_requests
  drop constraint if exists contact_requests_person_name_check;

comment on column contact_requests.person_name is
  '담당자 성함. 2026-09-04 부터 안 받습니다 — 옛 문의에만 값이 있습니다';
