// =========================================================
// 놓을 위치: src/app/clinic/orders/[orderId]/page.tsx
//
// 주문상세 (치과). (설계서 §9.1)
//   화면은 OrderDetailScreen 하나로 세 섹터가 나눠 씁니다.
//   RLS 가 이 조직 주문이 아니면 걸러줍니다 — 그때는 404 가 아니라
//   왜 못 여는지를 적은 화면을 보여 줍니다 (OrderUnavailable).
//
// ★ 치과에는 치과 이름을 보이지 않습니다. 자기 이름을 볼 이유가 없습니다.
// =========================================================

import OrderUnavailable from '@/components/order/OrderUnavailable';
import { orderProgress, progressNote } from '@/server/domain/progress';
import { getOrderAbsence, getOrderDetail } from '@/server/repositories/order';
import { getImplantCatalog } from '@/server/repositories/implant';
import { listOrderMessages } from '@/server/repositories/order-message';
import { getProsthesisCatalog } from '@/server/repositories/prosthesis';
import { getHolidayMap } from '@/server/repositories/holiday';
import { todayInKst } from '@/server/domain/week';
import { defaultDueDate } from '@/server/domain/due-date';
import OrderDetailScreen from '@/components/order/OrderDetailScreen';
import RepairRequest from '@/components/order/RepairRequest';
import RemakeRequest from '@/components/order/RemakeRequest';
import RescanBar from '@/components/order/RescanBar';
import RepairPanel from '@/components/order/RepairPanel';
import { getRepairContext } from '@/server/repositories/repair';
import { listPickupsForOrder } from '@/server/repositories/pickup';

export const dynamic = 'force-dynamic';

interface OrderDetailPageProps {
  params: Promise<{ orderId: string }>;
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
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
        ordersPath="/clinic/orders"
      />
    );
  }

  const today = todayInKst();

  /*
    ★ 휴일도 **함께** 부릅니다.
      전에는 Promise.all 앞에서 혼자 기다렸습니다. 다른 것을 하나도
      안 쓰는데 줄을 세워 둔 셈이라, 왕복 하나가 고스란히 화면 뜨는
      시간에 더해졌습니다.
  */
  const [implantCatalog, messages, prosthesisCatalog, holidays, repair, pickups] =
    await Promise.all([
      getImplantCatalog(),
      listOrderMessages(orderId),
      // 지난 주문이 가리키는 조합은 꺼져도 이름을 잃지 않아야 합니다
      getProsthesisCatalog({ includeInactive: true }),
      // 쉬는 날은 요청시한 달력에서 빠집니다 (디자인센터 휴일 화면이 쥡니다)
      getHolidayMap(),
      // 리페어 칸 — 여기 함께 넣어야 왕복이 안 늘어납니다
      getRepairContext(order),
      /*
        ★ 수거 카드를 치과에는 **안 보여 줍니다** (사용자 지적 2026-08-13 —
          "치과는 작업하는 사람들이 아니고 고객이니깐 과정만 확인할뿐").
          수거가 어디쯤인지는 진행 막대의 수거대기·수거중·수거완료 칸이
          이미 말합니다. 같은 것을 카드로 또 펴면 치과 화면이 작업자용
          화면처럼 보입니다. 여기서는 막대를 그리는 재료로만 씁니다.
      */
      listPickupsForOrder(orderId),
    ]);

  const progress = orderProgress({
    status: order.status,
    isRepair: order.is_repair,
    pickups,
  });

  return (
    <OrderDetailScreen
      order={order}
      sector="clinic"
      today={today}
      implantCatalog={implantCatalog}
      prosthesisCatalog={prosthesisCatalog}
      messages={messages}
      showClinic={false}
      /*
        ★ 진행 막대 (사용자 요청 2026-08-13).
          머리줄의 상태는 지금 어디인지만 말합니다. 수거는 아예 주문
          상태에 안 담기므로, 둘을 합쳐야 과정이 보입니다.
      */
      progress={progress}
      /*
        ★ 치과에게는 칸 이름만으로 부족합니다 (사용자 지적 2026-08-13).
          '수거대기' 는 우리가 일을 나누려고 만든 이름입니다. 지금 무슨
          일이 벌어지는 중인지 고객의 말로 한 줄 적어 줍니다.
      */
      progressNote={progressNote(progress)}
      issueSlot={
        <RepairPanel
          repair={repair}
          isRepair={order.is_repair}
          orderPath="/clinic/orders"
          /* 치과는 보낸 쪽입니다 — "들어온 건" 이 아니라 "요청하신 내용" */
          audience="requester"
        />
      }
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
            today={today}
            defaultDue={defaultDueDate(today, holidays)}
            holidays={holidays}
            prosthesisCatalog={prosthesisCatalog}
            roles={order.roles}
          />
          <RepairRequest
            orderId={order.id}
            status={order.status}
            items={order.items}
            prosthesisCatalog={prosthesisCatalog}
            roles={order.roles}
            today={today}
            defaultDue={defaultDueDate(today, holidays)}
            holidays={holidays}
          />
        </>
      }
    />
  );
}
