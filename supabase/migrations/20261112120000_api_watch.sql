-- =========================================================
-- API 서버 지켜보기 + 예약 작업 기록 청소. (2026-11-12, 사용자 "셋다 만들어줘")
--
-- ★ 기준 사건: 2026-11-12 새벽 ~ 11:39 KST. Supabase 의 API 서버(PostgREST)만
--   503 PGRST002 로 죽었습니다. 화면·로그인·DB 는 멀쩡해서 로그인은 되는데
--   안에서 아무것도 못 읽는 상태가 10시간쯤 이어졌고 **아무 알림도 없었습니다**.
--   - 감시 핑(/api/warm)은 DB 를 안 읽고 "ok" 만 답했습니다
--   - 기존 장애 알림(server-trouble)은 죽은 그 API 서버를 거쳐야 나갑니다
--
-- ★ 그래서 지켜보는 쪽을 **DB 안**에 둡니다. DB 는 그날도 살아 있었습니다.
--   2분마다:
--     1) 지난번에 찔러 본 답을 읽습니다 (net._http_response)
--     2) 200 이 아니면 실패로 셉니다. **두 번 연달아** 실패하면 알립니다
--        (한 번은 재시작·배포 중의 순간일 수 있습니다)
--     3) 감시 핑(/api/warm)이 최근 두 번 연달아 `db-fail:` 로 답했어도 알립니다
--        — 화면 서버 → API 서버 길이 막힌 경우
--     4) 알림은 https://denflow.kr/api/jobs/api-watch 로 — 그 주소는 Supabase 를
--        안 거치고 메일만 보냅니다. 멈춰 있는 동안 한 시간에 한 번.
--     5) 돌아오면 "다시 정상입니다" 를 한 번 보냅니다
--     6) 다음 번을 위해 새로 찔러 둡니다
--
-- ★ 부담: 하루 720번, 한 번에 한 줄 읽기. 버셀은 안 거칩니다 (알릴 때만 한 번).
-- ★ 못 잡는 것: 버셀 자체가 죽었을 때 (알림 길이 버셀입니다), DB 가 죽었을 때.
-- ★ 자동 재시작은 일부러 안 합니다 — 알림 받고 사람이 누릅니다 (2026-10-10 결정 그대로).
-- =========================================================

create table if not exists api_watch_state (
  id           boolean primary key default true check (id),
  request_id   bigint,                 -- 지난번에 찔러 본 요청 (net.http_get 이 준 번호)
  fail_streak  integer not null default 0,
  down_since   timestamptz,            -- 처음 실패를 본 시각
  alerted_at   timestamptz,            -- 마지막으로 알린 시각 (정상이면 null)
  last_ok_at   timestamptz,
  last_status  text,
  updated_at   timestamptz not null default now()
);

comment on table api_watch_state is
  'API 서버 지켜보기의 기억 한 줄 (2026-11-12). pg_cron 의 api_watch_tick 만 씁니다';

-- ★ 화면 쪽에서는 아무도 못 봅니다 — 정책을 하나도 두지 않습니다
alter table api_watch_state enable row level security;

insert into api_watch_state (id) values (true) on conflict (id) do nothing;

create or replace function api_watch_tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s          api_watch_state%rowtype;
  r          record;
  v_known    boolean := false;   -- 지난번 답을 읽었나
  v_ok       boolean := false;
  v_status   integer;
  v_detail   text := '';
  v_site     boolean := false;   -- 감시 핑이 두 번 연달아 못 읽었나
  v_where    text := 'api';
  v_alert    jsonb;
  v_secret   text;
