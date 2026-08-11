-- =========================================================
-- DS Flow — 기공소가 의뢰 치과를 보게 합니다
-- Sprint 4
-- 파일 위치: supabase/migrations/<타임스탬프>_lab_can_see_clinic.sql
-- 기준: 시스템설계서 §8.4 RLS 정책 원칙
--
-- 왜 여는가.
--   기공소가 완성한 보철을 치과로 직접 배송합니다. 받는 곳의 상호와
--   주소를 모르면 배송이 성립하지 않습니다.
--
-- 어디까지 여는가.
--   "거래 관계"로 열면 기공소가 그 디자인센터의 모든 치과를 보게 됩니다.
--   그래서 관계가 아니라 **주문**을 기준으로 엽니다 —
--   자기에게 배정된 주문의 치과만 보입니다. 배정이 없으면 아무것도 안 보입니다.
-- =========================================================

create or replace function is_clinic_of_my_lab_order(target_org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from orders o
    where o.lab_org_id = my_org_id()
      and o.clinic_org_id = target_org
      and o.deleted_at is null
  );
$$;

comment on function is_clinic_of_my_lab_order is
  '기공소가 배정받은 주문의 의뢰 치과인가. 배송에 필요한 범위만 엽니다';

-- security definer 라 orders 의 RLS 를 지나갑니다.
-- 그래서 함수 본문에서 lab_org_id = my_org_id() 로 스스로를 묶어 둡니다.

drop policy if exists org_select on organizations;

create policy org_select on organizations
  for select using (
    id = my_org_id()
    or is_partner_org(id)
    or is_clinic_of_my_lab_order(id)
  );
