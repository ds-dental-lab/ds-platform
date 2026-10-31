-- exocad 지켜보기도 "일 있나" 를 DB 에 먼저 묻습니다 (2026-10-31, 사용자 "DB 먼저 묻게 고쳐줘")
--
-- ★ 왜: 설계 PC 의 exocad 지켜보기가 3초마다 버셀에 물어 PC 를 켜 둔 동안 하루 최대 28,800 건이었습니다.
--   2026-10-27 에 일꾼 둘은 DB 먼저로 바꿨는데 이것만 빠졌습니다.
-- ★ 집기는 지금처럼 버셀 API 입니다. 이 함수는 '있을 수도 있다' 만 말합니다.
-- ★ 함수 본문의 앞부분은 20261027210000 과 같습니다. 'exocad' 칸만 더했습니다.

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
  v_exocad boolean;
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
        or (j.design_stage <> 'stalled' and j.updated_at <= now() - interval '30 minutes')  -- DESIGN_10_STALE_MINUTES
      )
  ) into v_design;

  -- 다시 자르기 — claimNextReslice 와 같은 조건
  select exists (
    select 1 from auto_jobs
    where step = 'slicing' and print_file_path is not null and claimed_at is null
  ) into v_reslice;

  -- exocad 로 열 것 — claimExocadJob 과 같은 조건 (EXOCAD_CLAIM_MINUTES = 10 분)
  select exists (
    select 1 from exocad_exports
    where fetched_at is null and requested_at >= now() - interval '10 minutes'
  ) into v_exocad;

  return jsonb_build_object('design', v_design, 'reslice', v_reslice, 'exocad', v_exocad);
end;
$$;

revoke all on function auto_print_probe(text) from public;
grant execute on function auto_print_probe(text) to anon, service_role;
