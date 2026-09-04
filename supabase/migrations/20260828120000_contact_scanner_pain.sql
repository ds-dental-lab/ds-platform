-- =========================================================
-- 홈페이지 문의에 질문 둘을 더합니다. (사용자 요청 2026-08-28)
--
--   구강스캐너 보유 여부      보유중 · 도입예정 · 미보유
--   현재 기공소 불만족점      비싼 수가 · 긴 납기 · 품질 · 기타 (복수)
--
-- ★ 왜 여기인가. 네이버폼으로 옮기자는 이야기가 있었는데, 그러면
--   문의가 두 군데로 갈립니다. 질문 둘은 지금 폼에 넣으면 되고,
--   문의는 계속 센터 HOME 한 곳에 쌓입니다.
--
-- ★ 스캐너 칸은 **비울 수 있게** 둡니다(nullable). 이미 들어온 문의에는
--   그 값이 없습니다 — not null 로 박으면 옛 줄이 막힙니다.
--   새 문의에서 꼭 받는 것은 앱 규칙(domain/contact)이 합니다.
--
-- ★ 불만족점은 text[] 에 **허용값 검사**를 겁니다. enum 배열보다
--   단순하고, 화면이 보낸 엉뚱한 값은 표가 막습니다.
-- =========================================================

create type contact_scanner as enum ('owned', 'planned', 'none');

alter table contact_requests
  add column scanner     contact_scanner,
  add column pain_points text[] not null default '{}'
    check (pain_points <@ array['price', 'lead_time', 'quality', 'other']::text[]);

comment on column contact_requests.scanner is
  '구강스캐너 보유 여부. 옛 문의는 비어 있습니다';
comment on column contact_requests.pain_points is
  '현재 거래 기공소에 불만족하는 점 (복수). price·lead_time·quality·other';
