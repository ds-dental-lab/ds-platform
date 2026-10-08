-- =========================================================
-- DS Flow — 단가에 **적용 시작일**을 붙입니다
-- 파일 위치: supabase/migrations/20261008120000_price_history.sql
-- 기준: 사용자 결정 2026-10-08 — "앞으로는 수가가 바뀐 이후에 적용이 되는게 맞다"
--
-- ★★ 지금까지의 문제 —
--   정산은 볼 때마다 단가표를 **다시 읽었습니다.** 그래서 10월 8일에 값을
--   올리면 10월 1일에 **이미 배송된 건까지** 그 값으로 바뀌었습니다.
--   마감한 달만 안전했습니다(billing_lines 에 굳어 있어서).
--   메이트 치과에서 실제로 그 일이 났습니다(임플란트 1 → 2).
--
--   이용약관에도 *"바뀌더라도 이미 등록된 주문에는 소급하여 적용하지
--   않습니다"* 라고 적어 두었는데, 코드가 그 약속을 안 지키고 있었습니다.
--
-- ★ 고치는 방법 — 값이 바뀐 **날**을 같이 남깁니다.
--   정산은 그 건의 **배송일**에 유효했던 값을 고릅니다.
--
-- ★ 지금 표(clinic_product_prices · lab_product_costs)는 그대로 둡니다.
--   그것이 '지금 단가' 입니다 — 단가 화면이 고치고, 앞으로 나갈 건에
--   쓰입니다. 여기 표는 **지나간 값**을 기억하는 자리입니다.
--   표를 갈아치우면 화면·저장·정산을 한꺼번에 건드려야 하는데,
--   그 셋 중 하나만 어긋나도 돈이 틀립니다.
--
-- ★ 줄을 남기는 일은 **트리거**가 합니다. 코드가 아니라요.
--   단가가 바뀌는 길이 셋입니다 — 단가 화면, 가입 승인 때 깔아 주는
--   기본값, 그리고 사람이 직접 고치는 SQL. 코드에 넣으면 셋 중
--   하나를 빼먹습니다.
-- =========================================================

-- ---------- 지나간 단가 ----------
--
-- ★ 치과 판매가와 기공원가를 **한 표에** 담습니다.
--   둘은 칸 이름만 다르고(price/lab_cost) 규칙이 똑같습니다.
--   표를 둘로 나누면 고르는 함수도 둘이 되고, 한쪽만 고치는 일이 생깁니다.
--
-- ★ 값이 비어 있음(null)은 '그 날부터 덮어쓰기를 지웠다' 입니다.
--   치과는 제품 기본가로 돌아가고, 기공소는 '미정'이 됩니다 —
--   살아 있는 표에서 줄을 지웠을 때와 똑같이 풀립니다.
create table product_price_history (
  id             uuid primary key default gen_random_uuid(),
  owner_org_id   uuid not null references organizations(id) on delete cascade,

  -- 누구의 단가인가. 치과면 판매가, 기공소면 기공원가
  party_org_id   uuid not null references organizations(id) on delete cascade,
  party_type     text not null check (party_type in ('clinic', 'lab')),

  material_id    uuid not null references prosthesis_materials(id) on delete cascade,

  -- ★ 이 날 **배송된 건부터** 이 값입니다 (그 날 포함)
  effective_from date not null,

  price          integer check (price >= 0),
  pontic_price   integer check (pontic_price >= 0),
  pink_price     integer check (pink_price >= 0),

  recorded_at    timestamptz not null default now()
);

comment on table product_price_history is
  '지나간 단가. 정산은 그 건의 배송일에 유효했던 줄을 고릅니다 (2026-10-08)';
comment on column product_price_history.effective_from is
  '이 날 배송된 건부터 이 값입니다. 하루에 두 번 고치면 마지막 값만 남습니다';
comment on column product_price_history.price is
  '비어 있으면 그 날부터 덮어쓰기가 없습니다 — 치과는 제품 기본가, 기공소는 미정';

-- ★ 하루에 한 줄입니다. 같은 날 두 번 고치면 **마지막 값**으로 덮습니다.
--   한 날짜에 두 줄이 서면 어느 쪽이 유효한지 정할 수 없습니다.
create unique index product_price_history_idx
  on product_price_history (party_org_id, material_id, effective_from);

-- 고르는 쪽은 "배송일 이하에서 가장 늦은 줄" 을 찾습니다
create index product_price_history_lookup_idx
  on product_price_history (party_org_id, material_id, effective_from desc);

-- ---------- 접근 정책 ----------
--
-- ★ 가격 격리를 그대로 지킵니다 (설계서 §8.5).
--   치과는 자기 **판매가**만, 기공소는 자기 **기공원가**만 봅니다.
--   party_type 을 같이 봐야 합니다 — 안 보면 치과가 같은 id 로
--   기공원가 줄을 집어 갈 길이 남습니다.
alter table product_price_history enable row level security;

