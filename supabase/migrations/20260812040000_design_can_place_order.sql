-- =========================================================
-- DS Flow — 디자인센터가 치과를 대신해 주문을 넣습니다 (대리등록)
-- 파일 위치: supabase/migrations/<타임스탬프>_design_can_place_order.sql
-- 기준: 사용자 결정 2026-08-12 — "주문대행이 많아서"
--
-- 왜 여는가.
--   전화·팩스로 들어오는 주문을 디자인센터가 대신 넣습니다.
--   지금은 order_insert 가 치과 계정만 허용해 그 길이 막혀 있었습니다.
--
-- 어디까지 여는가.
--   **자기 거래처 치과** 것만입니다. 남의 디자인센터 치과에는 못 넣습니다.
--   그리고 design_org_id 는 자기 자신이어야 합니다 —
--   안 그러면 주문을 만들어 남의 디자인센터에 떠넘길 수 있습니다.
--
-- ★ 정산은 저절로 맞습니다.
--   대리로 넣어도 clinic_org_id 가 그 치과라, 정산 조회가 그 치과의
--   기간에서 이 주문을 집어 갑니다. 따로 이어 붙일 것이 없습니다.
--
-- ★ 거래중지 치과에는 아무도 새 주문을 못 넣습니다.
--   치과 자신도 마찬가지입니다. '거래중지' 가 새 주문만 막는다는
--   뜻이라면 그 막는 자리가 여기입니다.
--   지난 주문의 수정·상태 변경은 그대로 됩니다 (order_update 는 안 건드립니다).
-- =========================================================

create or replace function is_active_org(target_org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organizations
    where id = target_org and status = 'active' and deleted_at is null
  );
$$;

comment on function is_active_org is
  '거래중인 조직인가. 거래중지된 치과에는 새 주문을 넣지 않습니다';

drop policy if exists order_insert on orders;

create policy order_insert on orders
  for insert with check (
    is_active_org(clinic_org_id)
    and (
      -- 치과가 자기 주문을 넣는 경우
      (clinic_org_id = my_org_id() and my_org_type() = 'clinic')

      -- 디자인센터가 거래처 치과를 대신해 넣는 경우 (대리등록)
      or (
        my_org_type() = 'design_center'
        and design_org_id = my_org_id()
        and is_partner_org(clinic_org_id)
      )
    )
  );

-- ---------- 대리등록에 딸려 오는 것들 ----------

-- ★ 환자는 그 치과 것만 붙일 수 있어야 합니다.
--   patient_select 는 디자인센터에게 **모든 거래처 치과**의 환자를 엽니다.
--   대리등록 화면에서 이름을 치면 남의 치과 환자가 후보로 뜹니다.
--   화면에서 치과로 좁히지만, 서버(order 서비스)에서도 한 번 더 봅니다.
--   여기서는 정책을 좁히지 않습니다 — 디자인센터가 주문 상세에서
--   여러 치과의 환자를 읽어야 하기 때문입니다.

-- 제작옵션 즐겨찾기는 치과의 것을 씁니다.
-- 대리로 넣어도 그 치과 원장의 즐겨찾기가 나와야 맞습니다.
do $$
begin
  if exists (
    select 1 from pg_policies
    where tablename = 'clinic_option_presets' and policyname = 'option_preset_select'
  ) then
    drop policy option_preset_select on clinic_option_presets;
  end if;
end $$;

create policy option_preset_select on clinic_option_presets
  for select using (
    clinic_org_id = my_org_id()
    or (my_org_type() = 'design_center' and is_partner_org(clinic_org_id))
  );
