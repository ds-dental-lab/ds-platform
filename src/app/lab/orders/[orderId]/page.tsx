// =========================================================
// 놓을 위치: src/app/lab/orders/[orderId]/page.tsx
//
// 주문상세 (기공소). (설계서 §9.3)
//
// 치과·디자인센터 화면과 다른 점.
//   1. 환자 이름이 마스킹 값입니다 (§8.5) — 저장소가 이미 바꿔서 줍니다
//   2. 의뢰 치과는 보여줍니다 — 완성품을 여기로 배송합니다.
//      RLS 가 "배정받은 주문의 치과"만 열어 줍니다.
//   3. 수거가 안 끝났으면 제작을 시작하지 못합니다 — 물건이 아직 없습니다
// =========================================================

import { notFound } from 'next/navigation';
import { getOrderDetail } from '@/server/repositories/order';
import { listPickupsForOrder } from '@/server/repositories/pickup';
import { getImplantCatalog } from '@/server/repositories/implant';
import { getProsthesisCatalog } from '@/server/repositories/prosthesis';
import { listOrderMessages } from '@/server/repositories/order-message';
import { todayInKst } from '@/server/domain/week';
import OrderDetailScreen from '@/components/order/OrderDetailScreen';
import PickupCard from '@/components/order/PickupCard';

export const dynamic = 'force-dynamic';

interface LabOrderDetailPageProps {
  params: Promise<{ orderId: string }>;
}

export default async function LabOrderDetailPage({ params }: LabOrderDetailPageProps) {
  const { orderId } = await params;
  const order = await getOrderDetail(orderId);
  if (!order) notFound();

  const [implantCatalog, pickups, messages, prosthesisCatalog] = await Promise.all([
    getImplantCatalog(),
    listPickupsForOrder(orderId),
    listOrderMessages(orderId),
    // 꺼진 제품도 함께 — 지난 주문이 그 조합을 가리킵니다
    getProsthesisCatalog({ includeInactive: true }),
  ]);

  return (
    <OrderDetailScreen
      order={order}
      sector="lab"
      today={todayInKst()}
      implantCatalog={implantCatalog}
      prosthesisCatalog={prosthesisCatalog}
      messages={messages}
      forwardBlockedReason={
        pickups.some((p) => p.status === 'open')
          ? '수거를 마친 뒤 제작을 시작할 수 있습니다'
          : undefined
      }
      extraSlot={pickups.length > 0 ? <PickupCard pickups={pickups} /> : null}
    />
  );
}
