-- =========================================================
-- 서버를 깨워 두는 시계. (사용자 지적 2026-09-06 — "전체적으로 반응속도가 느려")
--
-- ★ 느림의 정체는 Vercel 콜드 스타트였습니다 — 7분 쉬면 첫 화면 3.7초(함수를
--   줄인 뒤 2.0초). Hobby 플랜은 Vercel cron 이 하루 한 번뿐이고, 외부 핑
--   서비스는 계정을 하나 더 만들어야 합니다. 이미 24시간 켜져 있는 DB 의
--   시계(pg_cron)에 맡기면 새 계정도, 새 요금도 없습니다.
--
-- ★ 4분마다 /api/warm 을 GET 합니다. 그 경로는 DB 를 안 건드리고 'ok' 만
--   돌려주므로(src/app/api/warm/route.ts) 부담이 없습니다. 하루 360번.
--
-- ★ 이름으로 잡아 두어 다시 실행해도 겹치지 않습니다 (unschedule 뒤 schedule).
-- =========================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

grant usage on schema cron to postgres;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'warm-denflow') then
    perform cron.unschedule('warm-denflow');
  end if;
end
$$;

select cron.schedule(
  'warm-denflow',
  '*/4 * * * *',
  $$ select net.http_get(url := 'https://denflow.kr/api/warm', timeout_milliseconds := 8000) $$
);
