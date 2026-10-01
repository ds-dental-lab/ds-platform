-- =========================================================
-- 요청시한이 되면 스스로 '완료' (사용자 요청 2026-10-01 —
-- "제작 단계에서 배송 버튼 안 눌러도 디데이 되면 완료로").
--
-- ★ **아침 9시(KST) = 00:00 UTC** 에 돕니다. 그 시각이어야 저장되는 배송 시각의
--   UTC 날짜가 한국 날짜와 같습니다. 자정(00:00 KST = 15:00 UTC 전날)에 돌리면
--   한국 11/1 건이 10월 정산에 끼어듭니다 (domain/auto-complete 설명).
-- ★ 완료로 넘기면서 **배송 시각이 비어 있으면 그때 채웁니다** — 정산은 상태가 아니라
--   shipped_at 으로 달을 가릅니다. 안 채우면 청구가 영영 안 됩니다.
-- =========================================================

do $$
begin
  if exists (select 1 from cron.job where jobname = 'auto-complete') then
    perform cron.unschedule('auto-complete');
  end if;
end
$$;

select cron.schedule(
  'auto-complete',
  '0 0 * * *',
  $$
    select net.http_post(
      url := 'https://denflow.kr/api/jobs/auto-complete',
      headers := '{"x-denflow-job":"lYyL2VhWWr1tmKLOjr0IcIGK_g2AnUDm","content-type":"application/json"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  $$
);
