-- =========================================================
-- 깨우는 시계가 도는지 보는 창. (2026-09-06)
--
-- ★ cron.job_run_details 와 net._http_response 는 REST 로 못 봅니다
--   (노출 스키마가 아닙니다). 서비스 키로만 부를 수 있는 함수 하나를 두어
--   "마지막에 언제 불렀고, 서버가 뭐라 답했나" 를 꺼내 봅니다.
--   문제가 생겼을 때 대시보드 SQL 창을 안 열고도 확인할 수 있습니다.
--
-- ★ 아무 사용자도 못 부릅니다 — anon·authenticated 에서 권한을 걷고
--   service_role 에만 줍니다. 안에 든 건 시각과 응답 코드뿐입니다.
-- =========================================================

create or replace function public.warm_ping_status()
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'job', (select to_jsonb(j) - 'nodename' - 'nodeport' - 'database' - 'username'
            from cron.job j where jobname = 'warm-denflow'),
    'runs', (select coalesce(jsonb_agg(to_jsonb(r) order by r.start_time desc), '[]'::jsonb)
             from (select status, return_message, start_time, end_time
                   from cron.job_run_details
                   where jobid = (select jobid from cron.job where jobname = 'warm-denflow')
                   order by start_time desc limit 5) r),
    'responses', (select coalesce(jsonb_agg(to_jsonb(h) order by h.created desc), '[]'::jsonb)
                  from (select status_code, left(content, 20) as body, error_msg, created
                        from net._http_response
                        order by created desc limit 5) h)
  );
$$;

revoke all on function public.warm_ping_status() from public, anon, authenticated;
grant execute on function public.warm_ping_status() to service_role;
