-- =========================================================
-- DS Flow — 치과가 배포된 임플란트 즐겨찾기도 뺄 수 있게
-- 파일 위치: supabase/migrations/<타임스탬프>_clinic_can_remove_pushed_favorite.sql
-- 기준: 사용자 결정 2026-08-11
--
-- 처음에는 디자인센터가 배포한 즐겨찾기(source = 'design_push')를 치과가
-- 뺄 수 없게 막아 뒀습니다. 배포한 쪽 뜻을 지키려던 것인데,
-- 쓰지도 않는 모델이 목록에 계속 남아 자리만 차지합니다.
--
-- ★ 즐겨찾기는 그 치과의 손버릇입니다.
--   무엇을 자주 쓰는지는 쓰는 사람이 압니다. 배포는 '이런 게 있습니다' 라는
--   권유이지 강제가 아닙니다. 치우는 것을 막을 이유가 없습니다.
--
-- ★ 마스터는 그대로입니다.
--   여기서 빼는 것은 그 치과의 즐겨찾기 한 줄뿐입니다.
--   임플란트 마스터(implant_makers 등)는 손대지 않으므로,
--   모델 선택 창에서는 여전히 고를 수 있습니다.
-- =========================================================

drop policy if exists implant_favorite_delete_clinic on clinic_implant_favorites;

create policy implant_favorite_delete_clinic on clinic_implant_favorites
  for delete using (
    clinic_org_id = my_org_id()
    and my_org_type() = 'clinic'
  );
