-- =========================================================
-- DS Flow — 종류가 다른 열람은 따로 셉니다
-- 파일 위치: supabase/migrations/<타임스탬프>_audit_dedupe_detail.sql
--
-- 무엇이 문제였나.
--   묶는 열쇠가 (사람 · 동작 · 대상) 이었는데, 목록류는 대상이 비어 있어
--   **주문목록과 배송조회가 한 줄로 합쳐졌습니다.**
--   둘 다 환자 이름이 나가는 서로 다른 열람인데 하나만 남습니다.
--
-- 어떻게 고치나.
--   맥락(detail)까지 열쇠에 넣습니다. '배송조회' 와 '검색' 과 빈 값이
--   각각 따로 셉니다. 화면을 다시 그려 생기는 중복은 여전히 묶입니다 —
--   그때는 맥락도 같기 때문입니다.
-- =========================================================

create or replace function record_access(
  p_actor_user_id uuid,
  p_actor_org_id  uuid,
  p_action        audit_action,
  p_target_id     uuid,
  p_subject_count integer,
  p_detail        text
)
returns bigint
language sql security invoker set search_path = public as $$
  insert into audit_logs (
    actor_user_id, actor_org_id, action, target_id, subject_count, detail
  )
  select
    p_actor_user_id, p_actor_org_id, p_action, p_target_id,
    coalesce(p_subject_count, 1), p_detail
  where not exists (
    select 1 from audit_logs a
    where a.actor_user_id = p_actor_user_id
      and a.action        = p_action
      and a.target_id is not distinct from p_target_id
      -- ★ 맥락이 다르면 다른 열람입니다 (주문목록 · 배송조회 · 검색)
      and a.detail    is not distinct from p_detail
      and a.created_at > now() - interval '5 minutes'
  )
  returning id;
$$;

comment on function record_access is
  '열람 한 건을 남깁니다. 같은 사람·대상·맥락은 5분 안에 한 번만 (설계서 §3.5)';
