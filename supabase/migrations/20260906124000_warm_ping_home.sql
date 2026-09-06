-- =========================================================
-- 깨우는 시계가 **화면 함수**를 깨우도록 고칩니다. (2026-09-06)
--
-- ★ /api/warm 만 4분마다 부르니 200 'ok' 는 꼬박꼬박 돌아오는데
--   (warm_ping_status 로 확인), 9분 뒤 첫 화면은 여전히 4.4초였습니다.
--   Vercel 이 route handler(api)와 화면(page)을 **다른 함수**로 띄우는 것으로
--   보입니다 — api 를 깨워 봐야 화면은 자고 있습니다.
--
-- ★ 그래서 `/` (회사 홈페이지)도 같이 부릅니다. 로그인 없이 열리고,
--   쿠키를 읽는 동적 화면이라 화면 함수와 앞단(proxy)이 둘 다 깹니다.
--   /api/warm 은 그대로 둡니다 — 서버 액션·API 쪽도 깨어 있게.
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
  '*/4 * * * *',
  $$
    select net.http_get(url := 'https://denflow.kr/', timeout_milliseconds := 8000);
    select net.http_get(url := 'https://denflow.kr/api/warm', timeout_milliseconds := 8000);
  $$
);
