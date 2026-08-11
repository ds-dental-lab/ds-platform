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

  const designFiles = order.files.filter((f) => f.kind === 'design');

  /*
    ★ 디자인 파일 없이는 제작주문을 넘길 수 없습니다.
      기공소는 그 파일로 물건을 만듭니다. 빈손으로 넘기면 기공소가
      주문을 받아 놓고 아무것도 못 하는 상태로 멈춥니다.
      서비스 계층(requiresDesignFile)이 실제로 막고, 여기서는
      **누르기 전에** 이유를 보여 줍니다.
  */
  const forwardBlockedReason =
    order.status === 'designing' && designFiles.length === 0
      ? '디자인 파일을 1개 이상 올려야 제작주문을 넣을 수 있습니다'
      : undefined;

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
      forwardBlockedReason={forwardBlockedReason}
      designSlot={
        canUploadDesignFile(order.status, 'design_center') ? (
          <DesignFileUpload orderId={order.id} />
        ) : null
      }
    />
  );
}
