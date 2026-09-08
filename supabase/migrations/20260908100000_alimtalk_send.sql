-- =========================================================
-- 알림톡 발송 준비. (사용자가 2026-09-08 알리고에 템플릿 7개 등록)
--
-- ★ vars — 템플릿 변수 값 {"주문번호": "...", "환자명": "..."}.
--   지금까지는 사람이 읽는 title/body 만 쌓았는데, 알리고는 등록한 템플릿
--   글자 그대로에 변수만 끼운 것을 요구합니다. 변수를 따로 들고 있어야
--   보내는 쪽(domain/alimtalk/template)이 그 글을 만듭니다.
--   옛 줄(vars 가 null)은 보내지 않고 skipped 로 표시합니다.
-- ★ template_code · attempts — 무엇으로 몇 번 보냈는지 기록.
-- ★ 1분마다 대기열을 비웁니다 (/api/jobs/alimtalk, JOB_SECRET 헤더).
-- =========================================================

alter table alimtalk_queue
  add column if not exists vars          jsonb,
  add column if not exists template_code text,
  add column if not exists attempts      integer not null default 0;

comment on column alimtalk_queue.vars is '카카오 템플릿 변수 값. null 이면 못 보냅니다(옛 줄)';

create index if not exists alimtalk_queue_pending_idx
  on alimtalk_queue (created_at) where status = 'pending';

do $$
begin
  if exists (select 1 from cron.job where jobname = 'alimtalk-send') then
    perform cron.unschedule('alimtalk-send');
  end if;
end
$$;

select cron.schedule(
  'alimtalk-send',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://denflow.kr/api/jobs/alimtalk',
      headers := '{"x-denflow-job":"lYyL2VhWWr1tmKLOjr0IcIGK_g2AnUDm","content-type":"application/json"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $$
);
