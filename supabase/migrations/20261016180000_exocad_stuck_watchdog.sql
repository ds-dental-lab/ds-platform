-- =========================================================
-- exocad 요청을 아무도 안 가져가면 센터에 알림 (2026-10-16)
--
-- ★ 왜 — 2026-10-16 설계 PC 의 exocad 지켜보기가 죽어서 메이트 요청 8건을
--   아무도 안 가져갔습니다. 사람은 "exocad 가 안 열린다" 로만 알았고, 원인을
--   찾는 데 한참 걸렸습니다. 결과로 잡습니다: 버튼을 누른 지 **3분** 이 지나도
--   런처가 안 받아 갔으면(fetched_at 없음) 센터에 한 번 알립니다.
-- ★ 받아는 갔는데 실패한 것(status='failed')은 런처가 이미 화면에 띄웁니다 — 여기선 안 봅니다.
-- ★ 하루 넘은 것은 보지 않습니다 — 처음 켤 때 옛 기록으로 알림이 쏟아지지 않게.
-- =========================================================

alter table exocad_exports add column if not exists stuck_alerted_at timestamptz;

create or replace function exocad_stuck_watchdog()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with stuck as (
    update exocad_exports e
       set stuck_alerted_at = now()
     where e.fetched_at is null
       and e.status is null
       and e.stuck_alerted_at is null
       and e.requested_at < now() - interval '3 minutes'
       and e.requested_at > now() - interval '1 day'
    returning e.order_id
  )
  insert into notifications (org_id, channel, status, event_type, title, body, link, payload)
  select distinct on (s.order_id) o.design_org_id, 'in_app', 'sent', 'exocad.stuck',
         'exocad 요청을 아무도 안 가져갔습니다 — ' || o.order_no,
         '3분째 그대로입니다. 설계 PC 가 켜져 있는지, 기기 상태판에서 exocad 지켜보기가 살아 있는지 확인해 주세요',
         '/design/devices', jsonb_build_object('orderId', s.order_id)
    from stuck s join orders o on o.id = s.order_id
   where o.design_org_id is not null;
end;
$$;

revoke all on function exocad_stuck_watchdog() from public, anon, authenticated;

select cron.unschedule('exocad-stuck-watchdog')
 where exists (select 1 from cron.job where jobname = 'exocad-stuck-watchdog');

select cron.schedule('exocad-stuck-watchdog', '* * * * *', $$ select public.exocad_stuck_watchdog() $$);
