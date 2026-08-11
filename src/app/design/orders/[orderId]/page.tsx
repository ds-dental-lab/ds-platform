// =========================================================
// 놓을 위치: src/app/design/orders/[orderId]/page.tsx
//
// 주문상세 (디자인센터). (설계서 §9.2)
//   치과 화면과 같은 틀을 쓰되, 어느 치과의 의뢰인지와
//   기공소 배정 · 디자인 파일 업로드가 더 붙습니다.
// =========================================================

import { notFound } from 'next/navigation';
import { getOrderDetail, listStatusHistory, listPartnerLabs } from '@/server/repositories/order';
import { getImplantCatalog } from '@/server/repositories/implant';
import { listOrderMessages } from '@/server/repositories/order-message';
import { todayInKst } from '@/server/domain/week';
import { canUploadDesignFile } from '@/server/domain/order-status';
import OrderDetailScreen from '@/components/order/OrderDetailScreen';
import OrderHistory from '@/components/order/OrderHistory';
import DesignFileUpload from '@/components/order/DesignFileUpload';

export const dynamic = 'force-dynamic';

interface OrderDetailPageProps {
  params: Promise<{ orderId: string }>;
}

export default async function DesignOrderDetailPage({ params }: OrderDetailPageProps) {
  const { orderId } = await params;
  const order = await getOrderDetail(orderId);
  if (!order) notFound();

  const [history, labs, implantCatalog, messages] = await Promise.all([
    listStatusHistory(orderId),
    listPartnerLabs(),
    getImplantCatalog(),
    listOrderMessages(orderId),
  ]);

  return (
    <OrderDetailScreen
      order={order}
      sector="design_center"
      today={todayInKst()}
      implantCatalog={implantCatalog}
      messages={messages}
      labs={labs}
      designSlot={
        canUploadDesignFile(order.status, 'design_center') ? (
          <div className="mb-3">
            <DesignFileUpload orderId={order.id} />
          </div>
        ) : null
      }
      footerSlot={<OrderHistory rows={history} />}
    />
  );
}
