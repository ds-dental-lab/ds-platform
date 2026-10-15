-- =========================================================
-- FlowTemp — 자동 템포러리의 새 이름, 그리고 디자인 파일은 디자인 상태에서만
-- (사용자 요청 2026-10-15)
-- =========================================================

-- ---------- ① 이름: 자동 템포러리 → FlowTemp ----------
--
-- ★ **코드는 그대로** 둡니다 (auto_temp / pmma). 코드는 바꾸지 않는 규칙이고,
--   지난 주문 다섯 건의 품목이 그 코드를 가리킵니다.
-- ★ 약칭도 'FlowTemp' 하나로 — abbr_material_only 를 켜서 목록에
--   'Pmma-ATemp' 같은 조합이 아니라 'FlowTemp' 만 찍히게 합니다.
update prosthesis_types
   set name = 'FlowTemp',
       abbr = 'FlowTemp',
       abbr_material_only = true
 where code = 'auto_temp';

-- ---------- ② 재료: 고르는 단계 없이, 쉐이드 없이 ----------
--
-- ★ 재료 줄은 **지우지 않습니다.** 가격·쉐이드 여부·개수 셈이 재료에 붙어 있고,
--   지난 주문들이 이 재료를 가리킵니다. 대신 이름을 제품과 같게 하고
--   (화면은 재료가 하나뿐이면 고르는 줄을 안 보여 줍니다), 쉐이드를 끕니다.
-- ★ 'PMMA' 는 틀린 이름이었습니다 — 실제로는 PLA 로 뽑습니다.
-- ★ 쉐이드를 끄는 이유: 한 가지 색 PLA 로 뽑는 임시치아라 고를 색이 없습니다.
--   끄면 주문서가 쉐이드를 묻지 않고, 저장할 때도 요구하지 않습니다(requiresShade).
update prosthesis_materials m
   set name = 'FlowTemp',
       abbr = 'FlowTemp',
       has_shade = false
  from prosthesis_types t
 where m.type_id = t.id
   and t.code = 'auto_temp'
   and m.code = 'pmma';

-- ---------- ③ 디자인 파일은 '디자인' 상태에서만 ----------
--
-- ★★ 전에는 상태를 안 봤습니다. 화면(canUploadDesignFile)이 접수·디자인에서
--   단추를 보여 줬을 뿐, 업로드는 브라우저에서 곧장 들어오므로 DB 는 어느
--   상태에서든 받았습니다. 이제 **디자인 상태**에서만입니다 — 접수는 아직
--   아무도 잡지 않은 주문이라, 파일부터 얹히면 '접수인데 디자인이 붙은'
--   주문이 됩니다.
-- ★ 자리(담당 디자이너) 규칙은 그대로입니다 (20260812190000_order_designer).
-- ★ 자동 출력이 올리는 디자인 STL(deliver)은 서버 열쇠로 들어가므로 이
--   정책을 거치지 않습니다 — FlowTemp 주문 상태와 상관없이 돕니다.
drop policy if exists order_file_insert on order_files;

create policy order_file_insert on order_files
  for insert with check (
    exists (
      select 1 from orders o
      where o.id = order_files.order_id
        and (
          order_files.kind <> 'design'
          or (
            o.status = 'designing'
            and (
              my_org_type() <> 'design_center'
              or o.designer_user_id is null
              or o.designer_user_id = auth.uid()
              or my_role() in ('owner', 'admin')
            )
          )
        )
    )
  );
