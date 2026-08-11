-- =========================================================
-- DS Flow — 기공소는 주문을 지울 수 없습니다
-- 파일 위치: supabase/migrations/<타임스탬프>_lab_cannot_delete_order.sql
-- 기준: 사용자 결정 2026-08-11 — 기공소는 배정받은 파일을 실물로 만들어
--       치과로 보내는 일만 합니다. 남이 낸 주문서를 지울 자리가 아닙니다.
--
-- 무엇이 뚫려 있었나.
--   order_update 정책이 '관련 조직이면 수정 가능' 이라서, 기공소도
--   deleted_at 을 채워 주문을 없앨 수 있었습니다. 서버 액션은 막고 있었지만
--   RLS 는 열려 있었습니다 — 액션을 거치지 않고 바로 치면 통했습니다.
--   실제로 스크립트로 쳐서 1건이 지워지는 것을 확인했습니다(되돌렸습니다).
--
-- ★ 화면과 서버 액션은 UX 이고, 진짜 경계는 RLS 입니다 (설계서 §5.3 결정 2).
--   두 겹 중 아래쪽이 비어 있으면 막았다고 할 수 없습니다.
--
-- ★ using 이 아니라 with check 로 막습니다.
--   기공소는 상태 전이 같은 정상적인 수정을 계속 해야 합니다.
--   '수정한 결과가 삭제된 행이면 거절' 이라, 다른 수정은 그대로 통과합니다.
-- =========================================================

drop policy if exists order_update on orders;

create policy order_update on orders
  for update
  using (
    clinic_org_id = my_org_id()
    or design_org_id = my_org_id()
    or lab_org_id = my_org_id()
  )
  with check (
    (
      clinic_org_id = my_org_id()
      or design_org_id = my_org_id()
      or lab_org_id = my_org_id()
    )
    -- 지우는 것은 치과와 디자인센터만. 기공소가 채운 deleted_at 은 거절됩니다.
    and (
      deleted_at is null
      or my_org_type() in ('clinic', 'design_center')
    )
  );
