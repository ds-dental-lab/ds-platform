-- =========================================================
-- DS Flow — 같은 열람을 여러 번 적지 않습니다
-- 파일 위치: supabase/migrations/<타임스탬프>_audit_dedupe.sql
--
-- 무엇이 문제였나.
--   기록을 붙이자마자 3분 만에 155줄이 쌓였습니다. 그런데 **대상은 2건**뿐.
--   서버 컴포넌트는 화면을 다시 그릴 때마다 다시 실행됩니다 —
--   개발 중 파일 저장(HMR), 링크 미리 읽기(prefetch), 뒤로가기 모두요.
--   사람은 한 번 열었는데 기록에는 백 번 열었다고 남습니다.
--
--   그 기록은 쓸모가 없는 정도가 아니라 **거짓말**입니다.
--   "이 직원이 환자 기록을 155번 들여다봤다" 로 읽힙니다.
--
-- 어떻게 고치나.
--   같은 사람이 · 같은 일을 · 같은 대상에 · 짧은 시간 안에 하면 한 줄로 봅니다.
--   사람의 '한 번 방문' 이 한 줄이 되게 하는 것입니다.
--
-- ★ 창은 5분입니다.
--   화면을 다시 그리는 일은 몇 초 안에 몰립니다. 5분이면 그것들을 덮고,
--   "오전에 한 번 오후에 한 번 봤다" 는 따로 남습니다.
--
-- ★ 판단을 DB 에 둡니다.
--   서버 코드에서 '읽고 나서 쓰면' 두 요청이 겹칠 때 둘 다 씁니다.
--   한 문장으로 넣으면 그 틈이 없습니다.
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
      -- 대상이 없는 것(목록·검색)끼리도 묶입니다
      and a.target_id is not distinct from p_target_id
      and a.created_at > now() - interval '5 minutes'
  )
  returning id;
$$;

comment on function record_access is
  '열람 한 건을 남깁니다. 같은 사람·같은 대상은 5분 안에 한 번만 (설계서 §3.5)';

grant execute on function record_access(uuid, uuid, audit_action, uuid, integer, text)
  to authenticated;

-- ---------- 화면을 다시 그려 쌓인 줄을 걷어냅니다 ----------
--
-- ★ 앱에서는 못 지웁니다 (delete 정책이 없습니다).
--   이 마이그레이션은 DB 관리자 권한으로 돌기 때문에 지울 수 있습니다.
--   기록을 지우는 길이 이렇게 좁은 것이 맞습니다.
--
-- 같은 (사람·동작·대상) 묶음에서 가장 이른 한 줄만 남깁니다.
delete from audit_logs a
where exists (
  select 1 from audit_logs b
  where b.actor_user_id = a.actor_user_id
    and b.action        = a.action
    and b.target_id is not distinct from a.target_id
    and b.created_at <= a.created_at
    and b.id <> a.id
    and b.created_at > a.created_at - interval '5 minutes'
);
