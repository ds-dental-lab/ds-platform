-- =========================================================
-- DS Flow — 아직 상품이 아닌 보철을 **특정 치과에만** 엽니다
-- 파일 위치: supabase/migrations/20261010130000_sees_internal.sql
-- 기준: 사용자 요청 2026-10-10 — "치ㅣ치과에서만 활성화 해줘"
--
-- ★ '자동 템포러리' 는 is_internal 이라 치과 주문등록 목록에서 빠집니다
--   (사용자 결정 2026-10-06 — "상품화하긴 이르니깐 눈에 아직 안 띄게").
--   그런데 **한 사이클을 끝까지 돌려 보려면** 치과가 그 주문을 넣을 수
--   있어야 합니다. 시험하는 치과 한 곳만 엽니다.
--
-- ★ is_active 를 켜는 것과 다릅니다. 그건 모든 치과에 보입니다.
--   이건 '이 치과만 미리 쓴다' 입니다 — 상품화하면 is_internal 을 끄고
--   이 칸은 전부 거짓으로 돌려놓으면 됩니다.
-- =========================================================

alter table organizations
  add column sees_internal boolean not null default false;

comment on column organizations.sees_internal is
  '아직 상품이 아닌 보철(is_internal)을 이 치과에는 보여 줍니다. 시험용 (2026-10-10)';

-- ---------- 치과가 스스로 켜지 못하게 ----------
--
-- ★ 문지기에 한 줄 더합니다. 안 막으면 치과 관리자가 자기 조직을 고치는
--   길(계정정보)로 이 칸을 켤 수 있습니다 — 그러면 '아직 안 파는 것' 이
--   뜻을 잃습니다.
create or replace function organizations_guard_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;                      -- service_role · 마이그레이션
  end if;

  -- 남이(=디자인센터가 거래처를) 고치는 경우는 여기서 안 봅니다
  if new.id is distinct from my_org_id() then
    return new;
  end if;

  if new.closing_day is distinct from old.closing_day then
    raise exception '정산 기준일은 디자인센터가 정합니다';
  end if;

  if new.org_type is distinct from old.org_type then
    raise exception '조직 종류는 바꿀 수 없습니다';
  end if;

  if new.status is distinct from old.status then
    raise exception '거래 상태는 스스로 바꿀 수 없습니다';
  end if;

  if new.sees_internal is distinct from old.sees_internal then
    raise exception '아직 공개하지 않은 보철은 디자인센터가 엽니다';
  end if;

  return new;
end;
$$;

-- ---------- 시험하는 치과 한 곳 ----------
--
-- ★ id 를 그대로 적습니다. 이름('치ㅣ')은 바뀔 수 있고, 이 줄은 한 번만
--   도는 일회성 손질입니다. 다른 DB 에서는 0줄 — 그래도 맞습니다.
update organizations
   set sees_internal = true
 where id = 'eb87944e-978c-458f-9015-5b493a4edc07'
   and org_type = 'clinic';
