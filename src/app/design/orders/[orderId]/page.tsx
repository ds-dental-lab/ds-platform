// =========================================================
// 놓을 위치: src/app/design/orders/[orderId]/page.tsx
//
// 주문상세 (디자인센터). (설계서 §9.2)
//   치과 화면과 같은 틀을 쓰되, 어느 치과의 의뢰인지와
//   기공소 배정 · 디자인 파일 업로드가 더 붙습니다.
// =========================================================

import { notFound } from 'next/navigation';
import { getOrderDetail, listPartnerLabs } from '@/server/repositories/order';
import { getImplantCatalog } from '@/server/repositories/implant';
import { getProsthesisCatalog } from '@/server/repositories/prosthesis';
import { listOrderMessages } from '@/server/repositories/order-message';
import { todayInKst } from '@/server/domain/week';
import { canUploadDesignFile } from '@/server/domain/order-status';
import OrderDetailScreen from '@/components/order/OrderDetailScreen';
import DesignFileUpload from '@/components/order/DesignFileUpload';

export const dynamic = 'force-dynamic';

interface OrderDetailPageProps {
  params: Promise<{ orderId: string }>;
}

export default async function DesignOrderDetailPage({ params }: OrderDetailPageProps) {
  const { orderId } = await params;
  const order = await getOrderDetail(orderId);
  if (!order) notFound();

  const [labs, implantCatalog, messages, prosthesisCatalog] = await Promise.all([
    listPartnerLabs(),
    getImplantCatalog(),
    listOrderMessages(orderId),
    // 꺼진 제품도 함께 — 지난 주문이 그 조합을 가리킵니다
    getProsthesisCatalog({ includeInactive: true }),
  ]);

  return (
    <OrderDetailScreen
      order={order}
      sector="design_center"
      today={todayInKst()}
      implantCatalog={implantCatalog}
      prosthesisCatalog={prosthesisCatalog}
      messages={messages}
      labs={labs}
      showCost
      labName={order.in_house ? '자사 제작' : order.lab_name}
      designSlot={
        canUploadDesignFile(order.status, 'design_center') ? (
          <div className="mb-3">
            <DesignFileUpload orderId={order.id} />
          </div>
        ) : null
      }
    />
  );
}
