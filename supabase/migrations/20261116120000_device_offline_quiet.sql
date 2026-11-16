-- =========================================================
-- 기기 꺼짐 알림 — 치과가 퇴근하며 PC 를 끈 것은 알리지 않습니다. (2026-11-16)
--
-- ★ 사용자: "이게 무슨 소리야". 치과가 17:50 에 PC 를 끄자 18:25 에
--   "기기 소식이 끊겼습니다" 가 왔습니다. 매일 있는 일이라, 이대로면 진짜 고장과
--   구분이 안 됩니다.
-- ★ 진료 시간은 치과마다 달라서 시간을 정하지 않습니다 (사용자: "시간은 치과마다 다른데").
--   대신 **알릴 까닭이 있을 때만** 알립니다.
--
--   치과 PC
--     1) 그 치과에 **안 끝난 출력 일감이 있는데** 30분째 소식이 없을 때
--     2) **오늘 오후 1시까지 한 번도 안 켜졌을 때** (늦게 여는 치과도 그때는 켜져 있습니다)
--   서버 PC · 디자인 PC (디자인센터 기기)
--     전과 같습니다 — 30분째 소식이 없으면 알립니다. 늘 켜져 있어야 하는 기기입니다.
--
-- ★ 알리는 시간대는 그대로 월~토 09~19시(한국 시각). 공휴일에는 치과 PC 를 보지 않습니다.
-- ★ 한 번 꺼지면 한 번만 알립니다(offline_alerted_at). 다시 살아나면 비웁니다 — 전과 같습니다.
-- ★ 화면(상태판)도 같은 규칙으로 빨강과 회색을 가립니다 (domain/device-health 의 deviceState).
-- =========================================================

create or replace function device_offline_watchdog()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  kst      timestamp := now() at time zone 'Asia/Seoul';
  -- 오늘 0시(한국)
  midnight timestamptz := date_trunc('day', kst) at time zone 'Asia/Seoul';
  holiday  boolean;
begin
  delete from device_events where at < now() - interval '30 days';

  if extract(isodow from kst) = 7 or extract(hour from kst) < 9 or extract(hour from kst) >= 19 then
    return;
  end if;

  select exists (select 1 from holidays h where h.date = kst::date) into holiday;

  with gone as (
    update clinic_devices d
       set offline_alerted_at = now()
      from organizations o
     where o.id = d.clinic_org_id
       and d.revoked_at is null
       and d.heartbeat_at is not null
       and d.heartbeat_at < now() - interval '30 minutes'
       and d.offline_alerted_at is null
       and (
         -- 디자인센터 기기는 늘 켜져 있어야 합니다
         o.org_type = 'design_center'
         -- 치과 PC — 걸린 일감이 있는데 꺼져 있음
         or exists (
           select 1 from auto_jobs j
            where j.clinic_org_id = d.clinic_org_id
              and j.step not in ('done', 'failed')
              and j.dismissed_at is null
              and j.failed_at is null
         )
         -- 치과 PC — 오늘 오후 1시까지 한 번도 안 켜짐 (공휴일 제외)
         or (not holiday and extract(hour from kst) >= 13 and d.heartbeat_at < midnight)
       )
    returning d.id, d.name, d.clinic_org_id, d.heartbeat_at, o.org_type, o.name as org_name
  )
  insert into notifications (org_id, channel, status, event_type, title, body, link, payload)
  select c.id, 'in_app', 'sent', 'device.offline',
         '기기 소식이 끊겼습니다 — ' || g.org_name,
         g.name || ' — ' ||
           case
             when g.org_type = 'design_center' then
               '30분째 소식이 없습니다. PC 가 켜져 있는지, 덴플로우 프로그램이 떠 있는지 확인해 주세요'
             when exists (
               select 1 from auto_jobs j
                where j.clinic_org_id = g.clinic_org_id
                  and j.step not in ('done', 'failed')
                  and j.dismissed_at is null
                  and j.failed_at is null
             ) then
               '출력할 것이 걸려 있는데 PC 소식이 없습니다. 치과 PC 가 켜져 있는지 확인해 주세요'
             else
               '오늘 한 번도 켜지지 않았습니다. 쉬는 날이 아니라면 치과 PC 를 확인해 주세요'
           end,
         '/design/devices', jsonb_build_object('deviceId', g.id)
    from gone g
    cross join (select id from organizations where org_type = 'design_center') c;
end;
$$;
