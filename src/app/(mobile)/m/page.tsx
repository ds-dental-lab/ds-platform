// =========================================================
// 놓을 위치: src/app/(mobile)/m/page.tsx
//
// S1 — 진료실 홈. 오늘 의뢰 목록. (명세서 SPEC_shade-photo S1)
//
// ★ 여기서 세 번 안에 촬영까지 갑니다 — 홈 열기 → 환자 탭 → 촬영.
//   그래서 검색·필터를 위에 얹지 않았습니다. 오늘 것이 맨 위에 옵니다.
// =========================================================

import { listShadeCases } from '@/server/repositories/shade-photo';
import { requireSector } from '@/server/policies/session';
import ShadeHome from '@/components/shade/ShadeHome';

export const dynamic = 'force-dynamic';

export default async function MobileHomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const session = await requireSector('clinic');
  const cases = await listShadeCases(q);

  return <ShadeHome cases={cases} clinicName={session.orgName ?? ''} keyword={q ?? ''} />;
}
