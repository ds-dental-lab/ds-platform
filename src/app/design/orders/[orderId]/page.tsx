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
import RemakeRequest from '@/components/order/RemakeRequest';
import RepairRequest from '@/components/order/RepairRequest';
import { defaultDueDate } from '@/server/domain/due-date';

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

  const today = todayInKst();
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
      today={today}
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
      /*
        ★ 디자인센터도 리메이크·리페어를 대신 넣습니다 (사용자 결정 2026-08-12).
          "치과에서 할 줄 모른다며 문의 전화가 오면 우리가 대신해야 한다."
          주문은 그대로 그 치과의 것이고, 넣은 사람만 created_by 에 남습니다.
      */
      barSlot={
        <>
          <RemakeRequest
            orderId={order.id}
            status={order.status}
            items={order.items}
            scanFiles={order.files.filter((f) => f.kind !== 'design')}
            today={today}
            defaultDue={defaultDueDate(today)}
            prosthesisCatalog={prosthesisCatalog}
            roles={order.roles}
            basePath="/design/orders"
          />
          <RepairRequest
            orderId={order.id}
            status={order.status}
            items={order.items}
            prosthesisCatalog={prosthesisCatalog}
            roles={order.roles}
            today={today}
            defaultDue={defaultDueDate(today)}
            basePath="/design/orders"
          />
        </>
      }
    />
  );
}
