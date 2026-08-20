-- =========================================================
-- DS Flow — 올린 파일에 '다 올렸다' 를 적을 수 있게
-- 파일 위치: supabase/migrations/<타임스탬프>_mark_file_status.sql
-- 기준: 사용자 신고 2026-08-21 — "주문수정했는데 파일 안 올라가네"
--
-- ★★ **파일은 올라가 있었습니다.**
--   저장소를 열어 보니 네 개 다 있었고 크기까지 표와 같았습니다.
--   못 올린 것이 아니라 **'다 올렸다' 를 적는 데서 막힌 것**입니다.
--
-- 무엇이 어긋났나.
--   order_files 의 update 정책이 상태를 '접수·재스캔·디자인' 으로
--   묶어 두었습니다. 그런데 **디자인센터는 단계를 안 가리고** 수정할
--   수 있습니다 (사용자 결정 2026-08-12). 그래서 배송 상태의 주문에
--   파일을 더 올리면 —
--
--     줄 만들기(insert)   통과   ← 상태를 안 봅니다
--     저장소에 올리기      통과   ← can_write_order_file, 상태를 안 봅니다
--     'uploaded' 로 적기   막힘   ← 여기만 상태를 봅니다
--
--   문 셋 중 하나만 다른 규칙을 들고 있었습니다.
--
-- ★★ 더 나빴던 것 — **아무도 몰랐습니다.**
--   RLS 가 막으면 오류가 아니라 **0줄 고침**입니다. supabase-js 는
--   그것을 성공으로 돌려줍니다. 화면은 "다 올렸습니다" 라고 하고,
--   표에는 pending 이 남고, 주문상세는 빨간 띠로 "안 올라감" 이라고
--   말합니다. 셋이 서로 다른 말을 했습니다.
--
-- 어떻게 고치나.
--   상태 칸을 바꾸는 일만 하는 함수를 따로 둡니다. 올릴 수 있었으면
--   적을 수도 있어야 하니, **올리기와 같은 문지기**(can_write_order_file)를
--   씁니다. 대신 할 수 있는 일을 좁게 묶습니다 —
--     · upload_status 말고는 아무것도 못 고칩니다
--     · 'uploaded' 와 'failed' 로만 갑니다
--     · 아직 pending 인 줄만 — 다 올라간 남의 파일을 실패로 못 만듭니다
--
--   ★ 그리고 막히면 **소리를 냅니다.** 0줄이 조용히 지나가는 길을
--     없애는 것이 이 함수의 절반입니다.
--
-- ★ 일반 update 정책은 그대로 둡니다. 이름을 고치거나 하는 일은
--   여전히 파일을 만질 수 있는 구간에서만입니다.
--
-- ★★ **이 파일에는 흠이 있습니다.** upload_status 가 열거형인데 글자를
--   그대로 넣어 42804 로 거절당했습니다. 바로 다음 마이그레이션
--   (_mark_file_status_cast) 이 고칩니다. 이미 운영에 돌아간 파일이라
--   몰래 고치지 않고 그대로 둡니다 — 무엇이 돌았는지가 남아야 합니다.
-- =========================================================

create or replace function mark_order_file_status(p_file_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order uuid;
  v_now   text;
begin
  if p_status not in ('uploaded', 'failed') then
    raise exception '올린 결과는 uploaded 나 failed 만 적을 수 있습니다';
  end if;

  select order_id, upload_status into v_order, v_now
  from order_files
  where id = p_file_id and deleted_at is null;

  if v_order is null then
    raise exception '그 파일 줄을 찾을 수 없습니다';
  end if;

  -- ★ 올리는 중이던 줄만입니다
  if v_now <> 'pending' then
    raise exception '이미 % 로 적힌 줄입니다', v_now;
  end if;

  -- ★ 올릴 수 있는 자리인가 — 저장소 정책과 **같은** 물음입니다
  if not can_write_order_file(v_order) then
    raise exception '이 주문에 파일을 올릴 수 있는 자리가 아닙니다';
  end if;

  update order_files set upload_status = p_status where id = p_file_id;
end;
$$;

comment on function mark_order_file_status(uuid, text) is
  '올린 파일에 결과만 적습니다. 올리기와 같은 문지기를 씁니다 (2026-08-21)';

revoke execute on function mark_order_file_status(uuid, text) from public, anon;
grant execute on function mark_order_file_status(uuid, text) to authenticated, service_role;
