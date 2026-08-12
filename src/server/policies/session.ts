// =========================================================
// 놓을 위치: src/server/policies/session.ts
//
// "지금 로그인한 사람이 누구이고, 어느 조직 소속인가"를
// 한 곳에서만 판단합니다. 화면마다 따로 확인하면 규칙이 흩어집니다.
// (설계서 §5.3 결정 2 — 권한은 DB와 서버 양쪽에서 검사)
// =========================================================

import { cache } from 'react';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canSeeMoney, type MemberRole } from '@/server/domain/member';

export type Sector = 'clinic' | 'design_center' | 'lab';

/**
 * 로그인 안 했으면 null. 로그인은 했지만 소속이 없으면 orgType 이 null.
 *
 * ★ 한 요청 안에서는 **한 번만** 물어봅니다 (React cache).
 *   이 함수는 66곳에서 부릅니다 — 레이아웃, 화면, 저장소, 액션이
 *   각자 부르니 한 페이지를 그리는 데 여러 번 실행됐습니다.
 *   한 번에 왕복이 3번(인증·소속·프로필)이므로, 대여섯 번 불리면
 *   왕복이 스무 번 가까이 됩니다. 서버와 DB가 멀면 그게 곧 체감 속도입니다.
 *
 *   cache 는 **요청 하나** 안에서만 삽니다. 다음 요청은 다시 물어보므로
 *   로그아웃하거나 권한이 바뀐 것이 늦게 반영될 일은 없습니다.
 */
export const getSession = cache(async function getSession() {
  const supabase = await createClient();

  /*
    ★ getUser 가 아니라 getClaims 입니다.
      getUser 는 **매번 Supabase 인증 서버에 물어봅니다** — 화면 하나를
      그릴 때마다 왕복이 하나 더 붙는 셈이고, 그게 모든 화면에 있었습니다.

      이 프로젝트의 토큰은 ES256(비대칭)이라 **서명을 이 서버에서 직접
      검증**할 수 있습니다. 공개키는 한 번 받아 두고 씁니다.
      검증을 건너뛰는 것이 아닙니다 — 남이 만든 토큰은 그대로 걸립니다.

      혹시 대칭키(HS256) 프로젝트로 바뀌면 supabase-js 가 알아서
      서버에 물어봅니다. 그때는 전과 같아질 뿐 틀리지는 않습니다.
  */
  const { data: claims } = await supabase.auth.getClaims();

  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const email = (claims?.claims?.email as string | undefined) ?? '';
  const user = { id: userId, email };

  /*
    ★ 둘을 **함께** 보냅니다.
      소속과 이름은 서로를 안 씁니다. 줄줄이 기다릴 이유가 없는데
      순서대로 두면 왕복이 두 번입니다 — 서버와 DB가 멀수록 그 차이가
      그대로 화면 뜨는 시간이 됩니다.
  */
  const [{ data }, { data: profile }] = await Promise.all([
    supabase
      .from('memberships')
      .select('role, org_id, organizations(name, org_type)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle(),

    // 상단바에 조직명과 나란히 찍습니다
    supabase.from('user_profiles').select('name').eq('id', userId).maybeSingle(),
  ]);

  const org = (data?.organizations ?? null) as {
    name: string;
    org_type: Sector;
  } | null;

  return {
    user,
    email,
    role: data?.role ?? null,
    orgId: data?.org_id ?? null,
    orgName: org?.name ?? null,
    orgType: org?.org_type ?? null,
    userName: profile?.name ?? email.split('@')[0] ?? '',
  };
});

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