begin
  select * into s from api_watch_state where id for update;

  -- ★ 작업 열쇠는 **이 파일에 적지 않습니다**. 이미 도는 예약 작업(alimtalk-send)이 쓰는 값을
  --   실행할 때 읽습니다 — 열쇠가 바뀌어도 한 곳만 고치면 됩니다.
  select substring(command from '"x-denflow-job":"([^"]+)"') into v_secret
    from cron.job where jobname = 'alimtalk-send';

  -- 1) 지난번에 찔러 본 답
  if s.request_id is not null then
    select status_code, error_msg, timed_out, left(content, 120) as head
      into r
      from net._http_response where id = s.request_id;
    if found then
      v_known  := true;
      v_status := r.status_code;
      v_ok     := (r.status_code = 200);
      v_detail := coalesce(nullif(r.head, ''), r.error_msg, case when r.timed_out then 'timeout' end, '');
    end if;
    -- ★ 답이 아직 없으면(못 찾음) 아무 판단도 안 합니다 — 모르는 것을 실패로 세지 않습니다
  end if;

  -- 3) 감시 핑이 최근 두 번 연달아 못 읽었나 (10분 안)
  select count(*) = 2 and bool_and(w.content like 'db-fail:%')
    into v_site
    from (
      select content from net._http_response
      where created > now() - interval '10 minutes'
        and (content = 'ok' or content like 'db-fail:%')
      order by created desc limit 2
    ) w;
  v_site := coalesce(v_site, false);

  if v_known and v_ok and not v_site then
    -- 5) 정상 — 알린 적이 있으면 돌아왔다고 한 번
    if s.alerted_at is not null and v_secret is not null then
      perform net.http_post(
        url := 'https://denflow.kr/api/jobs/api-watch',
        headers := jsonb_build_object('x-denflow-job', v_secret, 'content-type', 'application/json'),
        body := jsonb_build_object('kind', 'up', 'where', 'api', 'status', 200, 'detail', '', 'since', s.down_since),
        timeout_milliseconds := 20000
      );
    end if;
    s.fail_streak := 0;
    s.down_since  := null;
    s.alerted_at  := null;
    s.last_ok_at  := now();
    s.last_status := '200';

  elsif (v_known and not v_ok) or v_site then
    -- 2) 실패
    s.fail_streak := s.fail_streak + 1;
    s.down_since  := coalesce(s.down_since, now());
    if v_known and not v_ok then
      s.last_status := coalesce(v_status::text, 'no-answer') || ' ' || v_detail;
    else
      v_where := 'site';
      s.last_status := 'site db-fail';
      v_detail := 'db-fail';
    end if;

    -- 4) 두 번 연달아(또는 감시 핑 두 번) + 한 시간 안에 알린 적 없음
    if (s.fail_streak >= 2 or v_site)
       and (s.alerted_at is null or s.alerted_at < now() - interval '60 minutes') then
      if v_secret is null then
        raise warning 'api_watch: 작업 열쇠를 못 읽어 알림을 못 보냅니다 (alimtalk-send 예약 작업 확인)';
      end if;
      v_alert := jsonb_build_object(
        'kind', 'down', 'where', v_where,
        'status', case when v_where = 'api' then v_status end,
        'detail', v_detail, 'since', s.down_since
      );
      if v_secret is not null then
        perform net.http_post(
          url := 'https://denflow.kr/api/jobs/api-watch',
          headers := jsonb_build_object('x-denflow-job', v_secret, 'content-type', 'application/json'),
          body := v_alert,
          timeout_milliseconds := 20000
        );
        s.alerted_at := now();
      end if;
    end if;
  end if;

  -- 6) 다음 번을 위해 찔러 둡니다 — 공개 열쇠로 조직 표 한 줄 (로그인 없이는 0줄, 그래도 200)
  --    ★ 아래 apikey 는 **공개 열쇠(publishable)** 입니다 — 브라우저에 내려가는 그 값이라 비밀이 아닙니다.
  s.request_id := net.http_get(
    url := 'https://dzliwedyqkondvcwnvbh.supabase.co/rest/v1/organizations?select=id&limit=1',
    headers := '{"apikey":"sb_publishable_KXuEswvJ2Tg1E6jDbq2-iQ_m9fC-4D0"}'::jsonb,
    timeout_milliseconds := 10000
  );

  update api_watch_state set
    request_id = s.request_id, fail_streak = s.fail_streak, down_since = s.down_since,
    alerted_at = s.alerted_at, last_ok_at = s.last_ok_at, last_status = s.last_status,
    updated_at = now()
  where id;
end;
$$;

revoke all on function api_watch_tick() from public, anon, authenticated;

comment on function api_watch_tick() is
  'API 서버를 2분마다 찔러 보고 두 번 연달아 실패하면 메일로 알립니다 (2026-11-12). 자동 재시작은 안 합니다';

do $$
begin
  if exists (select 1 from cron.job where jobname = 'api-watch') then
    perform cron.unschedule('api-watch');
  end if;
  if exists (select 1 from cron.job where jobname = 'cron-history-trim') then
    perform cron.unschedule('cron-history-trim');
  end if;
end
$$;

-- ★ 밤낮 없이 돕니다 — 이번 고장은 새벽에 났습니다 (감시 핑은 08~21시만 돕니다)
select cron.schedule('api-watch', '*/2 * * * *', $$ select api_watch_tick(); $$);

-- ---------- 예약 작업 실행 기록 청소 ----------
-- ★ cron.job_run_details 는 스스로 안 지워집니다. 2026-09-06 부터 22만 5천 줄 · 153MB —
--   DB 전체(189MB)의 80% 가 이 기록이었습니다. 14일 지난 것을 매일 03:20 KST 에 지웁니다.
select cron.schedule(
  'cron-history-trim',
  '20 18 * * *',
  $$ delete from cron.job_run_details where end_time < now() - interval '14 days'; $$
);
