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

import OrderUnavailable from '@/components/order/OrderUnavailable';
import { orderProgress } from '@/server/domain/progress';
import { getOrderAbsence, getOrderDetail } from '@/server/repositories/order';
import { listPickupsForOrder } from '@/server/repositories/pickup';
import { getImplantCatalog } from '@/server/repositories/implant';
import { getProsthesisCatalog } from '@/server/repositories/prosthesis';
import { listOrderMessages } from '@/server/repositories/order-message';
import { todayInKst } from '@/server/domain/week';
import OrderDetailScreen from '@/components/order/OrderDetailScreen';
import WorkOrderButton from '@/components/order/WorkOrderButton';
import { canPrintWorkOrder } from '@/server/domain/order-status';
import PickupCard from '@/components/order/PickupCard';
import RepairPanel from '@/components/order/RepairPanel';
import { getRepairContext } from '@/server/repositories/repair';
import { pickupWaiting } from '@/server/domain/pickup';

export const dynamic = 'force-dynamic';

interface LabOrderDetailPageProps {
  params: Promise<{ orderId: string }>;
}

export default async function LabOrderDetailPage({ params }: LabOrderDetailPageProps) {
  const { orderId } = await params;
  const order = await getOrderDetail(orderId);

  /*
    ★ 404 대신 이유를 적습니다 (사용자 요청 2026-08-13).
      지워졌거나 우리 조직 것이 아니거나인데, 둘 다 404 로 보이면
      HOME 목록에서 눌러 들어온 사람은 뭘 잘못했는지 모릅니다.
  */
  if (!order) {
    return (
      <OrderUnavailable
        reason={await getOrderAbsence(orderId)}
        ordersPath="/lab/orders"
      />
    );
  }

  const [implantCatalog, pickups, messages, prosthesisCatalog, repair] = await Promise.all([
    getImplantCatalog(),
    listPickupsForOrder(orderId),
    listOrderMessages(orderId),
    // 꺼진 제품도 함께 — 지난 주문이 그 조합을 가리킵니다
    getProsthesisCatalog({ includeInactive: true }),
    /*
      ★ 기공소가 제일 절실한 칸입니다.
        무엇을 어떻게 고쳐 달라는 글을 못 보면, 물건만 받아 놓고
        손을 못 댑니다.
    */
    getRepairContext(order),
  ]);

  return (
    <OrderDetailScreen
      order={order}
      sector="lab"
      today={todayInKst()}
      implantCatalog={implantCatalog}
      prosthesisCatalog={prosthesisCatalog}
      messages={messages}
      /*
        ★ 진행 막대 (사용자 요청 2026-08-13).
          머리줄의 상태는 지금 어디인지만 말합니다. 수거는 아예 주문
          상태에 안 담기므로, 둘을 합쳐야 과정이 보입니다.
      */
      progress={orderProgress({
        status: order.status,
        isRepair: order.is_repair,
        pickups,
      })}
      forwardBlockedReason={
        pickups.some((p) => pickupWaiting(p.status))
          ? '수거를 마친 뒤 제작을 시작할 수 있습니다'
          : undefined
      }
      extraSlot={
        pickups.length > 0 ? (
          // 기공소 화면입니다 — 물건이 여기로 옵니다
          <PickupCard pickups={pickups} canComplete />
        ) : null
      }
      /*
        ★ 기공의뢰서 (사용자 요청 2026-08-15).
          박스에 붙여 두는 종이입니다 — 기공소가 이 기능의 주인입니다.
          관리자·사용자를 안 가립니다.
      */
      sheetSlot={
        canPrintWorkOrder(order.roles) ? (
          <WorkOrderButton href={`/lab/orders/${order.id}/work-order`} />
        ) : null
      }
      issueSlot={
        <RepairPanel repair={repair} isRepair={order.is_repair} orderPath="/lab/orders" />
      }
    />
  );
}
