-- =========================================================
-- DS Flow — 웹푸시 구독
-- 파일 위치: supabase/migrations/20260819130000_push_subscriptions.sql
-- 기준: 사용자 요청 2026-08-19 — "디자인 계정이 다른 일을 하고 있을 때에
--       대화가 온지 안 온지 확인할 수 없어"
--
-- ★ 구독은 계정이 아니라 **그 브라우저**의 것입니다.
--   같은 사람이 사무실 PC 와 집 노트북에서 따로 켤 수 있습니다.
--   그래서 endpoint(브라우저가 발급한 주소)가 고유키입니다.
--
-- ★ org_id 를 함께 박아 둡니다.
--   발송할 때 "이 조직 사람들의 브라우저 전부" 로 찾습니다.
--   매번 memberships 를 조인하면 탈퇴한 사람에게도 가는 틈이 생기는데,
--   여기서는 반대로 org_id 가 굳어 있어 조직을 옮기면 옛 조직 걸로
--   남습니다 — 그래서 계정을 내리면 cascade 로 구독도 같이 지워집니다.
--
-- ★ 읽고 쓰는 것은 자기 것뿐입니다.
--   발송(남의 구독 읽기)은 서버의 service_role 만 합니다. 화면 쪽
--   코드는 자기 브라우저의 구독만 넣고 뺍니다.
-- =========================================================

create table push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references user_profiles(id) on delete cascade,
  org_id      uuid not null references organizations(id) on delete cascade,

  -- 브라우저(푸시 서비스)가 발급한 주소와 암호화 재료
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,

  user_agent  text,
  created_at  timestamptz not null default now()
);

comment on table push_subscriptions is
  '웹푸시 구독. 브라우저 단위 — 같은 사람이 자리마다 따로 켭니다';

alter table push_subscriptions enable row level security;

-- 자기 것만. 발송은 service_role 이 RLS 를 지나지 않고 읽습니다
create policy push_sub_own
on push_subscriptions
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
