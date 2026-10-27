-- 설계 PC 의 "일 있나" 묻기를 버셀 대신 DB 가 답합니다 (2026-10-27)
--
-- ★ 왜: Vercel Hobby 는 Fluid Active CPU 가 한 달 4시간인데, 설계 PC 가 5초마다·15초마다
--   버셀에 묻는 것(하루 12,000건)이 CPU 를 거의 다 먹었습니다(10/27 실측 5h54m). 사용자는
--   첫 거래처 전까지 Hobby 로 버티기로 했습니다 ("첫 거래처가 중요해").
-- ★ 어떻게: 묻기만 여기서 답하고, **집기부터는 지금처럼 버셀 API** 로 갑니다. 집기 규칙은
--   한 벌(TypeScript)만 둡니다. 이 함수는 "있을 수도 있다" 를 말할 뿐이라, 여기서 true 가
--   나와도 버셀이 안 주면 그냥 다음 바퀴입니다. 반대로 false 를 잘못 말하면 일을 못 보니
--   조건은 서버(canHandDesign)보다 **넓게** 둡니다 — 단 영영 멈춘 것(stallKind 가 transient 가
--   아닌 것)은 빼야 합니다. 안 빼면 그 한 건 때문에 5초마다 버셀에 또 묻게 됩니다.
-- ★ 열쇠: app_secrets 표의 'auto_print_probe' 값과 같은 비밀을 든 쪽만 답을 받습니다.
--   표는 RLS 만 켜고 정책이 없어 anon·authenticated 는 못 읽습니다. 값은 사용자가 SQL 편집기에서
--   한 번 넣습니다:  insert into app_secrets (name, value) values ('auto_print_probe', '<긴 무작위 문자열>');
--   설계 PC 의 design_agent.json 에 같은 값을 "probe_secret" 으로 둡니다.

create table if not exists app_secrets (
  name text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
alter table app_secrets enable row level security;
revoke all on app_secrets from anon, authenticated;

create or replace function auto_print_probe(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_design boolean;
  v_reslice boolean;
begin
  select value into v_secret from app_secrets where name = 'auto_print_probe';
  if v_secret is null or p_secret is null or p_secret <> v_secret then
    raise exception 'probe: 열쇠가 다릅니다' using errcode = '28000';
  end if;

  -- 설계 일감 — canHandDesign(src/server/domain/auto-print/index.ts) 과 같은 뜻, 조금 넓게
  select exists (
    select 1
    from auto_jobs j
    join orders o on o.id = j.order_id
    where j.step = 'waiting_design'
      and o.deleted_at is null
      and o.status not in ('uploading', 'cancelled', 'completed')
      and exists (
        select 1 from order_files f
        where f.order_id = o.id and f.kind = 'scan' and f.upload_status = 'uploaded' and f.deleted_at is null
      )
      and coalesce(j.design_stage, '') not in ('ended', 'exporting')
      and (
        j.design_stage is null
        or (
          j.design_stage = 'stalled'
          and coalesce(j.design_tries, 0) <= 1                      -- DESIGN_AUTO_RETRIES
          and j.updated_at <= now() - interval '5 minutes'          -- DESIGN_RETRY_AFTER_MINUTES
          -- stallKind 가 transient 인 것만 (아래 다섯 묶음은 unsupported·unreadable·scan·credits·setup)
          and coalesce(j.design_note, '') !~ '치식이 \d+개|임플란트|자연치|프렙|지대치|깎은|브릿지 자동 설계는 준비 중|설계 묶음이 \d+개'
          and coalesce(j.design_note, '') !~ '치식을 못 읽|치식이 주문서와 다릅|치식이 다릅|크라운이 주문서와 다릅'
          and coalesce(j.design_note, '') !~ '스캔을 못 찾|스캔 후보가|파일을 내려놓|스캔을 봐 주세요|두 번 실패'
          and coalesce(j.design_note, '') !~* '건수|횟수|차감|credit'
          and coalesce(j.design_note, '') !~* '다운로드|download|로그인|session|세션|창이 안 떠|CAM 축|ZIP으로 압축|올라오지|올라왔|내보낸 뒤|배달|deliver'
        )
        or (j.design_stage <> 'stalled' and j.updated_at <= now() - interval '30 minutes')  -- DESIGN_CLAIM_STALE_MINUTES
      )
  ) into v_design;

  -- 다시 자르기 — claimNextReslice 와 같은 조건
  select exists (
    select 1 from auto_jobs
    where step = 'slicing' and print_file_path is not null and claimed_at is null
  ) into v_reslice;

  return jsonb_build_object('design', v_design, 'reslice', v_reslice);
end;
$$;

revoke all on function auto_print_probe(text) from public;
grant execute on function auto_print_probe(text) to anon, service_role;

comment on function auto_print_probe(text) is
  '설계 PC 가 버셀 대신 여기에 "설계·다시자르기 일 있나" 를 묻습니다 (2026-10-27, Hobby CPU 한도). 집기는 버셀 API.';
