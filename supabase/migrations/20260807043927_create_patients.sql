-- =========================================================
-- DS Flow — 환자
-- Sprint 1 Day 5
-- 파일 위치: supabase/migrations/<타임스탬프>_create_patients.sql
-- 기준: 설계서 §4 patients, §8.5 노출 정책
-- =========================================================

-- ---------- 이름 마스킹 ----------
-- 김철수 → 김*수   /   김수 → 김*   /   남궁민수 → 남**수
create or replace function mask_name(full_name text)
returns text
language sql immutable as $$
  select case
    when full_name is null or length(full_name) = 0 then null
    when length(full_name) = 1 then full_name
    when length(full_name) = 2 then left(full_name, 1) || '*'
    else left(full_name, 1)
         || repeat('*', length(full_name) - 2)
         || right(full_name, 1)
  end;
$$;

-- ---------- 환자 ----------
create table patients (
  id            uuid primary key default gen_random_uuid(),
  clinic_org_id uuid not null references organizations(id) on delete cascade,
  chart_no      text not null,
  name          text not null,
  name_masked   text,               -- 트리거가 자동으로 채웁니다
  birth_date    date,               -- 동명이인 구분용, 선택
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

comment on table  patients             is '환자. 치과별로 분리되며 실명 접근은 별도 통제';
comment on column patients.name_masked is '기공소에 노출되는 마스킹 값. 자동 생성';

-- 같은 치과 안에서 차트번호는 중복될 수 없습니다
create unique index patients_chart_no_idx
  on patients (clinic_org_id, chart_no) where deleted_at is null;
create index patients_clinic_idx on patients (clinic_org_id);

create trigger patients_touch
  before update on patients
  for each row execute function touch_updated_at();

-- ---------- 마스킹 자동 생성 ----------
create or replace function fill_name_masked()
returns trigger language plpgsql as $$
begin
  new.name_masked := mask_name(new.name);
  return new;
end;
$$;

create trigger patients_mask
  before insert or update of name on patients
  for each row execute function fill_name_masked();

-- ---------- 접근 정책 (설계서 §8.5) ----------
-- 치과       — 자기 환자만
-- 디자인센터 — 거래 중인 치과의 환자 (작업 문의에 필요)
-- 기공소     — 정책 없음 = 접근 불가. 나중에 주문을 통해 마스킹 값만 받습니다
alter table patients enable row level security;

create policy patient_select on patients
  for select using (
    clinic_org_id = my_org_id()
    or (my_org_type() = 'design_center' and is_partner_org(clinic_org_id))
  );

create policy patient_write on patients
  for all
  using      (clinic_org_id = my_org_id() and my_org_type() = 'clinic')
  with check (clinic_org_id = my_org_id() and my_org_type() = 'clinic');

-- ---------- 확인용 데이터 ----------
insert into patients (clinic_org_id, chart_no, name, birth_date)
select o.id, v.chart_no, v.name, v.birth_date
from organizations o,
     (values ('10001', '김철수', date '1985-03-12'),
             ('10002', '이영희', date '1992-07-25'),
             ('10003', '박민',   date '1978-11-03')) as v(chart_no, name, birth_date)
where o.code = 'DC-001'
  and not exists (
    select 1 from patients p
    where p.clinic_org_id = o.id and p.chart_no = v.chart_no
  );

-- 마스킹이 제대로 들어갔는지 봅니다
select chart_no, name, name_masked from patients order by chart_no;
