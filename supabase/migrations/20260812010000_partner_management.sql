-- =========================================================
-- DS Flow — 거래처 관리 (디자인센터 사용자탭)
-- 파일 위치: supabase/migrations/<타임스탬프>_partner_management.sql
-- 기준: 사용자가 준 디자인센터 사용자탭 화면 + 결정 2026-08-11
--
-- 화면이 말하는 것
--   구분(치과/기공소) · 상호 · 대표자명 · 대표 전화번호 ·
--   사업자등록번호 · 주소 · 거래상태
--   그리고 청구서 수령 방식 · 수신 이메일 · 팩스 · 세금계산서 이메일 ·
--   정산 기준일
--
-- ★ 거래상태는 partnerships.status 가 아니라 organizations.status 로 봅니다.
--   partnerships.status 를 내리면 is_partner_org() 가 거짓이 되고,
--   그러면 그 치과의 **지난 주문까지 디자인센터에서 사라집니다**.
--   거래를 끊어도 지난 기록과 정산은 남아야 합니다.
--   그래서 '거래중지' 는 조직 상태로 두고, 관계는 그대로 둡니다.
--
-- ★ 거래처 등록은 정책이 아니라 함수로 엽니다.
--   조직 한 줄과 관계 한 줄이 함께 서야 의미가 있습니다.
--   따로 넣으면 관계 넣기가 실패했을 때 아무에게도 안 보이는
--   조직이 남고, 사업자번호가 겹쳐 다시 등록도 못 하게 됩니다.
-- =========================================================

-- ---------- 청구 정보 ----------

create type invoice_method as enum ('all', 'email', 'fax');

alter table organizations
  add column fax            text,
  add column invoice_method invoice_method not null default 'all',
  add column invoice_email  text,
  add column tax_email      text,
  -- 매달 며칠로 끊어 청구하는가. 화면은 1일 · 26일만 내놓습니다
  add column closing_day    smallint not null default 26
    check (closing_day between 1 and 28);

comment on column organizations.invoice_method is '청구서 수령 방식. all=전체, email=이메일, fax=팩스';
comment on column organizations.closing_day    is '정산 기준일. 치과마다 다를 수 있습니다';

-- ⚠️ 정산 기준일이 조직마다 다른데 billing_periods 는 조직(디자인센터) 단위입니다.
--    치과마다 기준일이 갈리면 기간을 치과별로 끊어야 합니다.
--    지금은 값만 받아 두고, 정산 화면을 만들 때 함께 봅니다.

-- ---------- 한 디자인센터가 기공소 여럿과 거래합니다 ----------
--
-- 옛 인덱스는 (from_org_id, relation) 이 활성 하나뿐이도록 막았습니다.
-- 치과→디자인센터는 그것이 맞습니다 (전속 1:1).
-- 그런데 디자인센터→기공소는 from 이 디자인센터라, 그대로 두면
-- 외주 기공소를 **하나밖에** 못 답니다.
drop index if exists partnerships_one_active_idx;

create unique index partnerships_one_active_idx
  on partnerships (from_org_id, relation)
  where status = 'active' and relation = 'clinic_design';

-- 같은 짝이 두 번 활성으로 서지 않도록
create unique index partnerships_pair_active_idx
  on partnerships (from_org_id, to_org_id, relation)
  where status = 'active';

-- ---------- 거래처를 보고 고치는 범위 ----------
--
-- ★ '거래중지' 로 내린 거래처도 목록에 남아야 합니다.
--   안 그러면 한 번 내린 치과를 다시 열 길이 없습니다.
--   그래서 관계는 상태를 따지지 않고 봅니다.
create or replace function is_my_partner_any_status(target_org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from partnerships p
    where (p.from_org_id = my_org_id() and p.to_org_id   = target_org)
       or (p.to_org_id   = my_org_id() and p.from_org_id = target_org)
  );
$$;

comment on function is_my_partner_any_status is
  '거래가 끊긴 곳도 포함한 내 거래처인가. 사용자탭 목록이 이것으로 섭니다';

drop policy if exists org_select on organizations;

create policy org_select on organizations
  for select using (
    id = my_org_id()
    or is_partner_org(id)
    or is_my_partner_any_status(id)
    or is_clinic_of_my_lab_order(id)
  );

-- ★ 디자인센터가 거래처 정보를 고칩니다.
--   상호·주소·청구 정보를 치과가 스스로 적게 하면 청구서가 틀어집니다.
--   대신 **자기 조직을 남이 고치지는 못합니다** — 아래 두 갈래가 겹치지 않습니다.
drop policy if exists org_update on organizations;

