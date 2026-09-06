// =========================================================
// 놓을 위치: src/app/(mobile)/m/orders/[orderId]/page.tsx
//
// 센터 폰 — 주문 한 건. 전화 받으면서 답할 것만 보여 줍니다.
// (사용자 요청 2026-09-06)
// =========================================================

import { notFound } from 'next/navigation';
import { requireSector } from '@/server/policies/session';
import { getOrderDetail } from '@/server/repositories/order';
import { getProsthesisCatalog } from '@/server/repositories/prosthesis';
import MobileOrderDetail from '@/components/center/MobileOrderDetail';

export const dynamic = 'force-dynamic';

export default async function MobileOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  await requireSector('design_center');
  const { orderId } = await params;

  // ★ 둘은 서로를 안 씁니다 — 함께 보냅니다
  const [order, catalog] = await Promise.all([getOrderDetail(orderId), getProsthesisCatalog()]);
  if (!order) notFound();

  return <MobileOrderDetail order={order} catalog={catalog} />;
}
