// =========================================================
// 놓을 위치: src/app/clinic/orders/[orderId]/page.tsx
//
// 주문상세 (치과). (설계서 §9.1)
//   화면은 OrderDetailScreen 하나로 세 섹터가 나눠 씁니다.
//   RLS 가 이 조직 주문이 아니면 걸러주므로, 못 찾으면 404 입니다.
//
// ★ 치과에는 치과 이름을 보이지 않습니다. 자기 이름을 볼 이유가 없습니다.
// =========================================================

import { notFound } from 'next/navigation';
import { getOrderDetail } from '@/server/repositories/order';
import { getImplantCatalog } from '@/server/repositories/implant';
import { listOrderMessages } from '@/server/repositories/order-message';
import { todayInKst } from '@/server/domain/week';
import OrderDetailScreen from '@/components/order/OrderDetailScreen';
import RepairRequest from '@/components/order/RepairRequest';
import RemakeRequest from '@/components/order/RemakeRequest';
import RescanBar from '@/components/order/RescanBar';

export const dynamic = 'force-dynamic';

interface OrderDetailPageProps {
  params: Promise<{ orderId: string }>;
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { orderId } = await params;
  const order = await getOrderDetail(orderId);
  if (!order) notFound();

  const [implantCatalog, messages] = await Promise.all([
    getImplantCatalog(),
    listOrderMessages(orderId),
  ]);

  return (
    <OrderDetailScreen
      order={order}
      sector="clinic"
      today={todayInKst()}
      implantCatalog={implantCatalog}
      messages={messages}
      showClinic={false}
      scanSlot={
        order.status === 'rescan' ? (
          <RescanBar
            orderId={order.id}
            scanFiles={order.files.filter((f) => f.kind !== 'design')}
          />
        ) : null
      }
      barSlot={
        <>
          <RemakeRequest
            orderId={order.id}
            status={order.status}
            items={order.items}
            scanFiles={order.files.filter((f) => f.kind !== 'design')}
          />
          <RepairRequest orderId={order.id} status={order.status} items={order.items} />
        </>
      }
    />
  );
}