create policy price_history_select on product_price_history
  for select using (
    owner_org_id = my_org_id()
    or (party_org_id = my_org_id() and party_type = my_org_type()::text)
  );

-- ★ 사람이 손으로 못 넣습니다. 트리거(definer)만 씁니다.
--   지나간 값을 고칠 수 있으면 지나간 청구액을 고칠 수 있습니다.

-- ---------- 바뀔 때마다 적어 둡니다 ----------
--
-- ★ security definer 입니다 — 쓰기 정책이 없는 표에 넣습니다.
create or replace function record_price_history(
  p_owner uuid,
  p_party uuid,
  p_type  text,
  p_material uuid,
  p_price integer,
  p_pontic integer,
  p_pink integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into product_price_history (
    owner_org_id, party_org_id, party_type, material_id,
    effective_from, price, pontic_price, pink_price
  )
  values (
    p_owner, p_party, p_type, p_material,
    -- ★ 한국 날짜입니다. 서버는 UTC 라 자정부터 아침 9시 사이에 고치면
    --   어제 날짜로 적힙니다 — 어제 배송된 건까지 소급되는 셈입니다
    (now() at time zone 'Asia/Seoul')::date,
    p_price, p_pontic, p_pink
  )
  on conflict (party_org_id, material_id, effective_from) do update
    set price        = excluded.price,
        pontic_price = excluded.pontic_price,
        pink_price   = excluded.pink_price,
        recorded_at  = now();
end;
$$;

-- ★★ 거래처나 제품이 **통째로** 지워지는 길에서는 적지 않습니다.
--   거래처를 지우면 그 단가 줄들이 cascade 로 함께 지워지는데, 그때
--   없어진 거래처를 가리키는 기록을 넣으려 들면 **삭제 자체가 막힙니다**
--   (외래키). 단가 줄만 지운 것과 거래처가 사라진 것은 다릅니다.
create or replace function price_parents_alive(
  p_owner uuid, p_party uuid, p_material uuid
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from organizations where id = p_owner)
     and exists (select 1 from organizations where id = p_party)
     and exists (select 1 from prosthesis_materials where id = p_material);
$$;

create or replace function on_clinic_price_change() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if not price_parents_alive(old.owner_org_id, old.clinic_org_id, old.material_id) then
      return old;
    end if;

    -- 줄을 지웠습니다 = 그 날부터 제품 기본가로 돌아갑니다
    perform record_price_history(
      old.owner_org_id, old.clinic_org_id, 'clinic', old.material_id, null, null, null
    );
    return old;
  end if;

  perform record_price_history(
    new.owner_org_id, new.clinic_org_id, 'clinic', new.material_id,
    new.price, new.pontic_price, new.pink_price
  );
  return new;
end;
$$;

create or replace function on_lab_cost_change() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if not price_parents_alive(old.owner_org_id, old.lab_org_id, old.material_id) then
      return old;
    end if;

    perform record_price_history(
      old.owner_org_id, old.lab_org_id, 'lab', old.material_id, null, null, null
    );
    return old;
  end if;

  perform record_price_history(
    new.owner_org_id, new.lab_org_id, 'lab', new.material_id,
    new.lab_cost, new.pontic_cost, new.pink_cost
  );
  return new;
end;
$$;

create trigger clinic_price_history
  after insert or update or delete on clinic_product_prices
  for each row execute function on_clinic_price_change();

create trigger lab_cost_history
  after insert or update or delete on lab_product_costs
  for each row execute function on_lab_cost_change();

-- ---------- 지금 있는 값을 심습니다 ----------
--
-- ★★ **지금 값이 처음부터 그랬던 것으로** 둡니다 (effective_from = 줄을
--   만든 날). 지나간 값은 아무도 적어 두지 않았으니 알 길이 없습니다.
--
--   그래서 이 미그레이션은 **지금 보이는 금액을 하나도 안 바꿉니다.**
--   오늘까지의 셈은 그대로고, 날짜가 갈리기 시작하는 것은 **다음
--   변경부터**입니다. 메이트 치과의 1 → 2 는 사용자 확인대로 그대로
--   소급된 채 둡니다(배송 2건, 2026-10월분 46원).
insert into product_price_history (
  owner_org_id, party_org_id, party_type, material_id,
  effective_from, price, pontic_price, pink_price, recorded_at
)
select owner_org_id, clinic_org_id, 'clinic', material_id,
       (created_at at time zone 'Asia/Seoul')::date,
       price, pontic_price, pink_price, created_at
  from clinic_product_prices
on conflict (party_org_id, material_id, effective_from) do nothing;

insert into product_price_history (
  owner_org_id, party_org_id, party_type, material_id,
  effective_from, price, pontic_price, pink_price, recorded_at
)
select owner_org_id, lab_org_id, 'lab', material_id,
       (created_at at time zone 'Asia/Seoul')::date,
       lab_cost, pontic_cost, pink_cost, created_at
  from lab_product_costs
on conflict (party_org_id, material_id, effective_from) do nothing;
