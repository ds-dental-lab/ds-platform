-- =========================================================
-- FlowTemp 출력 중 — 남은 시간과 층 (사용자 요청 2026-10-15)
--   "남은 시간은 안 보여주네. 출력중 UI 가 조금 아쉽네"
-- =========================================================
--
-- ★ 프린터(Bambu)가 알려 주는 값을 치과 PC 가 그대로 올립니다.
--   mc_remaining_time(분) · layer_num · total_layer_num.
-- ★ 비어 있으면 화면이 시작 시각과 퍼센트로 어림합니다(domain/auto-print).
--   옛 치과 PC 가 이 칸을 몰라도 화면은 남은 시간을 보여 줍니다.
-- ★ 단계·퍼센트와 **따로** 적습니다. 이 칸이 안 써져도 진행 보고는 멀쩡해야
--   합니다 — 덤 때문에 본업이 막히면 안 됩니다.
alter table auto_jobs
  add column if not exists remaining_min integer,
  add column if not exists layer_now integer,
  add column if not exists layer_total integer;

comment on column auto_jobs.remaining_min is '프린터가 말한 남은 분 (2026-10-15)';
comment on column auto_jobs.layer_now is '지금 층 (2026-10-15)';
comment on column auto_jobs.layer_total is '전체 층 (2026-10-15)';
