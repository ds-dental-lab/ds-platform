-- =========================================================
-- DS Flow — Advisor 경고 두 갈래를 닫습니다
-- 파일 위치: supabase/migrations/<타임스탬프>_lint_hardening.sql
-- 기준: Supabase Advisor 2026-08-21 (errors 0, warnings 70)
--
-- ★ 급한 것은 없었습니다. 하나씩 실제로 눌러 보고 확인한 결과입니다:
--     · approve_signup 을 익명으로 불러도 '디자인센터 관리자만
--       승인할 수 있습니다' 로 막힙니다 — 문지기가 함수 **안**에 있습니다
--     · contact_requests 의 'always true' 는 **넣기**뿐입니다.
--       익명으로 읽으면 0줄입니다(표에는 3줄 있습니다)
--   그래도 문은 하나 더 닫아 두는 편이 낫습니다.
--
-- 여기서 하는 것 둘.
--   ① 남은 함수 11개에 search_path 를 박습니다
--   ② 관리자만 부를 함수의 실행 권한을 익명에게서 거둡니다
-- =========================================================

-- ---------- ① search_path 를 박습니다 ----------
--
-- ★ 함수를 다시 만들지 않고 **alter** 로 붙입니다.
--   본문을 옮겨 적으면 그 순간 원본과 어긋날 수 있습니다.
--   여기서 바꾸는 것은 '어느 스키마를 뒤지는가' 하나뿐입니다.
--
-- ★ 이 11개에는 security definer 가 **하나도 없습니다.**
--   전부 트리거용 잔심부름이거나 번호 뽑기입니다. 그래서 급하지
--   않았습니다 — 이 경고가 진짜 위험해지는 것은 남의 권한으로
--   도는 함수일 때인데, 그쪽 31개에는 이미 다 박혀 있습니다.
--
-- ★ 이름으로 돕니다. 인자를 손으로 옮겨 적다 틀리면 엉뚱한 함수를
--   고치거나 조용히 아무것도 안 고칩니다.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'touch_updated_at', 'touch_completed_at',
        'mask_name', 'fill_name_masked', 'mask_order_file_name',
        'next_invoice_no', 'next_credit_no',
        'order_file_ext', 'order_file_kind_tag',
        'reject_closed_period', 'freeze_org_identity'
      ])
  loop
    execute format('alter function %s set search_path = public', f.sig);
  end loop;
end $$;

-- ---------- ② 익명에게서 실행 권한을 거둡니다 ----------
--
-- ★ **가려서** 거둡니다. 여기 적힌 것은 화면이 .rpc() 로 직접 부르는
--   '일을 시키는' 함수들입니다. 로그인한 사람만 부를 일입니다.
--
-- ★★ **정책이 쓰는 함수는 손대지 않습니다.**
--   my_org_id() · is_partner_org() · can_access_order() 같은 것들은
--   표의 조회 정책 안에서 불립니다. 익명에게서 실행 권한을 거두면,
--   지금 조용히 **0줄**이 나오던 자리가 '함수 실행 권한 없음' 오류로
--   바뀝니다. 막히는 것은 같지만 화면이 깨집니다.
--   0줄로 막는 편이 낫습니다 — 있는지 없는지도 안 알려 주니까요.
--
-- ★ 트리거 함수도 손대지 않습니다.
--   홈페이지 문의는 로그인 없이 들어오는데, 그 표에도 트리거가
--   붙어 있습니다. 잘못 거두면 문의 폼이 막힙니다.
--
-- ★ 약관·처리방침(public_terms · public_privacy_policy)은 그대로 둡니다.
--   /terms · /privacy 는 로그인 없이 보는 화면입니다.
--
-- ★ public 에서 거두면 authenticated 도 같이 잃습니다(기본 권한이
--   public 으로 붙어 있기 때문입니다). 그래서 다시 줍니다.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        -- 가입 승인·반려
        'approve_signup', 'reject_signup',
        -- 거래처 만들기·지우기
        'create_partner_org', 'delete_partner_org',
        -- 돈
        'issue_credit_note', 'cancel_credit_note',
        -- 번호 뽑기
        'next_order_no', 'next_invoice_no', 'next_credit_no',
        -- 기록 남기기 · 올릴 파일 수 적어 두기
        'record_access', 'note_planned_scan_files'
      ])
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;
