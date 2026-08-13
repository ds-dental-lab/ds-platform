-- =========================================================
-- can_access_order 를 마이그레이션으로 끌어들입니다. (2026-08-14)
--
-- ★ 이 함수는 **운영 DB 에만 있었습니다.**
--   두 마이그레이션(20260813170000 저장소, 20260813180000 알림)이
--   이것을 쓰는데, 만드는 마이그레이션이 어디에도 없었습니다.
--   운영에서는 예전에 손으로 만들어 둔 것이 남아 있어 안 터졌습니다.
--
-- ★ 시험 서버를 새로 세우다가 드러났습니다.
--   빈 프로젝트에 66건을 올리니 63번째에서 멈췄습니다 —
--     ERROR: function can_access_order(uuid) does not exist
--   **마이그레이션만으로는 이 시스템을 다시 세울 수 없었다**는 뜻입니다.
--   시험 서버를 나눈 첫 소득이 이것입니다.
--
-- ★ 정의는 지어내지 않고 **운영에 물어서** 맞췄습니다.
--   치과 계정의 진짜 JWT 로 운영의 이 함수를 불러 봤습니다.
--     내 치과 주문   → true
--     남의 치과 주문 → false
--   서명도 확인했습니다 — 인자 이름이 target_order 입니다
--   (형제 함수 can_write_order_file 과 같은 약속).
--
-- ★ 읽기는 **세 자리 모두** 열립니다.
--   기공소는 스캔·디자인 파일로 물건을 만들고, 치과는 자기가 보낸 것과
--   결과를 봅니다. 쓰기만 두 자리로 좁힌 것이 can_write_order_file 이라,
--   둘을 나란히 두면 차이가 한눈에 읽힙니다.
--
-- ★ create or replace 입니다.
--   운영에는 이미 같은 것이 있어 이 마이그레이션이 바꾸는 것은 없습니다.
--   시험·새 환경에서는 이 줄이 함수를 만듭니다.
-- =========================================================

create or replace function can_access_order(target_order uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from orders o
    where o.id = target_order
      and (
        o.clinic_org_id = my_org_id()
        or o.design_org_id = my_org_id()
        or o.lab_org_id = my_org_id()
      )
  );
$$;

comment on function can_access_order(uuid) is
  '이 주문의 세 자리(치과·디자인센터·기공소) 중 하나인가. 읽기 쪽 문지기입니다';
