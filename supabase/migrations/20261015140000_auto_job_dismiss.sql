-- =========================================================
-- FlowTemp 책갈피 — 다 나온 건을 치웁니다 (사용자 요청 2026-10-15)
--   "완벽하게 출력 이상없고 완료된 건 x 버튼 만들어도 되지 않겠어"
-- =========================================================
--
-- ★ 브라우저가 아니라 **표에** 남깁니다. 치과에 PC 가 여럿이어도 한 곳에서
--   치우면 모두에서 사라져야 합니다 — '꺼냈다' 는 그 치과 전체의 사실입니다.
-- ★ 책갈피에서만 빠집니다. 작업 기록(단계·시각·파일)은 그대로입니다.
-- ★ 치우는 것은 서버 액션이 관리자 열쇠로 합니다(치과 확인 뒤). 치과에
--   auto_jobs 를 고칠 권한을 열지 않습니다 — 단계까지 고칠 수 있게 됩니다.
alter table auto_jobs
  add column if not exists dismissed_at timestamptz,
  add column if not exists dismissed_by uuid references user_profiles(id) on delete set null;

comment on column auto_jobs.dismissed_at is
  '치과가 책갈피에서 치운 때 — 다 나온 건만 (2026-10-15)';
