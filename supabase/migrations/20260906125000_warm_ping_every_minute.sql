-- =========================================================
-- 깨우는 시계를 1분 간격으로 조입니다. (2026-09-06)
--
-- ★ 4분마다 `/` 와 /api/warm 을 불러 둘 다 200 을 받았는데도, 마지막 핑
--   3분 뒤에 연 첫 화면이 2.1초였습니다 (같은 화면을 바로 다시 열면 0.3초).
--   Vercel 이 한가한 프로세스를 내리는 간격이 4분보다 짧은 것으로 봅니다.
--
-- ★ 1분이면 하루 2,880번 — 함수 호출 한도(월 100만)의 1% 미만이고,
--   DB 쪽 부담은 없습니다 (pg_net 은 비동기로 보내고 잊습니다).
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
  '* * * * *',
  $$
    select net.http_get(url := 'https://denflow.kr/', timeout_milliseconds := 8000);
    select net.http_get(url := 'https://denflow.kr/api/warm', timeout_milliseconds := 8000);
  $$
);