create policy org_update on organizations
  for update
  using (
    (id = my_org_id() and my_role() in ('owner', 'admin'))
    or (my_org_type() = 'design_center' and is_my_partner_any_status(id))
  )
  with check (
    id = my_org_id()
    or (my_org_type() = 'design_center' and is_my_partner_any_status(id))
  );

-- ---------- 거래처 등록 ----------
--
-- 조직과 관계를 한 트랜잭션에서 세웁니다.
-- security definer 라 organizations 에 insert 정책을 열지 않아도 됩니다 —
-- 들어오는 길이 이 함수 하나뿐이라 조건을 여기서만 지키면 됩니다.
create or replace function create_partner_org(
  p_org_type       org_type,
  p_name           text,
  p_ceo_name       text default null,
  p_tel            text default null,
  p_biz_no         text default null,
  p_address        text default null,
  p_invoice_method invoice_method default 'all',
  p_invoice_email  text default null,
  p_fax            text default null,
  p_tax_email      text default null,
  p_closing_day    smallint default 26,
  p_active         boolean default true
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me     uuid := my_org_id();
  v_prefix text;
  v_code   text;
  v_id     uuid;
begin
  if my_org_type() <> 'design_center' then
    raise exception '디자인센터만 거래처를 등록할 수 있습니다';
  end if;

  if p_org_type not in ('clinic', 'lab') then
    raise exception '치과 또는 기공소만 등록할 수 있습니다';
  end if;

  if coalesce(btrim(p_name), '') = '' then
    raise exception '상호를 넣어 주세요';
  end if;

  -- DC-001 / DL-001. 빈 번호를 메우지 않고 늘 뒤에 붙입니다
  v_prefix := case when p_org_type = 'clinic' then 'DC' else 'DL' end;

  select v_prefix || '-' || lpad((count(*) + 1)::text, 3, '0')
    into v_code
    from organizations
   where org_type = p_org_type;

  -- 그래도 겹치면 (지운 조직이 있으면) 뒤로 밀어 봅니다
  while exists (select 1 from organizations where code = v_code) loop
    v_code := v_prefix || '-' || lpad(
      (coalesce(nullif(right(v_code, 3), '')::int, 0) + 1)::text, 3, '0');
  end loop;

  insert into organizations (
    org_type, code, name, ceo_name, tel, biz_no, address,
    status, invoice_method, invoice_email, fax, tax_email, closing_day
  ) values (
    p_org_type, v_code, btrim(p_name), p_ceo_name, p_tel, p_biz_no, p_address,
    case when p_active then 'active' else 'suspended' end::org_status,
    p_invoice_method, p_invoice_email, p_fax, p_tax_email, p_closing_day
  )
  returning id into v_id;

  -- 방향이 갈립니다 — 치과는 디자인센터를 바라보고(전속),
  -- 기공소는 디자인센터가 물량을 나눠 주는 쪽입니다
  if p_org_type = 'clinic' then
    insert into partnerships (from_org_id, to_org_id, relation, status)
      values (v_id, v_me, 'clinic_design', 'active');
  else
    insert into partnerships (from_org_id, to_org_id, relation, status)
      values (v_me, v_id, 'design_lab', 'active');
  end if;

  return v_id;
end;
$$;

comment on function create_partner_org is
  '디자인센터가 거래처(치과·기공소)를 세웁니다. 조직과 거래관계를 함께 만듭니다';

revoke all on function create_partner_org(
  org_type, text, text, text, text, text,
  invoice_method, text, text, text, smallint, boolean
) from public;

grant execute on function create_partner_org(
  org_type, text, text, text, text, text,
  invoice_method, text, text, text, smallint, boolean
) to authenticated;

-- ---------- 기공원가도 '안 정함' 을 담을 수 있어야 합니다 ----------
--
-- lab_cost 가 not null default 0 이었습니다. 그러면 값을 안 정한 것과
-- 0원(무료)이 같아집니다. 치과 단가(clinic_product_prices)는 이미
-- 비울 수 있는데 기공원가만 못 비우면 화면이 두 갈래가 됩니다.
--
-- 화면에서 칸을 비우면 줄을 통째로 지워 기본가로 돌아갑니다.
-- 0 을 넣으면 줄이 남습니다 — 둘은 다릅니다.
alter table lab_product_costs
  alter column lab_cost drop default,
  alter column lab_cost drop not null;

comment on column lab_product_costs.lab_cost is
  '기공원가. 비어 있으면 아직 안 정한 것, 0 은 무료';
