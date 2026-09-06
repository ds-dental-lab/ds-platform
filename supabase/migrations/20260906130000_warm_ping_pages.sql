-- =========================================================
-- 깨우는 시계가 **각 섹터의 화면 함수**를 직접 부릅니다. (2026-09-06)
--
-- ★ `/` 와 /api/warm 을 1분마다 불러 200 을 받아도 /clinic 첫 화면은
--   2.0초였습니다 (바로 다시 열면 0.3초). Vercel 이 화면 묶음마다 다른
--   프로세스를 띄우므로, 깨우려는 화면을 **그 주소로** 불러야 합니다.
--
-- ★ 로그인 없이 /clinic 을 부르면 앞단(proxy)이 /login 으로 돌려보내
--   화면 함수가 실행되지 않습니다. 그래서 x-denflow-warm 헤더를 달고,
--   proxy 는 그 요청만 통과시킵니다 (src/proxy.ts). 화면 쪽은 세션이
--   없으니 곧장 /login 으로 보냅니다 — 자료는 안 나가고 함수만 깹니다.
--
-- ★ 치과·디자인센터·기공소·폰 화면 넷을 다 부릅니다. 어느 쪽 사용자가
--   먼저 오든 기다리지 않게. 1분에 다섯 번, 하루 7,200번 — 한도의 1%.
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
    select net.http_get(url := 'https://denflow.kr/clinic', headers := '{"x-denflow-warm":"1"}'::jsonb, timeout_milliseconds := 8000);
    select net.http_get(url := 'https://denflow.kr/design', headers := '{"x-denflow-warm":"1"}'::jsonb, timeout_milliseconds := 8000);
    select net.http_get(url := 'https://denflow.kr/lab',    headers := '{"x-denflow-warm":"1"}'::jsonb, timeout_milliseconds := 8000);
    select net.http_get(url := 'https://denflow.kr/m',      headers := '{"x-denflow-warm":"1"}'::jsonb, timeout_milliseconds := 8000);
    select net.http_get(url := 'https://denflow.kr/api/warm', timeout_milliseconds := 8000);
  $$
);
