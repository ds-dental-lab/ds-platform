-- =========================================================
-- 알림톡 요청을 DB 가 대신 보냅니다. (2026-09-08)
--
-- ★ 왜 — 알리고는 부르는 서버의 IP 를 미리 등록해야 하는데("인증되지 않는
--   서버 IP"), 화면 서버(Vercel)는 IP 가 고정이 아닙니다. DB 서버(Supabase)는
--   나가는 IP 가 하나라 그것만 등록하면 됩니다.
-- ★ 열쇠는 DB 에 없습니다. 화면 서버가 열쇠까지 넣어 폼을 만들고, DB 는
--   그걸 알리고에 **그대로 전달**만 합니다 (http 확장, 동기 호출).
-- ★ service_role 만 부릅니다 — 사용자 열쇠로는 못 부릅니다.
-- ★ egress_ip() — 알리고에 등록할 우리 DB 의 IP 를 알아내는 용도.
-- =========================================================

create extension if not exists http with schema extensions;

create or replace function public.alimtalk_relay(form text)
returns jsonb
language plpgsql
security definer
set search_path = extensions, public
as $$
declare
  r extensions.http_response;
begin
  r := extensions.http_post(
    'https://kakaoapi.aligo.in/akv10/alimtalk/send/',
    form,
    'application/x-www-form-urlencoded'
  );
  return jsonb_build_object('status', r.status, 'content', r.content);
end;
$$;

create or replace function public.egress_ip()
returns text
language sql
security definer
set search_path = extensions, public
as $$
  select (extensions.http_get('https://api.ipify.org')).content;
$$;

revoke all on function public.alimtalk_relay(text) from public, anon, authenticated;
revoke all on function public.egress_ip() from public, anon, authenticated;
grant execute on function public.alimtalk_relay(text) to service_role;
grant execute on function public.egress_ip() to service_role;
