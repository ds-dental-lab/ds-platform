-- =========================================================
-- 아침 8시(KST) "오늘 도착 예정" 안내. (사용자 요청 2026-09-07)
--
-- ★ DB 시계(pg_cron)가 매일 23:00 UTC = 08:00 KST 에 화면 서버의
--   /api/jobs/arrival-notice 를 부릅니다. 치과마다 한 통씩 알림톡
--   대기열에 쌓입니다 (repositories/arrival-notice). 일요일은 요청시한
--   규칙상 도착분이 없어 저절로 조용합니다.
-- ★ 헤더의 열쇠는 Vercel 의 JOB_SECRET 과 같아야 합니다. Vercel 에
--   아직 없으면 서버가 검사를 안 하므로 먼저 걸어 두어도 됩니다.
-- =========================================================

do $$
begin
  if exists (select 1 from cron.job where jobname = 'arrival-notice') then
    perform cron.unschedule('arrival-notice');
  end if;
end
$$;

select cron.schedule(
  'arrival-notice',
  '0 23 * * *',
  $$
    select net.http_post(
      url := 'https://denflow.kr/api/jobs/arrival-notice',
      headers := '{"x-denflow-job":"lYyL2VhWWr1tmKLOjr0IcIGK_g2AnUDm","content-type":"application/json"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 15000
    );
  $$
);
