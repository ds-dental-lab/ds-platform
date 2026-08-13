// =========================================================
// 놓을 위치: src/app/design/orders/[orderId]/page.tsx
//
// 주문상세 (디자인센터). (설계서 §9.2)
//   치과 화면과 같은 틀을 쓰되, 어느 치과의 의뢰인지와
//   기공소 배정 · 디자인 파일 업로드가 더 붙습니다.
// =========================================================

import OrderUnavailable from '@/components/order/OrderUnavailable';
import { orderProgress } from '@/server/domain/progress';
import { getOrderAbsence, getOrderDetail, listPartnerLabs } from '@/server/repositories/order';
import { getImplantCatalog } from '@/server/repositories/implant';
import { getProsthesisCatalog } from '@/server/repositories/prosthesis';
import { getRepairContext } from '@/server/repositories/repair';
import { listPickupsForOrder } from '@/server/repositories/pickup';
import { pickupWaiting } from '@/server/domain/pickup';
import RepairPanel from '@/components/order/RepairPanel';
import PickupCard from '@/components/order/PickupCard';
import { listOrderMessages } from '@/server/repositories/order-message';
import { getHolidayMap } from '@/server/repositories/holiday';
import { todayInKst } from '@/server/domain/week';
import { canUploadDesignFile } from '@/server/domain/order-status';
import OrderDetailScreen from '@/components/order/OrderDetailScreen';
import OrderAdjustPanel from '@/components/order/OrderAdjustPanel';
import { getOrderMoney } from '@/server/repositories/order-money';
import { getSession } from '@/server/policies/session';
import { canSeeMoney, canManageMembers, type MemberRole } from '@/server/domain/member';
import { checkSeat, checkAssign, assignable } from '@/server/domain/designer';
import { listSeatOptions } from '@/server/repositories/member';
import DesignerAssignSelect from '@/components/order/DesignerAssignSelect';
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

  /*
    ★ 404 대신 이유를 적습니다 (사용자 요청 2026-08-13).
      지워졌거나 우리 조직 것이 아니거나인데, 둘 다 404 로 보이면
      HOME 목록에서 눌러 들어온 사람은 뭘 잘못했는지 모릅니다.
  */
  if (!order) {
    return (
      <OrderUnavailable
        reason={await getOrderAbsence(orderId)}
        ordersPath="/design/orders"
      />
    );
  }

  /*
    ★ 휴일도 **함께** 부릅니다.
      다른 것을 하나도 안 쓰는데 줄 맨 뒤에서 혼자 기다리고 있었습니다.
      주문등록·주문상세·수정 네 화면이 모두 같은 모양이었습니다.
  */
  const [labs, implantCatalog, messages, prosthesisCatalog, holidays, repair, pickups] =
    await Promise.all([
      listPartnerLabs(),
      getImplantCatalog(),
      listOrderMessages(orderId),
      // 꺼진 제품도 함께 — 지난 주문이 그 조합을 가리킵니다
      getProsthesisCatalog({ includeInactive: true }),
      // 쉬는 날은 요청시한 달력에서 빠집니다 (디자인센터 휴일 화면이 쥡니다)
      getHolidayMap(),
      // 리페어 칸 — 여기 함께 넣어야 왕복이 안 늘어납니다
      getRepairContext(order),
    /*
      ★ 자사 제작이면 물건이 **여기로** 옵니다 (사용자 지적 2026-08-13).
        디자인센터가 기공소 자리를 겸하는데 이 화면에 수거 줄이 아예
        없어서, 자사 제작 건은 아무도 수거완료를 못 눌렀습니다.
        수거가 안 닫히면 제작 시작도 막혀 그 주문은 그대로 굳습니다.
    */
      listPickupsForOrder(orderId),
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
  const missingDesignFile =
    order.status === 'designing' && designFiles.length === 0
      ? '디자인 파일을 1개 이상 올려야 제작주문을 넣을 수 있습니다'
      : undefined;

  /*
    ★ 몽키스패너는 **관리자만** 봅니다 (사용자 결정 2026-08-12).
      디자인센터 사용자(디자이너)에게는 금액이 아예 안 보입니다.
      화면에서 빼는 것과 못 고치는 것은 다르므로, 저장은 서버가 또 봅니다
      (submitAdjustItem 이 디자인센터인지 봅니다).
  */
  const session = await getSession();
  const money = canSeeMoney(session?.role as MemberRole | null)
    ? await getOrderMoney(order.id)
    : null;

  /*
    ★ 한 주문은 한 디자이너가 만듭니다 (사용자 결정 2026-08-12).
      실제로 막는 곳은 세 군데입니다 — 여기(화면), changeOrderStatus(서버),
      order_file_insert 정책(DB). 화면에서 감추는 것만으로는 부족합니다.
  */
  const viewer = {
    userId: session?.user.id ?? '',
    isManager: canManageMembers(session?.role as MemberRole | null),
  };

  const seat = { designerId: order.designer_user_id, designerName: order.designer_name };
  const mySeat = checkSeat(seat, viewer);

  // 담당 칸을 고칠 수 있는 사람에게만 사람 목록을 내려보냅니다
  const canAssignDesigner =
    assignable(order.status) && checkAssign(seat, viewer, viewer.userId).ok;

  /*
    ★ 디자이너에게도 **전체 목록**을 줍니다 (사용자 결정 2026-08-12).
      "가입되어 활성화된 유저들끼리 담당자 이전을 할 수 있다."
      살아 있는 우리 조직 사람인지는 서버가 다시 봅니다
      (submitAssignDesigner).
  */
  const seats = canAssignDesigner ? await listSeatOptions() : [];

  /*
    ★ 남의 주문이면 그 이유가 먼저입니다.
      "디자인 파일을 올리세요" 라고 안내해 놓고 올리려 하면 막히는 것이
      제일 나쁩니다. 못 넘기는 진짜 이유를 먼저 적습니다.
  */
  /*
    ★ 자사 제작이면 수거도 여기서 막습니다 (2026-08-13).
      기공소 화면에만 있던 안내인데, 자사 제작은 그 화면을 안 지납니다 —
      물건을 못 받았는데 제작 시작 버튼만 열려 있었습니다.
  */
  const waitingPickup =
    order.roles.includes('lab') && pickups.some((p) => pickupWaiting(p.status))
      ? '수거를 마친 뒤 제작을 시작할 수 있습니다'
      : undefined;

  const forwardBlockedReason = mySeat.ok
    ? (missingDesignFile ?? waitingPickup)
    : mySeat.reason;

  // 수거 줄과 스패너가 같은 자리에 섭니다. 둘 다 없으면 자리도 안 냅니다
  const showPickup = pickups.length > 0;
  const hasExtra = showPickup || Boolean(money);

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
      issueSlot={
        <RepairPanel repair={repair} isRepair={order.is_repair} orderPath="/design/orders" />
      }
      /*
        ★ 읽기만 하는 한 줄입니다 (사용자 결정 2026-08-12).
          조정은 스패너 안으로 들어갔고, 여기서는 숫자만 봅니다.
          money 가 없으면(=디자이너) 줄 자체가 안 나옵니다.
      */
      costLine={
        money ? (
          <span className="flex items-center gap-3 tabular-nums">
            <span>
              기공수가{' '}
              <b className="font-bold text-[#1A2130]">
                {money.items
                  .reduce((sum, i) => sum + i.clinicAmount + i.clinicAdjust, 0)
                  .toLocaleString('ko-KR')}
              </b>
            </span>
            {/* ★ 자사 제작은 지급이 없습니다 (설계서 Q-6) */}
            {!money.inHouse && (
              <span>
                기공원가{' '}
                <b className="font-bold text-[#1A2130]">
                  {money.items
                    .reduce((sum, i) => sum + i.labAmount + i.labAdjust, 0)
                    .toLocaleString('ko-KR')}
                </b>
              </span>
            )}
          </span>
        ) : null
      }
      designerSlot={
        <DesignerAssignSelect
          orderId={order.id}
          current={order.designer_user_id}
          currentName={order.designer_name}
          seats={seats}
          editable={canAssignDesigner}
          isMine={Boolean(order.designer_user_id) && order.designer_user_id === viewer.userId}
        />
      }
      /*
        ★ 파일이 곧 작업입니다.
          남이 맡은 주문에는 올리는 칸 자체를 안 엽니다. 실제 차단은
          order_file_insert 정책이 합니다 — 업로드는 브라우저에서 곧장
          저장소로 가므로, 화면만 감추면 막은 것이 아닙니다.
      */
      designSlot={
        canUploadDesignFile(order.status, 'design_center') && mySeat.ok ? (
          <DesignFileUpload orderId={order.id} />
        ) : null
      }
      /*
        ★ 디자인센터도 리메이크·리페어를 대신 넣습니다 (사용자 결정 2026-08-12).
          "치과에서 할 줄 모른다며 문의 전화가 오면 우리가 대신해야 한다."
          주문은 그대로 그 치과의 것이고, 넣은 사람만 created_by 에 남습니다.
      */
      extraSlot={
        hasExtra ? (
          <div className="space-y-3.5">
            {/*
              ★ 버튼은 **기공소 자리를 맡았을 때만** 붙습니다.
                남의 기공소에 맡긴 건이면 여기서도 상태만 봅니다 —
                물건은 그쪽으로 갔으니 받았다고 말할 사람은 그쪽입니다.
            */}
            {showPickup && (
              <PickupCard pickups={pickups} canComplete={order.roles.includes('lab')} />
            )}
            {money && <OrderAdjustPanel money={money} patientLabel={order.patient_label} />}
          </div>
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
            basePath="/design/orders"
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
            basePath="/design/orders"
          />
        </>
      }
    />
  );
}
