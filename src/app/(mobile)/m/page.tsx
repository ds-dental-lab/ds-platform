// =========================================================
// 놓을 위치: src/app/(mobile)/m/page.tsx
//
// S1 — 진료실 홈. 오늘 의뢰 목록. (명세서 SPEC_shade-photo S1)
//
// ★ 여기서 세 번 안에 촬영까지 갑니다 — 홈 열기 → 환자 탭 → 촬영.
//   그래서 검색·필터를 위에 얹지 않았습니다. 오늘 것이 맨 위에 옵니다.
// =========================================================

import { listShadeCases } from '@/server/repositories/shade-photo';
import { countUnsortedPhotos } from '@/server/repositories/unsorted-photo';
import { requireSector } from '@/server/policies/session';
import ShadeHome from '@/components/shade/ShadeHome';

export const dynamic = 'force-dynamic';

export default async function MobileHomePage() {
  const session = await requireSector('clinic');

  /*
    ★ 검색어를 서버로 안 보냅니다. 최근 7일은 백 줄 남짓이라 통째로
      내려 주고 **브라우저가 치는 대로** 좁힙니다 (domain/hangul).
      초성 검색은 ilike 로 못 합니다.
  */
  const [cases, unsorted] = await Promise.all([listShadeCases(), countUnsortedPhotos()]);

  return (
    <ShadeHome
      cases={cases}
      clinicName={session.orgName ?? ''}
      keyword=""
      clinicOrgId={session.orgId ?? undefined}
      unsortedCount={unsorted}
    />
  );
}
