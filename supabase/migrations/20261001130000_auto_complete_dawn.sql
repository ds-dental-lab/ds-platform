-- =========================================================
-- 자동 완료를 **새벽 3시 10분(KST)** 으로 (사용자 결정 2026-10-01 —
-- 파기 작업과 같은 시간대에 묶고 싶다).
--
-- ★ 18:10 UTC = 03:10 KST. 파기(18:00 UTC)와 10분 띄웁니다.
-- ★ 시각이 바뀌어도 **적히는 배송 시각은 그날 한국 날짜**입니다
--   (domain/auto-complete 의 stampFor). 그대로 적으면 한국 1일 새벽 건이
--   UTC 전달 말일이 되어 **이미 마감한 달**에 금액이 생깁니다.
-- =========================================================

do $$
begin
  if exists (select 1 from cron.job where jobname = 'auto-complete') then
    perform cron.unschedule('auto-complete');
  end if;
end
$$;

select cron.schedule(
  'auto-complete',
  '10 18 * * *',
  $$
    select net.http_post(
      url := 'https://denflow.kr/api/jobs/auto-complete',
      headers := '{"x-denflow-job":"lYyL2VhWWr1tmKLOjr0IcIGK_g2AnUDm","content-type":"application/json"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  $$
);
