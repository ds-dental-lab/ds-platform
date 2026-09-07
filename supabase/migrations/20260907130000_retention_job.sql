-- =========================================================
-- 새벽 3시(KST) 자동 파기. (사용자 결정 2026-09-07 — "자동으로 하는 게
-- 좋아 보여. 그러나 의뢰 내역은 지워지면 안 된다")
--
-- ★ 매일 18:00 UTC = 03:00 KST 에 /api/jobs/retention 을 부릅니다.
--   지우는 것은 파일·지운 파일·열람 기록뿐이고 orders 표는 안 건드립니다
--   (repositories/retention-job). 기간은 관리자가 정한 값만 씁니다.
-- ★ 열쇠는 Vercel 의 JOB_SECRET 과 같아야 하고, 없으면 서버가 거절합니다.
-- =========================================================

do $$
begin
  if exists (select 1 from cron.job where jobname = 'retention-purge') then
    perform cron.unschedule('retention-purge');
  end if;
end
$$;

select cron.schedule(
  'retention-purge',
  '0 18 * * *',
  $$
    select net.http_post(
      url := 'https://denflow.kr/api/jobs/retention',
      headers := '{"x-denflow-job":"lYyL2VhWWr1tmKLOjr0IcIGK_g2AnUDm","content-type":"application/json"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $$
);
