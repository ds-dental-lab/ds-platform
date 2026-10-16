-- =========================================================
-- FlowTemp 감시 — 소식이 끊긴 작업을 5분마다 정리합니다 (2026-10-16 점검)
--   사용자 — "오류났을 때 대응방안은 어떤지, 네트워크 연결 쪽으로 문제는 없는지"
-- =========================================================
--
-- ★★ 찾은 구멍 둘.
--   ① 출력 중에 치과 PC·에이전트가 꺼지거나 '다 나왔다' 보고가 끊기면 작업이
--      **'출력 중' 에 영원히** 섭니다. 화면은 계속 퍼센트를 보여 주고 알림도 없습니다.
--   ② 덴트버드에서 내보낸 뒤 STL 이 주문에 안 올라오면 '마무리' 에 영원히 섭니다.
--      서버가 30분 묵은 일감으로 보고 다시 내주면 **덴트버드 건수를 또 씁니다**
--      (이것은 앱에서 막습니다 — canHandDesign).
-- ★ 소식의 기준은 updated_at 입니다. 출력 중에는 치과 PC 가 20초마다 퍼센트를
--   올려 updated_at 이 늘 새것입니다. 30분 조용하면 진짜로 끊긴 것입니다.
-- ★ '실패' 로 돌릴 뿐 지우지 않습니다. 화면에 까닭이 뜨고 「다시 걸기」가 섭니다.
--   프린터는 계속 뽑고 있을 수 있으니 그 말을 함께 적습니다.
-- ★ 표가 바뀌면 auto_jobs_signal 트리거가 주문 화면에 신호를 쏩니다.

create or replace function auto_jobs_watchdog()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- ★ 종 알림도 남깁니다 — 앱의 알림 코드를 안 지나가는 길이라 여기서 (웹푸시는 못 보냄)
  with gone as (
    update auto_jobs
       set failed_at = step,
         step = 'failed',
         failed_reason = '치과 PC 소식이 30분째 없습니다 — 프린터는 계속 뽑고 있을 수 있습니다. '
                         || '프린터와 덴플로우 에이전트를 확인하고 다시 걸어 주세요',
         tries = tries + 1,
         updated_at = now()
     where step in ('sending', 'printing')
       and updated_at < now() - interval '30 minutes'
    returning order_id, clinic_org_id
  )
  insert into notifications (org_id, channel, status, event_type, title, body, link, payload)
  select g.clinic_org_id, 'in_app', 'sent', 'order.auto_print.failed',
         '출력이 멈췄습니다 — 확인해 주세요',
         o.order_no || ' · ' || o.patient_label || ' — 치과 PC 소식이 30분째 없습니다',
         '/clinic/orders/' || g.order_id, jsonb_build_object('orderId', g.order_id)
    from gone g join orders o on o.id = g.order_id;

  with stuck as (
    update auto_jobs
       set design_stage = 'stalled',
         design_note = '내보낸 뒤 30분째 주문에 안 올라왔습니다 — 설계 PC 의 임시치아 지켜보기와 '
                       || '내려받기 폴더를 확인하세요. 다시 걸면 덴트버드 건수를 한 번 더 씁니다',
         updated_at = now()
     where step = 'waiting_design'
       and design_stage = 'exporting'
       and updated_at < now() - interval '30 minutes'
    returning order_id
  )
  insert into notifications (org_id, channel, status, event_type, title, body, link, payload)
  select o.design_org_id, 'in_app', 'sent', 'order.auto_print.design_stalled',
         'FlowTemp 디자인이 멈췄습니다 — ' || o.order_no,
         o.patient_label || ' — 내보낸 뒤 30분째 주문에 안 올라왔습니다',
         '/design/orders/' || s.order_id, jsonb_build_object('orderId', s.order_id)
    from stuck s join orders o on o.id = s.order_id
   where o.design_org_id is not null;
end;
$$;

-- 같은 이름이 있으면 바꿔 끼웁니다
select cron.unschedule('auto-jobs-watchdog')
 where exists (select 1 from cron.job where jobname = 'auto-jobs-watchdog');

select cron.schedule('auto-jobs-watchdog', '*/5 * * * *', $$ select public.auto_jobs_watchdog() $$);
