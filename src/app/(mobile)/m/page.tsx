// =========================================================
// 놓을 위치: src/app/(mobile)/m/page.tsx
//
// 폰 홈. **누가 열었느냐**로 갈립니다 (2026-09-06).
//   치과     → 오늘 의뢰 목록 (쉐이드 촬영, 명세서 S1)
//   센터     → 처리할 일 (문의 · 승인 · 주문 찾기)
//   기공소   → 레이아웃이 막습니다 (WrongSector)
//
// ★ 주소는 하나(/m)입니다. 앱을 설치했을 때 시작 자리가 하나여야 하고,
//   같은 앱이 계정에 따라 다른 얼굴을 보이는 것이 자연스럽습니다.
//
// ★ 치과 쪽 — 여기서 세 번 안에 촬영까지 갑니다: 홈 열기 → 환자 탭 →
//   촬영. 그래서 검색·필터를 위에 얹지 않았습니다. 오늘 것이 맨 위에 옵니다.
// =========================================================

import { listShadeCases } from '@/server/repositories/shade-photo';
import { countUnsortedPhotos } from '@/server/repositories/unsorted-photo';
import { listArrivingToday } from '@/server/repositories/arrival';
import { countApprovalQueue } from '@/server/repositories/approval-alert';
import type { Metadata } from 'next';
import { requireSession, getSession } from '@/server/policies/session';
import { canManageMembers, type MemberRole } from '@/server/domain/member';
import ShadeHome from '@/components/shade/ShadeHome';
import CenterHome from '@/components/center/CenterHome';

export const dynamic = 'force-dynamic';

/** 탭 제목도 누가 열었느냐로 갈립니다 — 센터 폰에 '쉐이드 촬영' 이 뜨면 안 됩니다 */
export async function generateMetadata(): Promise<Metadata> {
  const session = await getSession();
  return { title: session?.orgType === 'design_center' ? '처리할 일' : '쉐이드 촬영' };
}

export default async function MobileHomePage() {
  const session = await requireSession();

  // ---------- 센터 ----------
  if (session.orgType === 'design_center') {
    const manager = canManageMembers(session.role as MemberRole | null);
    // ★ 관리자만 셉니다 — 디자이너에게는 카드도 없고 셀 일도 없습니다
    const counts = manager ? await countApprovalQueue() : { signups: 0, contacts: 0 };

    return <CenterHome orgName={session.orgName ?? ''} counts={counts} manager={manager} />;
  }

  // ---------- 치과 ----------
  /*
    ★ 검색어를 서버로 안 보냅니다. 최근 7일은 백 줄 남짓이라 통째로
      내려 주고 **브라우저가 치는 대로** 좁힙니다 (domain/hangul).
      초성 검색은 ilike 로 못 합니다.
    ★ 셋을 **함께** 보냅니다. 서로를 안 쓰는데 줄줄이 기다리면 왕복이
      셋입니다 — 그 차이가 그대로 화면 뜨는 시간입니다.
  */
  const [cases, unsorted, arrivals] = await Promise.all([
    listShadeCases(),
    countUnsortedPhotos(),
    listArrivingToday(),
  ]);

  return (
    <ShadeHome
      cases={cases}
      clinicName={session.orgName ?? ''}
      keyword=""
      clinicOrgId={session.orgId ?? undefined}
      unsortedCount={unsorted}
      /*
        ★★ 건수를 **홈에서 바로** 보여 줍니다. 누르지 않고도 답이
          나오는 것이 제일 빠릅니다 — 아침에 폰을 드는 이유가
          "오늘 뭐 오나" 하나입니다.
      */
      arrivalStates={arrivals.map((a) => a.state)}
    />
  );
}
