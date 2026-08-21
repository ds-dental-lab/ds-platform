-- =========================================================
-- DS Flow — 마스터 자료도 로그인해야 봅니다 (보안 점검 2026-08-21)
-- 파일 위치: supabase/migrations/<타임스탬프>_master_needs_login.sql
--
-- ★ 표 52개를 익명으로 두드려 보니 **여섯 개가 열려 있었습니다.**
--     implant_makers · implant_types · implant_sizes · implant_screws
--     production_option_groups · production_option_values
--
--   정책이 `for select using (true)` 라 **로그인 여부를 아예 안 봤습니다.**
--
-- ★ 환자·금액·조직 자료는 아닙니다. 임플란트 제조사 목록과 제작옵션
--   같은 것들입니다. 그래도 아무나 볼 이유가 없습니다 —
--   우리가 어느 브랜드를 다루고 어떤 옵션을 두는지가 그대로 보입니다.
--
-- ★ `to authenticated` 로만 좁힙니다. 섹터로 더 좁히지 않는 이유 —
--   치과는 주문등록에서, 센터는 관리에서, 기공소는 의뢰서에서
--   이 이름들을 씁니다. 셋 다 필요합니다. 익명만 막으면 됩니다.
--
-- ★ 쓰기는 원래부터 디자인센터뿐이었습니다. 그건 안 건드립니다.
-- =========================================================

drop policy if exists implant_maker_select on implant_makers;
drop policy if exists implant_type_select  on implant_types;
drop policy if exists implant_size_select  on implant_sizes;
drop policy if exists implant_screw_select on implant_screws;

create policy implant_maker_select on implant_makers for select to authenticated using (true);
create policy implant_type_select  on implant_types  for select to authenticated using (true);
create policy implant_size_select  on implant_sizes  for select to authenticated using (true);
create policy implant_screw_select on implant_screws for select to authenticated using (true);

drop policy if exists production_option_group_select on production_option_groups;
drop policy if exists production_option_value_select on production_option_values;

create policy production_option_group_select on production_option_groups
  for select to authenticated using (true);

create policy production_option_value_select on production_option_values
  for select to authenticated using (true);
