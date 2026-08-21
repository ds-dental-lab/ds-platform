// =========================================================
// 놓을 위치: src/app/(mobile)/m/[orderId]/page.tsx
//
// S2 — 케이스 상세 + S3 카메라. (명세서 SPEC_shade-photo)
//
// ★ 한 페이지에 둡니다. 상세에서 '쉐이드 촬영' 을 누르면 카메라가
//   덮습니다 — 화면을 옮기면 그 사이에 카메라 권한이 다시 뜨고,
//   뒤로가기가 카메라를 지나 홈까지 가 버립니다.
// =========================================================

import { notFound } from 'next/navigation';
import { getShadeCase } from '@/server/repositories/shade-photo';
import ShadeCaseScreen from '@/components/shade/ShadeCaseScreen';

export const dynamic = 'force-dynamic';

export default async function MobileCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ attached?: string }>;
}) {
  const { orderId } = await params;
  const { attached } = await searchParams;

  const found = await getShadeCase(orderId);
  if (!found) notFound();

  /*
    ★ 미분류함에서 붙이고 오면 ?attached=n 이 붙습니다. 그때는 바로
      '첨부 완료' 를 보여 줍니다 — 어디로 갔는지 모른 채 끝나면
      다음에도 못 믿고 카톡을 한 번 더 보냅니다.
  */
  const justAttached = Number(attached);

  return (
    <ShadeCaseScreen
      data={found}
      attached={Number.isFinite(justAttached) && justAttached > 0 ? justAttached : 0}
    />
  );
}
