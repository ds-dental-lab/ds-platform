-- =========================================================
-- 알리고 조회 중계 (2026-09-14)
-- 가입 알림톡이 카톡과 문자로 둘 다 왔다는 제보 — 알리고 전송 결과(카톡 성공/실패·대체문자)와
-- 등록 템플릿 본문을 보려면 등록 IP(DB)에서 불러야 합니다.
-- ★ 조회 주소 셋만 허용 (보내기는 기존 alimtalk_relay). service_role 전용.
-- =========================================================
create or replace function public.alimtalk_lookup(path text, form text)
returns jsonb
language plpgsql
security definer
set search_path = extensions, public
as $$
declare
  r extensions.http_response;
begin
  if path not in ('history/list', 'history/detail', 'template/list') then
    raise exception '허용하지 않는 조회입니다: %', path;
  end if;
  r := extensions.http_post('https://kakaoapi.aligo.in/akv10/' || path || '/', form, 'application/x-www-form-urlencoded');
  return jsonb_build_object('status', r.status, 'content', r.content);
end;
$$;
revoke all on function public.alimtalk_lookup(text, text) from public, anon, authenticated;
grant execute on function public.alimtalk_lookup(text, text) to service_role;
