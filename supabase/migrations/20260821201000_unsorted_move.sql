-- =========================================================
-- DS Flow — 미분류 사진을 주문으로 **옮길** 수 있게
-- 파일 위치: supabase/migrations/<타임스탬프>_unsorted_move.sql
--
-- ★★ 앞 마이그레이션에서 읽기·쓰기·지우기만 열었습니다. 그런데
--   Supabase 의 `move` 는 복사+삭제가 아니라 **이름 바꾸기(update)**
--   입니다. update 문이 없으니 옮길 줄을 못 찾고
--   `NoSuchKey / Object not found` 로 떨어졌습니다.
--   진짜 계정으로 옮겨 보고서야 알았습니다 — 정책을 읽어서는
--   안 보이는 종류입니다.
--
-- ★ 옮기는 것은 한 문장에 두 자리를 겁니다.
--     떠나는 자리(unsorted/…)   → 여기 policy 의 using
--     닿는 자리(orders/{주문}/…) → 기존 'order files replace' 의 using
--   둘 다 통과해야 옮겨집니다. 그래서 이 정책은 **떠나는 자리만**
--   보면 됩니다.
--
-- ★ 미분류 안에서 옮기는 것도 같은 정책으로 됩니다(using 이 with check
--   을 겸합니다). 그건 자기 치과 폴더 안이라 문제가 없습니다.
-- =========================================================

create policy "unsorted photos move" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'order-files'
    and (storage.foldername(name))[1] = 'unsorted'
    and (storage.foldername(name))[2] = my_org_id()::text
    and my_org_type() = 'clinic'
  );
