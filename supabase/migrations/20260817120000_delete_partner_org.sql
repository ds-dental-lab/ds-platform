-- =========================================================
-- DS Flow — 거래처 지우기 (디자인센터 사용자탭)
-- 파일 위치: supabase/migrations/20260817120000_delete_partner_org.sql
-- 기준: 사용자 요청 2026-08-17 —
--   "사용자 탭에서 삭제 기능이 있으면 좋겠어, 너무 많은 사용자는 관리하기 힘들어"
--
-- ★ 지금까지 지우는 길을 일부러 두지 않았습니다.
--   거래처를 지우면 그 치과의 지난 주문과 정산이 주인을 잃습니다.
--   그래서 끊을 때는 '거래중지' 였습니다 — 그 규칙은 그대로입니다.
--   여기서 여는 것은 **기록이 없는 줄**을 걷어 내는 길입니다.
--   잘못 등록했거나 연습으로 만든 줄이 쌓이는 문제만 풉니다.
--
-- ★ 막는 것은 둘입니다 — 돈과 기록.
--     ① 살아 있는 주문   지난 기록이 주인을 잃습니다
--     ② 정산 기록        청구서가 어디로 갔는지 알 수 없어집니다
--   막을 때는 '거래중지' 를 알려 줍니다. 길을 안 알려 주고 막으면
--   사용자는 같은 단추를 세 번 더 누릅니다.
--
-- ★ 계정은 **막지 않고 함께 내립니다.**
--   처음에는 계정이 있으면 막게 만들었는데, 그러면 이 기능이 죽습니다 —
--   가입 승인으로 들어온 거래처는 **전부** 신청한 사람의 계정을 갖고
--   있습니다(approve_signup 이 자리를 함께 만듭니다). 운영 DB 를 보니
--   거래처 다섯 곳이 모두 그랬습니다. 하나도 못 지웠을 겁니다.
--   그래서 자리(memberships)를 함께 내립니다 — auth 계정 자체는
--   건드리지 않습니다. 그 사람은 다음 로그인부터 소속 없는 사람이 되어
--   '승인 대기' 화면을 봅니다. 다시 받아 줄 길도 그대로 남습니다.
--   **화면이 지우기 전에 이 사실과 계정 수를 밝힙니다** (p_apply=false).
--
-- ★ 지운 주문(deleted_at)은 안 막습니다.
--   이미 모든 화면에서 사라졌고 파기를 기다리는 줄입니다. 그것 때문에
--   막으면 시험자료를 정리한 거래처는 영원히 못 지웁니다.
--
-- ★ 실제로는 deleted_at 만 채웁니다 (soft delete).
--   되돌릴 길이 남고, 사업자등록번호 유일 인덱스는 deleted_at is null
--   조건이라 같은 번호로 다시 등록할 수 있습니다.
--
-- ★ 거래관계(partnerships)는 남깁니다.
--   RLS 의 org_select 가 is_my_partner_any_status 로 서 있어서,
--   관계를 지우면 그 줄이 **아무에게도 안 보이는** 조직이 됩니다 —
--   되돌릴 수도, 무엇이 있었는지 볼 수도 없습니다.
--
-- ★ 막힌 이유는 예외가 아니라 **돌려주는 값**입니다.
--   같은 함수가 '지우기 전에 물어보는 일' 도 해야 하는데(p_apply=false),
--   예외로 알리면 그 물음이 매번 오류로 보입니다. 권한 문제만 예외입니다 —
--   그건 사용자가 고칠 수 있는 상태가 아닙니다.
-- =========================================================

-- 인자가 하나였던 옛 판을 걷어 냅니다 (같은 이름 둘이 남으면 호출이 모호해집니다)
drop function if exists delete_partner_org(uuid);

