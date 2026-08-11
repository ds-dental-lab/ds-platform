-- =========================================================
-- DS Flow — 조직의 신원(종류 · 코드)은 만든 뒤 못 바꿉니다
-- 파일 위치: supabase/migrations/<타임스탬프>_freeze_org_identity.sql
--
-- 왜 필요한가.
--   방금(20260812010000) 디자인센터가 거래처 정보를 고칠 수 있게 열었습니다.
--   RLS 는 '어느 행' 은 막아도 '어느 칸' 은 못 막습니다.
--   화면은 상호·주소만 보내지만, 손으로 부른 요청은 org_type 도 보낼 수 있습니다.
--
--   치과를 design_center 로 바꾸면 그 조직 사람들이 디자인센터 화면을 얻습니다.
--   my_org_type() 이 모든 정책의 밑돌이라, 한 칸이 조직 전체의 권한을 옮깁니다.
--
--   code 도 같습니다 — DC-001 은 사람이 주문서에서 읽는 이름표입니다.
--
-- ★ 서버 코드가 안 보내는 것과, DB 가 못 받는 것은 다릅니다 (설계서 §5.3 결정 2).
-- =========================================================

create or replace function freeze_org_identity()
returns trigger
language plpgsql as $$
begin
  if new.org_type is distinct from old.org_type then
    raise exception '조직 종류는 만든 뒤에 바꿀 수 없습니다';
  end if;

  -- 아직 코드가 없던 조직에 처음 붙이는 것은 허용합니다
  if old.code is not null and new.code is distinct from old.code then
    raise exception '조직 코드는 만든 뒤에 바꿀 수 없습니다';
  end if;

  return new;
end;
$$;

create trigger organizations_freeze_identity
  before update on organizations
  for each row execute function freeze_org_identity();
