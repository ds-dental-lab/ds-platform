-- 월요일 아침 운영 근황 (읽기만) — npx supabase db query --linked -f tools/ops/weekly_status.sql
with db as (
  select 'DB 크기' as 항목, pg_size_pretty(pg_database_size(current_database())) as 값
), st as (
  select '저장소 파일' as 항목,
         count(*)::text || '개 · ' || pg_size_pretty(coalesce(sum((metadata->>'size')::bigint),0)) as 값
  from storage.objects
), cron7 as (
  select '시계 실패(7일)' as 항목,
         coalesce(string_agg(j.jobname || ' ' || f.n::text || '회', ', '), '없음') as 값
  from (select jobid, count(*) n from cron.job_run_details
        where start_time > now() - interval '7 days' and status <> 'succeeded' group by jobid) f
  join cron.job j on j.jobid = f.jobid
), cronlast as (
  select '시계 마지막' as 항목,
         string_agg(j.jobname || ' ' || to_char(m.t at time zone 'Asia/Seoul','MM-DD HH24:MI'), ', ' order by j.jobname) as 값
  from (select jobid, max(start_time) t from cron.job_run_details group by jobid) m
  join cron.job j on j.jobid = m.jobid
), ord as (
  select '주문(7일)' as 항목, count(*)::text || '건' as 값 from orders where created_at > now() - interval '7 days'
), aj as (
  select '자동 임시치아(7일)' as 항목,
         coalesce(string_agg(step || ' ' || n::text, ', '), '없음') as 값
  from (select step, count(*) n from auto_jobs where created_at > now() - interval '7 days' group by step) s
), dev as (
  select '에이전트 기기' as 항목,
         count(*)::text || '대 · 24시간 안 신호 ' || count(*) filter (where last_seen_at > now() - interval '24 hours')::text || '대' as 값
  from clinic_devices
)
select * from db union all select * from st union all select * from cron7 union all select * from cronlast
union all select * from ord union all select * from aj union all select * from dev;
