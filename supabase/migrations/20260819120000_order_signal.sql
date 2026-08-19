-- =========================================================
-- DS Flow — 주문 신호 채널의 문지기
-- 파일 위치: supabase/migrations/20260819120000_order_signal.sql
-- 기준: 사용자 요청 2026-08-19 — 대화창 실시간. 로켓챗 이중화 대신
--       신호 방식 (2026-08-13 에 설계해 둔 그대로)
--
-- ★ 채널에는 내용이 없습니다. 그래도 잠급니다.
--   `order:{uuid}` 채널에 흐르는 것은 "바뀌었다" 뿐이지만, 아무나
--   구독하게 두면 **어느 주문이 언제 움직이는지**가 새어 나갑니다.
--   활동 자체도 정보입니다.
--
-- ★ 권한은 화면 말고 DB 부터 (이 판의 원칙).
--   private 채널은 참여할 때 realtime.messages 의 RLS 를 봅니다.
--   여기서 채널 이름을 쪼개 can_access_order 로 묻습니다 — 주문의
--   세 자리(치과·디자인센터·기공소)가 아니면 **구독 자체가 거절**됩니다.
--   화면(domain/signal)의 UUID 검사와 여기 정규식은 같은 것입니다.
--
-- ★ case 로 순서를 못박습니다.
--   `and` 는 평가 순서를 보장하지 않습니다. 모양 검사보다 uuid 캐스팅이
--   먼저 돌면 이상한 채널 이름 하나에 에러가 납니다. case 는 위에서
--   아래로만 흐릅니다.
-- =========================================================

-- 구독 (받기)
create policy "order_signal_read"
on realtime.messages
for select
to authenticated
using (
  case
    when realtime.messages.extension <> 'broadcast' then false
    when realtime.topic() !~* '^order:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then false
    else public.can_access_order((split_part(realtime.topic(), ':', 2))::uuid)
  end
);

-- 발신 (보내기) — 같은 세 자리만. 서버 액션이 글을 저장한 뒤 쏩니다
create policy "order_signal_write"
on realtime.messages
for insert
to authenticated
with check (
  case
    when realtime.messages.extension <> 'broadcast' then false
    when realtime.topic() !~* '^order:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then false
    else public.can_access_order((split_part(realtime.topic(), ':', 2))::uuid)
  end
);
