-- =========================================================
-- 기공소가 치과 판매가(추가 항목 금액)를 읽을 수 있었습니다.
-- (2026-08-13 가격 격리 점검에서 찾음)
--
-- ★ 정책의 뜻과 글이 어긋나 있었습니다.
--   주석은 "디자인센터는 자기 것을, **치과는** 자기에게 적용되는 것을
--   봅니다" 라고 적혀 있는데, 마지막 가지에 조직 종류 검사가 빠졌습니다.
--
--     or (target_clinic_org_id is null and is_partner_org(owner_org_id))
--
--   기공소도 디자인센터의 거래처(design_lab)라 is_partner_org 를
--   통과합니다. 그래서 **기본값 줄**을 그대로 읽었습니다.
--   실제로 확인했습니다 — 기공소 눈으로 1줄이 읽혔습니다.
--
-- ★ surcharge_prices.amount 는 치과에게 받는 돈입니다.
--   기공소는 자기 기공원가(lab_product_costs)만 봅니다. 판매가를 알면
--   중간 마진이 그대로 드러납니다 — 이 프로젝트가 제일 조심하는 자리입니다
--   (설계서 §8.5).
--
-- ★ 같은 표의 옆 정책이 이미 맞게 되어 있었습니다.
--     prosthesis_type_select:
--       owner_org_id = my_org_id()
--       or (my_org_type() = 'clinic' and is_partner_org(owner_org_id))
--   그래서 제품 판매가는 안 샜습니다. 여기만 빠졌습니다.
-- =========================================================

drop policy if exists surcharge_select on surcharge_prices;

create policy surcharge_select on surcharge_prices
  for select using (
    -- 값을 정한 디자인센터
    owner_org_id = my_org_id()
    -- 그 금액이 적용되는 치과 (주문등록에서 추가 과금을 알려 줘야 합니다)
    or (my_org_type() = 'clinic' and target_clinic_org_id = my_org_id())
    -- 치과별 값이 없을 때 쓰는 기본값 — **치과에게만** 보입니다
    or (
      my_org_type() = 'clinic'
      and target_clinic_org_id is null
      and is_partner_org(owner_org_id)
    )
  );
