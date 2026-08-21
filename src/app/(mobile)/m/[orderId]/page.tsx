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
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const found = await getShadeCase(orderId);
  if (!found) notFound();

  return <ShadeCaseScreen data={found} />;
}
