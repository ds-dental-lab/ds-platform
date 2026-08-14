-- =========================================================
-- 알림톡 대기열. (사용자 요청 2026-08-14)
--
-- ★ **아직 안 보냅니다.** 사업자등록 · 카카오톡 채널 · 템플릿 사전심사가
--   있어야 나갑니다. 그때까지는 '누구에게 어떤 문구로 갈 뻔했는가' 를
--   줄로 쌓아 두고 화면에서 봅니다. 발송이 붙으면 이 표를 읽어서
--   내보내면 됩니다 — 쌓는 코드는 안 바뀝니다.
--
-- ★ **받을 사람과 번호를 그때 박아 둡니다.**
--   나중에 그 사람이 번호를 바꾸거나 알림톡을 꺼도, 이 줄은 '그때
--   누구에게 갔다' 를 그대로 말해야 합니다. 청구서에 받는 곳을 베껴
--   두는 것과 같은 이유입니다.
--
-- ★ 사람마다 한 줄입니다.
--   한 조직에서 셋이 받으면 세 줄입니다. 발송도 재시도도 사람 단위라,
--   조직 하나에 묶어 두면 '둘은 갔고 하나는 실패' 를 표현할 수 없습니다.
--
-- ★ 넣는 것은 **서버뿐**입니다.
--   insert 정책을 안 만듭니다. 사용자 열쇠로 남의 폰에 알림톡을 꽂는
--   길을 열지 않습니다. 그래서 events 는 **service_role 로 넣습니다**
--   (createAdminClient). 사용자 열쇠로는 한 줄도 못 넣습니다.
-- =========================================================

create type alimtalk_status as enum ('pending', 'sent', 'failed', 'skipped');

create table alimtalk_queue (
  id          uuid primary key default gen_random_uuid(),

  -- 무슨 일로 나가는가 (domain/alimtalk 의 AlimtalkEvent)
  event       text not null,
  order_id    uuid references orders(id) on delete cascade,

  -- 받는 사람. **그때의 값을 박아 둡니다**
  to_user_id  uuid references user_profiles(id) on delete set null,
  to_org_id   uuid references organizations(id) on delete set null,
  phone       text not null,

  -- 보낼 문구. 템플릿이 정해지면 여기에 변수를 담습니다
  title       text not null,
  body        text,

  status      alimtalk_status not null default 'pending',
  error       text,

  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);

create index alimtalk_queue_pending_idx
  on alimtalk_queue (status, created_at)
  where status = 'pending';

create index alimtalk_queue_user_idx on alimtalk_queue (to_user_id, created_at desc);

comment on table alimtalk_queue is
  '알림톡 대기열. 아직 안 보냅니다 — 누구에게 무엇이 갈 뻔했는지 쌓아 둡니다';
comment on column alimtalk_queue.phone is
  '보낼 당시의 번호. 나중에 그 사람이 바꿔도 이 줄은 안 따라갑니다';

alter table alimtalk_queue enable row level security;

-- ---------- 누가 보는가 ----------
--
-- ★ **자기에게 온 것만** 봅니다.
--   남이 무슨 알림톡을 받았는지는 볼 이유가 없습니다. 관리자도 마찬가지
--   입니다 — 필요해지면 그때 따로 엽니다. 처음부터 넓게 열어 두면
--   좁힐 때 이미 그 화면에 기대는 곳이 생깁니다.

create policy alimtalk_select on alimtalk_queue
  for select using (to_user_id = auth.uid());

-- ★ insert·update·delete 정책을 **안 만듭니다.**
--   줄을 넣는 것은 서버(events)뿐이고, 발송 표시는 나중에 붙는 배치가
--   service_role 로 합니다. 사용자 열쇠로는 아무것도 못 씁니다 —
--   남의 폰으로 문자를 보내는 길이 되기 때문입니다.
