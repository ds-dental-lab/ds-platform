-- =========================================================
-- FlowTemp 진행을 치과가 새로고침 없이 봅니다 (사용자 요청 2026-10-15)
--   "치과입장에서 플로우템프 진행과정을 보기 어렵네 — 디자인중인지 아닌지
--    새로고침을 해야 보이고"
-- =========================================================

-- ---------- ① 디자인 단계도 적습니다 ----------
--
-- ★ 전에는 STL 이 올라올 때에야 작업 줄이 생겨서, 덴트버드가 7분 동안
--   설계하는 사이 치과 화면에 **보여 줄 것이 아예 없었습니다.** 이제
--   주문을 넣을 때 줄을 열고(waiting_design), 매크로가 단계를 넘을 때마다
--   여기에 적습니다.
-- ★ 단계를 늘리지 않고 칸 하나로 둡니다. 'waiting_design' 안의 잔걸음이라
--   되돌리기·다시 걸기 규칙(RETRY_FROM)을 건드릴 일이 없습니다.
-- ★ design_note 는 **센터가 읽는 까닭**입니다. 치과 화면에는 안 그립니다.
alter table auto_jobs
  add column if not exists design_stage text,
  add column if not exists design_note text;

alter table auto_jobs drop constraint if exists auto_jobs_design_stage_check;
alter table auto_jobs
  add constraint auto_jobs_design_stage_check
  check (design_stage is null or design_stage in
    ('uploading', 'analyzing', 'generating', 'exporting', 'stalled'));

comment on column auto_jobs.design_stage is
  '디자인 잔걸음 — uploading·analyzing·generating·exporting·stalled. 매크로가 적는다 (2026-10-15)';
comment on column auto_jobs.design_note is
  '디자인이 멈춘 까닭. 센터 화면에만 (2026-10-15)';

-- ---------- ② 바뀌면 주문 화면에 신호 ----------
--
-- ★★ 화면이 안 따라온 까닭이 둘이었습니다.
--   - 주문 화면의 신호(order:{id})는 **대화 글을 쓸 때만** 나갔습니다.
--   - 20초 폴링(pulse)은 `orders` 만 봤습니다. 출력 진행은 `auto_jobs` 만
--     바꾸므로 폴링도 몰랐습니다. (그쪽은 앱에서 고칩니다)
-- ★ 바꾸는 쪽이 넷입니다 — 설계 PC·치과 PC·서버·사람. 앱 코드 곳곳에서
--   신호를 쏘면 하나는 꼭 빠뜨립니다. **표가 바뀌면 표가 쏩니다.**
-- ★ 내용은 안 싣습니다 (domain/signal 의 약속) — 주문 id 뿐입니다.
--   받는 쪽이 평소 길(서버 → RLS)로 다시 읽습니다.
-- ★ 퍼센트는 10 단위를 넘을 때만 쏩니다. 출력 중 몇 초마다 오르는 숫자에
--   다 쏘면 열어 둔 화면이 쉴 새 없이 다시 그립니다.
-- ★ 신호가 못 가도 업무는 그대로입니다 (예외를 삼킵니다). 폴링이 받쳐 줍니다.
create or replace function auto_jobs_signal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.step is not distinct from old.step
     and new.bed_cleared_at is not distinct from old.bed_cleared_at
     and new.design_stage is not distinct from old.design_stage
     and new.failed_reason is not distinct from old.failed_reason
     and floor(coalesce(new.percent, 0) / 10) = floor(coalesce(old.percent, 0) / 10)
  then
    return new;
  end if;

  begin
    perform realtime.send(
      jsonb_build_object('orderId', new.order_id),
      'changed',
      'order:' || new.order_id::text,
      true
    );
  exception when others then
    -- 신호는 빠른 길일 뿐입니다
    null;
  end;

  return new;
end;
$$;

drop trigger if exists auto_jobs_signal on auto_jobs;
create trigger auto_jobs_signal
  after insert or update on auto_jobs
  for each row execute function auto_jobs_signal();
