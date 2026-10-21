-- =========================================================
-- FlowTemp — 멈춤을 센터 손 없이 기계가 처리합니다 (사용자 결정 2026-10-21).
--
-- ★★ "센터에서 손이 안 갔으면 해". FlowTemp 는 되면 좋은 덤 — 안 되면 치과가
--   평소대로 임시치아를 만들고, 크라운 주문은 그대로 갑니다. 그래서
--     · 일시적 멈춤은 스스로 한 번 더 (design_tries)
--     · 스캔 문제는 치과가 다시 올리면 저절로 이어짐 (design_wait = 'scan' + 트리거)
--     · 못 하는 건은 접음 (design_stage = 'ended')
--   규칙은 domain/auto-print 의 stallKind · designVerdict · canHandDesign 에 있습니다.
-- =========================================================

alter table auto_jobs
  add column if not exists design_tries int not null default 0,
  add column if not exists design_wait text;

comment on column auto_jobs.design_tries is '스스로 다시 건 횟수 (일시적 멈춤만, 2026-10-21)';
comment on column auto_jobs.design_wait is '무엇을 기다리는가 — ''scan'' 이면 치과가 스캔을 다시 올리면 다시 엽니다 (2026-10-21)';

-- 잔걸음에 '접음'(ended) 을 더합니다 — 20261015120000 의 check 를 다시 겁니다
alter table auto_jobs drop constraint if exists auto_jobs_design_stage_check;
alter table auto_jobs
  add constraint auto_jobs_design_stage_check
  check (design_stage is null or design_stage in
    ('uploading', 'analyzing', 'generating', 'exporting', 'stalled', 'ended'));

alter table auto_jobs drop constraint if exists auto_jobs_design_wait_check;
alter table auto_jobs
  add constraint auto_jobs_design_wait_check
  check (design_wait is null or design_wait in ('scan'));

-- ★ 스캔을 다시 올리면 멈춘 디자인을 다시 엽니다.
--   서버 코드 어디서 올라오든(치과 화면·스캐너 에이전트·재스캔) 표 하나로 잡습니다.
create or replace function auto_jobs_scan_resume()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'scan' and new.upload_status = 'uploaded' and new.deleted_at is null then
    update auto_jobs
       set design_stage = null,
           design_note = null,
           design_wait = null,
           updated_at = now()
     where order_id = new.order_id
       and step = 'waiting_design'
       and design_stage = 'stalled'
       and design_wait = 'scan';
  end if;
  return new;
end;
$$;

drop trigger if exists auto_jobs_scan_resume on order_files;
create trigger auto_jobs_scan_resume
  after insert or update of upload_status on order_files
  for each row execute function auto_jobs_scan_resume();
