-- =========================================================
-- 깨우는 시계를 1분 → 3분으로, 기공소 화면은 뺌 (2026-10-27)
--
-- ★ Vercel 무료 한도(CDN 요청 100만/월)의 75% 경고 메일. 1분마다 다섯 곳을 부르면
--   그것만 달 21만 건입니다. 거래처가 생기면 Pro 로 올리기로 했고(사용자 2026-10-27),
--   그 전까지는 한도 안에 맞춥니다.
-- ★ 3분이면 콜드 스타트(7분 쉬면 식음, ds-flow-performance)는 안 생깁니다.
-- ★ /lab 은 아직 쓰는 기공소가 없어 뺍니다. 거래 기공소가 생기면 다시 넣습니다.
--   3분에 네 번 → 하루 1,920번, 달 5.8만.
-- =========================================================

do $$
begin
  if exists (select 1 from cron.job where jobname = 'warm-denflow') then
    perform cron.unschedule('warm-denflow');
  end if;
end
$$;

select cron.schedule(
  'warm-denflow',
  '*/3 * * * *',
  $$
    select net.http_get(url := 'https://denflow.kr/clinic', headers := '{"x-denflow-warm":"1"}'::jsonb, timeout_milliseconds := 8000);
    select net.http_get(url := 'https://denflow.kr/design', headers := '{"x-denflow-warm":"1"}'::jsonb, timeout_milliseconds := 8000);
    select net.http_get(url := 'https://denflow.kr/m',      headers := '{"x-denflow-warm":"1"}'::jsonb, timeout_milliseconds := 8000);
    select net.http_get(url := 'https://denflow.kr/api/warm', timeout_milliseconds := 8000);
  $$
);