create or replace function delete_partner_org(
  p_org_id uuid,
  -- false 면 아무것도 안 고치고 세어서만 돌려줍니다 (지우기 전 물음창)
  p_apply  boolean default true
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_type    org_type;
  v_name    text;
  v_orders  bigint;
  v_periods bigint;
  v_members bigint;
  v_blocked text := null;
begin
  /*
    ★ `<>` 와 `not in` 을 쓰지 않습니다 (20260812201000_null_guard 와 같은 이유).
      소속이 없는 사람은 my_org_type() 이 null 이고, `null <> 'design_center'`
      은 true 가 아니라 **null** 이라 if 를 그냥 지나갑니다.
      실제로 여기서 한 번 그랬습니다 — 로그인 안 한 호출이 이 문을 통과해
      **다음 검사(is_my_partner_any_status)에서야** 멈췄습니다.
      우연히 막힌 것이지 막은 것이 아닙니다.
  */
  if my_org_type() is distinct from 'design_center'
     or coalesce(my_role()::text, '') not in ('owner', 'admin') then
    raise exception '디자인센터 관리자만 거래처를 지울 수 있습니다';
  end if;

  if not is_my_partner_any_status(p_org_id) then
    raise exception '내 거래처가 아닙니다';
  end if;

  select org_type, name into v_type, v_name
    from organizations
   where id = p_org_id and deleted_at is null;

  if v_type is null then
    raise exception '이미 지워진 거래처입니다';
  end if;

  if v_type not in ('clinic', 'lab') then
    raise exception '치과 또는 기공소만 지울 수 있습니다';
  end if;

  -- ① 살아 있는 주문
  select count(*) into v_orders
    from orders
   where deleted_at is null
     and (clinic_org_id = p_org_id or lab_org_id = p_org_id);

  /*
    ② 정산 기록 — **무엇이든 붙어 있는** 기간만 셉니다.

    ★ 기간 줄이 있다는 것만으로 막으면 안 됩니다.
      정산 화면을 열거나 마감을 시도하면 빈 기간 줄이 먼저 섭니다
      (closeBillingPeriod 가 줄을 만들고 나서 금액을 굳힙니다).
      실제로 운영 DB 에는 한 번도 마감된 적 없는 빈 줄이 둘 있었고,
      그것 때문에 청구서가 나간 적도 없는 거래처가 안 지워졌습니다.

    ★ 그래서 마감·발행·청구번호·금액줄·입금·마이너스청구서 중
      하나라도 있으면 막고, 아무것도 없는 빈 줄은 함께 걷어 냅니다.
  */
  select count(*) into v_periods
    from billing_periods p
   where p.party_org_id = p_org_id
     and (p.closed_at is not null
       or p.issued_at is not null
       or p.invoice_no is not null
       or exists (select 1 from billing_lines    l where l.period_id = p.id)
       or exists (select 1 from billing_payments y where y.period_id = p.id)
       or exists (select 1 from credit_notes     c where c.period_id = p.id));

  -- 함께 내려갈 자리
  select count(*) into v_members
    from memberships
   where org_id = p_org_id and deleted_at is null and is_active;

  if v_orders > 0 then
    v_blocked := format(
      '주문 %s건이 이 거래처에 붙어 있어 지울 수 없습니다. 거래만 끊을 때는 ''거래중지'' 로 내려 주세요',
      v_orders);
  elsif v_periods > 0 then
    v_blocked := format(
      '정산 기록이 %s건 있어 지울 수 없습니다. 거래만 끊을 때는 ''거래중지'' 로 내려 주세요',
      v_periods);
  end if;

  if p_apply and v_blocked is null then
    -- 자리를 내립니다. is_active 도 함께 내려야 로그인이 이 조직을 안 집습니다
    -- (getSession 은 is_active 로 소속을 찾습니다)
    update memberships
       set is_active  = false,
           deleted_at = now()
     where org_id = p_org_id and deleted_at is null;

    -- 붙어 있던 개별 단가. 주문도 정산도 없으니 이 값을 쓰는 곳이 없습니다
    delete from clinic_product_prices where clinic_org_id = p_org_id;
    delete from lab_product_costs     where lab_org_id    = p_org_id;

    -- 아무것도 안 붙은 빈 기간 줄. 붙은 것이 있으면 위에서 이미 막혔습니다
    delete from billing_periods where party_org_id = p_org_id;

    update organizations
       set deleted_at = now(),
           status     = 'suspended'
     where id = p_org_id;
  end if;

  return jsonb_build_object(
    'name',    v_name,
    'applied', p_apply and v_blocked is null,
    'blocked', v_blocked,
    'orders',  v_orders,
    'periods', v_periods,
    'members', v_members
  );
end;
$$;

comment on function delete_partner_org is
  '디자인센터가 기록 없는 거래처 줄을 걷어 냅니다. 주문·정산이 있으면 막고, 계정 자리는 함께 내립니다. p_apply=false 면 세어서만 돌려줍니다';

revoke all     on function delete_partner_org(uuid, boolean) from public;
grant  execute on function delete_partner_org(uuid, boolean) to authenticated;
