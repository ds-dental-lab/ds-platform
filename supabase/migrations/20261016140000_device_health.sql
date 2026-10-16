-- =========================================================
-- 기기 상태판 — 치과 PC·설계 PC 가 잘 도는지 (사용자 요청 2026-10-16)
--   "에이전트를 다른 치과에도 깔아 주면 잘 작동하는지 관리할 수 있는 게 있으면 좋겠네.
--    정상 작동인지, 오류가 나면 어떤 오류인지"
-- =========================================================
--
-- ★★ 왜 — 오늘(2026-10-16) 설계 PC 프로그램이 한꺼번에 꺼졌는데 아무도 몰랐고,
--   메이트 exocad 요청 두 번을 아무도 안 가져갔습니다. 꺼진 것을 **모르는 것**이
--   가장 위험합니다.
-- ★ 새 에이전트·설계 PC 는 1분마다 '살아 있음 + 상태' 를 보냅니다(heartbeat_at).
--   옛 에이전트(1.3.2 이하)는 안 보내서 heartbeat_at 이 비어 있습니다 — 그 기기는
--   꺼짐 알림을 **보내지 않습니다**(거짓 알림이 끝없이 갑니다).
-- ★ 상태에 환자 정보를 싣지 않습니다. PC 상태와 오류 문구뿐입니다.

alter table clinic_devices
  add column if not exists heartbeat_at timestamptz,
  add column if not exists status jsonb,
  add column if not exists last_error text,
  add column if not exists last_error_at timestamptz,
  add column if not exists offline_alerted_at timestamptz;

comment on column clinic_devices.heartbeat_at is '마지막 상태 보고 — 새 에이전트·설계 PC 가 1분마다 (2026-10-16)';
comment on column clinic_devices.status is '판·프린터·감시 폴더 등 — 환자 정보 없음 (2026-10-16)';
comment on column clinic_devices.offline_alerted_at is '꺼짐 알림을 보낸 때 — 다시 살아나면 비웁니다';

-- ---------- 오류 기록 ----------
create table if not exists device_events (
  id          uuid primary key default gen_random_uuid(),
  device_id   uuid not null references clinic_devices(id) on delete cascade,
  at          timestamptz not null default now(),
  level       text not null default 'error' check (level in ('error', 'warn', 'info')),
  message     text not null
);

create index if not exists device_events_device_at_idx on device_events (device_id, at desc);

comment on table device_events is '기기가 올린 오류·경고 (2026-10-16). 30일 지나면 지웁니다';

alter table device_events enable row level security;

-- 센터만 읽습니다 — 치과는 상태판이 없습니다. 쓰기는 서버 열쇠로만.
drop policy if exists device_events_select on device_events;
create policy device_events_select on device_events
  for select using (my_org_type() = 'design_center');

-- ---------- 꺼짐 감시 (5분마다) ----------
--
-- ★ 영업시간(월~토 09~19시, 한국 시각)에만 알립니다. 밤에 PC 를 끄는 것은 정상입니다.
-- ★ 한 번 꺼지면 **한 번만** 알립니다(offline_alerted_at). 다시 살아나면 비웁니다.
-- ★ 받는 곳은 디자인센터(센터는 하나뿐 — ds-flow-org-model).
create or replace function device_offline_watchdog()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  kst timestamp := now() at time zone 'Asia/Seoul';
begin
  delete from device_events where at < now() - interval '30 days';

  if extract(isodow from kst) = 7 or extract(hour from kst) < 9 or extract(hour from kst) >= 19 then
    return;
  end if;

  with gone as (
    update clinic_devices d
       set offline_alerted_at = now()
     where d.revoked_at is null
       and d.heartbeat_at is not null
       and d.heartbeat_at < now() - interval '30 minutes'
       and d.offline_alerted_at is null
    returning d.id, d.name, d.clinic_org_id
  )
  insert into notifications (org_id, channel, status, event_type, title, body, link, payload)
  select c.id, 'in_app', 'sent', 'device.offline',
         '기기 소식이 끊겼습니다 — ' || o.name,
         g.name || ' — 30분째 소식이 없습니다. PC 가 켜져 있는지, 덴플로우 프로그램이 떠 있는지 확인해 주세요',
         '/design/devices', jsonb_build_object('deviceId', g.id)
    from gone g
    join organizations o on o.id = g.clinic_org_id
    cross join (select id from organizations where org_type = 'design_center') c;
end;
$$;

select cron.unschedule('device-offline-watchdog')
 where exists (select 1 from cron.job where jobname = 'device-offline-watchdog');

select cron.schedule('device-offline-watchdog', '*/5 * * * *', $$ select public.device_offline_watchdog() $$);
