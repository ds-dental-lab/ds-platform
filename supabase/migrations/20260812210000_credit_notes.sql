-- =========================================================
-- 마이너스 청구서 (CRD-). 사용자 요청 2026-08-12.
--
-- ★ 나간 청구서는 못 고칩니다. 깎는 문서를 새로 냅니다.
--   "한 번 나간 문서의 숫자가 나중에 달라지면 신뢰가 무너집니다" 는
--   이 프로젝트가 처음부터 지켜 온 규칙입니다. 그런데 리메이크·과청구처럼
--   나중에 되돌려야 하는 일은 실제로 생깁니다. 그때 원본을 손대는 대신
--   CRD- 번호가 붙은 문서를 한 장 더 냅니다. 둘이 나란히 남습니다.
--
-- ★ 조정(billing_adjustments)과는 다릅니다.
--   조정은 **발행 전에** 청구액을 만드는 과정입니다. CRD- 는 **이미 나간
--   뒤에** 깎는 별도의 문서입니다. 섞으면 "청구서에 찍힌 금액" 이
--   흔들립니다.
--
-- ★ 입금으로 적지 않습니다.
--   '입금 -50,000' 으로 적으면 통장에 없는 돈이 들어온 것이 됩니다.
--   받을 돈이 줄어든 것이지, 받은 돈이 는 것이 아닙니다.
-- =========================================================

create sequence if not exists credit_no_seq start 1;

-- INV 와 같은 모양, 다른 줄. 번호가 섞이면 "몇 번 문서" 가 모호해집니다
create or replace function next_credit_no()
returns text
language sql volatile as $$
  select 'CRD-' || to_char(now() at time zone 'Asia/Seoul', 'YY')
      || lpad(nextval('credit_no_seq')::text, 6, '0');
$$;

create table credit_notes (
  id         uuid primary key default gen_random_uuid(),
  period_id  uuid not null references billing_periods(id) on delete cascade,
  credit_no  text not null unique,

  -- ★ 양수로 담습니다. 화면이 −를 붙여 보여 줍니다.
  --   음수를 담으면 "−50000 을 깎는다" 가 되어 부호가 두 번 뒤집힙니다.
  amount     bigint not null check (amount > 0),
  reason     text   not null check (btrim(reason) <> ''),

  issued_at  timestamptz not null default now(),
  issued_by  uuid references user_profiles(id),

  -- 번호가 붙은 문서는 지우지 않습니다. 취소도 기록으로 남깁니다
  cancelled_at    timestamptz,
  cancel_reason   text,
  cancelled_by    uuid references user_profiles(id)
);

comment on table credit_notes is
  '마이너스 청구서. 이미 나간 청구서를 고치지 않고 깎는 별도 문서입니다';

create index credit_notes_period_idx on credit_notes (period_id)
  where cancelled_at is null;

alter table credit_notes enable row level security;

-- ★ 자기 청구서에 붙은 것은 받는 쪽도 봅니다.
--   깎아 줬는데 상대가 못 보면 "왜 금액이 다르냐" 가 다시 옵니다.
create policy credit_select on credit_notes
  for select using (
    exists (
      select 1 from billing_periods p
      where p.id = credit_notes.period_id
        and (p.owner_org_id = my_org_id() or p.party_org_id = my_org_id())
    )
  );

-- ★ insert·update 정책을 안 엽니다. 아래 두 함수만 씁니다.
--   번호를 붙이는 일과 한도를 세는 일이 한 곳에 있어야 합니다.

-- ---------- 발행 ----------

create or replace function issue_credit_note(
  p_period_id uuid,
  p_amount    bigint,
  p_reason    text
)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_period  billing_periods%rowtype;
  v_total   bigint;
  v_credited bigint;
  v_no      text;
begin
  -- ★ null 을 값처럼 비교합니다. `<> ` 로 쓰면 소속 없는 사람이 통과합니다
  --   (20260812201000_null_guard 참고)
  if coalesce(my_role()::text, '') not in ('owner', 'admin') then
    raise exception '관리자만 마이너스 청구서를 낼 수 있습니다';
  end if;

  select * into v_period from billing_periods where id = p_period_id for update;

  if not found then
    raise exception '없는 청구서입니다';
  end if;

  -- 청구한 쪽만 깎습니다. 받는 쪽이 스스로 깎으면 그건 문서가 아니라 주장입니다
  if v_period.owner_org_id is distinct from my_org_id() then
    raise exception '이 청구서를 발행한 조직이 아닙니다';
  end if;

  if v_period.invoice_no is null then
    raise exception '아직 발행되지 않은 청구서입니다';
  end if;

  if coalesce(btrim(p_reason), '') = '' then
    raise exception '사유를 적어 주세요';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception '깎을 금액을 넣어 주세요';
  end if;

  select coalesce(sum(amount), 0) into v_total
    from billing_lines where period_id = p_period_id;

  select coalesce(sum(amount), 0) into v_credited
    from credit_notes where period_id = p_period_id and cancelled_at is null;

  -- ★ 청구액보다 많이 못 깎습니다. 더 깎으면 받을 돈이 음수가 됩니다
  if v_credited + p_amount > v_total then
    raise exception '청구액보다 많이 깎을 수 없습니다 (남은 한도 %원)',
      to_char(greatest(v_total - v_credited, 0), 'FM999,999,999,999');
  end if;

  v_no := next_credit_no();

  insert into credit_notes (period_id, credit_no, amount, reason, issued_by)
  values (p_period_id, v_no, p_amount, btrim(p_reason), auth.uid());

  return v_no;
end;
$$;

comment on function issue_credit_note is
  '마이너스 청구서를 냅니다. 번호를 붙이고 청구액 한도를 지킵니다';

-- ---------- 취소 ----------

create or replace function cancel_credit_note(p_id uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_owner uuid;
begin
  if coalesce(my_role()::text, '') not in ('owner', 'admin') then
    raise exception '관리자만 취소할 수 있습니다';
  end if;

  if coalesce(btrim(p_reason), '') = '' then
    raise exception '취소 사유를 적어 주세요';
  end if;

  select p.owner_org_id into v_owner
    from credit_notes c join billing_periods p on p.id = c.period_id
   where c.id = p_id;

  if v_owner is null or v_owner is distinct from my_org_id() then
    raise exception '이 문서를 낸 조직이 아닙니다';
  end if;

  update credit_notes
     set cancelled_at = now(), cancel_reason = btrim(p_reason), cancelled_by = auth.uid()
   where id = p_id and cancelled_at is null;

  if not found then
    raise exception '이미 취소된 문서입니다';
  end if;
end;
$$;

revoke all on function issue_credit_note(uuid, bigint, text) from public;
revoke all on function cancel_credit_note(uuid, text) from public;
grant execute on function issue_credit_note(uuid, bigint, text) to authenticated;
grant execute on function cancel_credit_note(uuid, text) to authenticated;
