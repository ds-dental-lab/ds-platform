-- =========================================================
-- 디자인센터가 '치과가 담음' 항목도 정리할 수 있게 합니다.
-- (사용자 요청 2026-08-13 — "'치과가 담음'도 수정/삭제 권한이 있었으면")
--
-- ★ 전에는 배포한 것만 뺄 수 있었습니다.
--     implant_favorite_delete_design:
--       ... and source = 'design_push'
--   그래서 치과가 스스로 담은 조합은 화면에 버튼조차 없었습니다.
--
-- ★ 왜 열어 주는가.
--   임플란트 마스터를 쥔 쪽은 디자인센터입니다. 치과가 단종된 픽스처나
--   잘못된 조합을 담아 두면, 그 조합으로 주문이 들어오고 결국 전화가
--   오는 곳도 디자인센터입니다. 정리할 수 있어야 합니다.
--
-- ★ 남의 치과 것은 여전히 못 만집니다.
--   is_partner_org(clinic_org_id) 는 그대로 둡니다 — 거래 중인 치과의
--   목록만입니다.
--
-- ★ 치과 쪽 정책은 안 건드립니다.
--   치과는 여전히 **배포받은 항목을 뺄 수 없습니다** (강제 배포,
--   설계서 §8.3). 그 조건은 implant_favorite_delete_clinic 이 아니라
--   그쪽에 source 조건이 없어서가 아니라… 확인해 보면
--   delete_clinic 은 `clinic_org_id = my_org_id()` 뿐입니다.
--   즉 치과는 자기 목록의 무엇이든 뺄 수 있습니다 — 배포된 것까지.
--   ★ 이건 설계와 다릅니다. 아래에서 함께 바로잡습니다.
-- =========================================================

-- ---------- 디자인센터 — 그 치과 목록 전부 ----------

drop policy if exists implant_favorite_delete_design on clinic_implant_favorites;

create policy implant_favorite_delete_design on clinic_implant_favorites
  for delete using (
    my_org_type() = 'design_center'
    and is_partner_org(clinic_org_id)
  );

-- ---------- 치과 — 자기가 담은 것만 ----------
--
-- ★ 배포는 "치과가 임의로 뺄 수 없다" 가 원래 약속입니다
--   (화면에도 그렇게 적혀 있습니다 — "배포한 항목은 치과가 임의로 뺄 수
--   없고, 회수는 여기서만 됩니다"). 그런데 정책에는 그 조건이 없어서
--   치과가 곧장 지우면 지워졌습니다. 화면에만 버튼이 없었을 뿐입니다.
--   글과 코드를 맞춥니다.

drop policy if exists implant_favorite_delete_clinic on clinic_implant_favorites;

create policy implant_favorite_delete_clinic on clinic_implant_favorites
  for delete using (
    clinic_org_id = my_org_id()
    and my_org_type() = 'clinic'
    and source = 'clinic'
  );
