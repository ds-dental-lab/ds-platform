-- 치과 에이전트의 "출력할 것 있나" 를 버셀 대신 DB 가 답합니다 (2026-11-05, 사용자 "지금 바꿔줘")
--
-- ★ 왜: 치과 PC 한 대가 진료 시간에 10초마다 버셀 /api/device/print 를 불러 하루 약 5,200건
--   (한 달 약 15만)이었습니다. 치과 수만큼 늘어납니다. 설계 PC 는 2026-10-27 에 이미 DB 먼저로 바꿨습니다.
-- ★ 어떻게: 묻기만 여기서 답하고, **집기부터는 지금처럼 버셀 API** 입니다(claimPrintJob 한 벌).
--   이 함수는 '있을 수도 있다' 만 말합니다. 에이전트는 '없다' 여도 정해진 간격마다 버셀에 한 번 묻습니다.
-- ★★ 열쇠: 설계 PC 처럼 **공용 비밀을 쓰지 않습니다** — 치과 PC 마다 퍼지면 비밀이 아닙니다.
--   기기마다 이미 가진 기기 열쇠(token)를 받아 clinic_devices.token_hash(sha256 hex) 와 견주고,
--   **그 기기의 치과 것만** 답합니다. 끊긴(revoked) 기기는 거절합니다. 답은 참·거짓 둘뿐이라 새는 것이 없습니다.
-- ★ 조건은 서버보다 **넓게** 둡니다 — 거짓 '없다' 는 출력을 늦추고, 거짓 '있다' 는 버셀 한 번이면 끝납니다.

create or replace function clinic_print_probe(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_device uuid;
  v_clinic uuid;
  v_print boolean;
  v_warm boolean;
begin
  if p_token is null or length(p_token) < 16 then
    raise exception 'probe: 열쇠가 없습니다' using errcode = '28000';
  end if;

  select id, clinic_org_id into v_device, v_clinic
  from clinic_devices
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and revoked_at is null;
  if v_device is null then
    raise exception 'probe: 연결되지 않은 기기입니다' using errcode = '28000';
  end if;

  -- 가져갈 것 — claimPrintJob 과 같은 뜻, 조금 넓게
  select exists (
    select 1 from auto_jobs j
    where j.clinic_org_id = v_clinic
      and (
        -- 출력판 확인까지 끝난 대기 건
        (j.step = 'queued' and j.bed_cleared_at is not null)
        -- 이 기기가 집어 갔다가 놓친 것(에이전트가 다시 켜짐) — 이어서 지켜보기
        or (j.step in ('sending', 'printing') and j.claimed_device_id = v_device)
        -- 다시 자르기가 늦어 버셀이 대기로 올려 줄 것 — promoteStaleReslices (3분·6분)
        or (j.step = 'slicing' and j.print_file_path is not null and (
              (j.claimed_at is null and j.updated_at < now() - interval '3 minutes')
              or j.claimed_at < now() - interval '6 minutes'))
      )
  ) into v_print;

  -- 미리 데우기 — warmSoon 과 같은 조건
  select exists (
    select 1 from auto_jobs j
    where j.clinic_org_id = v_clinic
      and j.dismissed_at is null
      and (
        j.step in ('slicing', 'queued')
        or (j.step = 'waiting_design' and j.design_stage in ('uploading', 'analyzing', 'generating', 'exporting'))
      )
  ) into v_warm;

  return jsonb_build_object('print', v_print, 'warm', v_warm);
end;
$$;

revoke all on function clinic_print_probe(text) from public;
grant execute on function clinic_print_probe(text) to anon, service_role;

comment on function clinic_print_probe(text) is
  '치과 에이전트가 버셀 대신 여기에 "출력할 것 있나·미리 데울까" 를 묻습니다 (2026-11-05). 기기 열쇠로 그 치과 것만. 집기는 버셀 API.';
