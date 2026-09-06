-- =========================================================
-- 가입 신청·홈페이지 문의가 들어오면 디자인센터에 알립니다.
-- (사용자 지적 2026-09-05 — "실제로 해보니까 알림이 오는 게 없어")
--
-- ★★ 확인해 보니 **아무것도 안 갔습니다.** 종도 푸시도 메일도 HOME
--   숫자도 없었습니다 — 센터가 '사용자' 탭을 스스로 열어야만 보였습니다.
--   승인이 늦으면 그 치과는 첫 인상에서 기다립니다. 거래 전에 잃습니다.
--
-- ★★ 종(인앱 알림)은 **표 트리거**가 넣습니다. 가입 신청서 자체가
--   auth.users 트리거(handle_new_user)로 만들어져서 앱 코드가 끼어들
--   자리가 없고, 화면이 부르는 방식이면 화면이 죽었을 때 조용히
--   빠집니다. 표에 줄이 생기는 순간 종이 울리는 것이 제일 확실합니다.
--   푸시·메일은 Node 가 해야 해서 서버 코드가 따로 합니다
--   (events/approval-alert) — 그쪽은 못 가도 종은 남습니다.
--
-- ★ notified_at — 푸시·메일을 **한 번만** 보내기 위한 표시.
--   화면이 부르는 액션은 누구나 부를 수 있어서, 이 표시 없이는 같은
--   신청으로 센터 폰을 계속 울릴 수 있습니다.
-- =========================================================

alter table signup_requests
  add column if not exists notified_at timestamptz;

comment on column signup_requests.notified_at is
  '센터에 푸시·메일을 보낸 시각. 한 번만 보내려는 표시입니다';

-- ---------- 디자인센터에 종 하나 넣기 ----------

create or replace function notify_design_center(
  p_event_type text,
  p_title      text,
  p_body       text,
  p_link       text,
  p_payload    jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_org uuid;
begin
  -- 디자인센터는 하나뿐입니다 (통합 모델)
  select id into v_org
  from organizations
  where org_type = 'design_center' and deleted_at is null
  order by created_at
  limit 1;

  if v_org is null then return; end if;

  insert into notifications (org_id, channel, status, event_type, title, body, link, payload)
  values (v_org, 'in_app', 'sent', p_event_type, p_title, p_body, p_link, coalesce(p_payload, '{}'::jsonb));
end;
$$;

-- ★ 앱에서 직접 부를 함수가 아닙니다. 트리거만 씁니다
revoke all on function notify_design_center(text, text, text, text, jsonb) from public, anon, authenticated;

-- ---------- 가입 신청 ----------

create or replace function signup_requests_notify()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status <> 'pending' then return new; end if;

  perform notify_design_center(
    'signup.requested',
    '가입 신청이 들어왔습니다',
    coalesce(new.org_name, '') || ' · ' ||
      case new.org_type when 'clinic' then '치과' when 'lab' then '기공소' else new.org_type::text end,
    '/design/signups',
    jsonb_build_object('requestId', new.id)
  );

  return new;
end;
$$;

drop trigger if exists signup_requests_notify on signup_requests;
create trigger signup_requests_notify
  after insert on signup_requests
  for each row execute function signup_requests_notify();

-- ---------- 홈페이지 문의 ----------

create or replace function contact_requests_notify()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform notify_design_center(
    'contact.requested',
    '수가표 문의가 들어왔습니다',
    new.clinic_name,
    '/design/contacts',
    jsonb_build_object('contactId', new.id)
  );

  return new;
end;
$$;

drop trigger if exists contact_requests_notify on contact_requests;
create trigger contact_requests_notify
  after insert on contact_requests
  for each row execute function contact_requests_notify();
