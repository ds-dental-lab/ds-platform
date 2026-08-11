// =========================================================
// 놓을 위치: src/server/policies/session.ts
//
// "지금 로그인한 사람이 누구이고, 어느 조직 소속인가"를
// 한 곳에서만 판단합니다. 화면마다 따로 확인하면 규칙이 흩어집니다.
// (설계서 §5.3 결정 2 — 권한은 DB와 서버 양쪽에서 검사)
// =========================================================

import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canSeeMoney, type MemberRole } from '@/server/domain/member';

export type Sector = 'clinic' | 'design_center' | 'lab';

/** 로그인 안 했으면 null. 로그인은 했지만 소속이 없으면 orgType 이 null */
export async function getSession() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('memberships')
    .select('role, org_id, organizations(name, org_type)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  // 상단바에 조직명과 나란히 찍습니다
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('name')
    .eq('id', user.id)
    .maybeSingle();

  const org = (data?.organizations ?? null) as {
    name: string;
    org_type: Sector;
  } | null;

  return {
    user,
    email: user.email ?? '',
    role: data?.role ?? null,
    orgId: data?.org_id ?? null,
    orgName: org?.name ?? null,
    orgType: org?.org_type ?? null,
    userName: profile?.name ?? user.email?.split('@')[0] ?? '',
  };
}

/** 로그인 필수 화면에서 사용 */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

/**
 * 그 섹터의 **관리자만** 들어오는 화면 — 금액과 사용자 관리.
 * (사용자 결정 2026-08-12 — "금액나오는 곳만 안보이면 된다")
 *
 * ★ 메뉴를 숨기는 것만으로는 부족합니다.
 *   주소를 바로 치면 열립니다. 숨기는 것과 못 들어가는 것은 다릅니다.
 *
 * ★ 403 이 아니라 404 입니다 (설계서 §8.6과 같은 이유).
 *   "권한이 없다" 고 알려 주면 그 화면이 있다는 사실이 새어 나갑니다.
 */
export async function requireManagerSector(sector: Sector) {
  const session = await requireSector(sector);
  if (!canSeeMoney(session.role as MemberRole | null)) notFound();
  return session;
}

/**
 * 해당 섹터 사람만 들어올 수 있는 화면에서 사용.
 * 다른 섹터면 404 를 보여 줍니다.
 * 403(권한없음)이 아니라 404(없음)인 이유 — 설계서 §8.6.
 * "권한이 없다"고 알려주면 그 화면이 존재한다는 사실이 새어 나갑니다.
 */
export async function requireSector(sector: Sector) {
  const session = await requireSession();
  if (session.orgType !== sector) notFound();
  return session;
}
