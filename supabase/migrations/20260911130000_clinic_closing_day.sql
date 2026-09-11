-- =========================================================
-- 치과가 정산 기준일을 스스로 고름 (사용자 요청 2026-09-11)
--
-- 전(20260813150000 ③): 자기 조직의 closing_day 를 바꾸면 무조건 막음
--   ("치과가 스스로 옮기면 이번 달에 나갈 청구가 다음 달로 밀립니다").
--
-- ★ 그 걱정은 이제 코드가 막습니다 — domain/billing effectivePeriodRange.
--   이미 만든 기간은 박아 둔 날짜 그대로, 바로 다음 기간은 앞 기간이 끝난
--   다음 날부터 시작합니다. 그래서 바꿔도 빠지는 날·두 번 청구되는 날이 없습니다.
--
-- ★ 여는 것은 **치과만, 1일·26일만**. 기공소는 계속 디자인센터가 정합니다.
--   조직 종류·거래 상태 문지기는 그대로입니다.
-- =========================================================

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
    if old.org_type <> 'clinic' or new.closing_day not in (1, 26) then
      raise exception '정산 기준일은 치과만 1일·26일 중에서 고를 수 있습니다';
    end if;
  end if;

  if new.org_type is distinct from old.org_type then
    raise exception '조직 종류는 바꿀 수 없습니다';
  end if;

  if new.status is distinct from old.status then
    raise exception '거래 상태는 스스로 바꿀 수 없습니다';
  end if;

  return new;
end;
$$;
