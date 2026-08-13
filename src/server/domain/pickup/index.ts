// =========================================================
// 놓을 위치: src/server/domain/pickup/index.ts
//
// 수거요청이 HOME 목록에 언제까지 남아 있는가. (사용자 결정 2026-08-13)
//   "수거요청 리스트 클릭시 해당 정보를 확인하고 '배송' 상태 전까지는
//    리스트 업이 유지되어있으면 해"
//
// ★ 전에는 기공소가 '수거완료' 를 누르는 순간 목록에서 사라졌습니다.
//   그런데 물건을 받아 온 것과 일이 끝난 것은 다릅니다. 치과 쪽에서는
//   "우리 보철물 가져갔나?" 를 확인할 길이 사라지고, 디자인센터는
//   그 건이 지금 어디쯤인지 이 카드에서 놓칩니다.
//   **물건이 나가는 순간(배송)까지** 남겨 두면 셋 다 같은 것을 봅니다.
//
// ★ 그래서 상태 글자가 함께 필요합니다.
//   남아 있기만 하고 '수거대기' 인지 '수거완료' 인지 모르면, 목록이
//   "아직 안 가져갔다" 는 거짓말을 합니다.
// =========================================================

import type { OrderStatus } from '../order-status';

/** 여기까지 오면 물건이 이미 나갔습니다 — 수거는 끝난 이야기입니다 */
const SHIPPED: OrderStatus[] = ['shipping', 'completed', 'cancelled'];

/** 더 이상 기다릴 것이 없는 수거 */
const CLOSED_PICKUP = ['cancelled'];

/**
 * 이 수거요청을 HOME 수거요청 카드에 세울 것인가.
 *
 * @param pickupStatus open · assigned · done · cancelled
 * @param orderStatus  딸린 주문의 상태. 주문 없이 만든 수거면 null
 */
export function pickupStillListed(
  pickupStatus: string,
  orderStatus: OrderStatus | null,
): boolean {
  if (CLOSED_PICKUP.includes(pickupStatus)) return false;

  /*
    ★ 주문이 없는 수거는 기준으로 삼을 단계가 없습니다.
      (모델·인상체만 따로 가져가는 경우) 그때는 예전 규칙 그대로
      '아직 안 가져간 것' 까지만 셉니다.
  */
  if (orderStatus === null) return pickupStatus === 'open' || pickupStatus === 'assigned';

  return !SHIPPED.includes(orderStatus);
}

/**
 * 아직 물건이 안 넘어온 상태들.
 *
 * ★ `open` 만 세면 안 됩니다. `assigned` 는 기공소가 택배사에 접수만
 *   해 둔 것이라 **물건은 아직 치과에 있습니다.** 이 목록을 쓰는 곳이
 *   셋인데(수거완료 버튼·제작 시작 차단·남은 수거 세기) 한 곳만
 *   빠뜨려도 물건 없이 제작이 시작됩니다.
 */
export const PENDING_PICKUP: readonly string[] = ['open', 'assigned'];

/** 아직 물건을 안 가져갔는가 — 카드에서 눈에 띄게 할지 정합니다 */
export function pickupWaiting(pickupStatus: string): boolean {
  return PENDING_PICKUP.includes(pickupStatus);
}

// ---------- 누가 수거완료를 누르는가 (사용자 지적 2026-08-13) ----------

/**
 * '수거완료' 를 누를 수 있는가.
 *
 * ★ **조직의 종류가 아니라 이 주문에서 맡은 자리**로 정합니다.
 *   전에는 `orgType === 'lab'` 로 봤습니다. 그런데 자사 제작이면
 *   디자인센터가 기공소 자리를 겸합니다 — 물건은 디자인센터가
 *   받는데 계정 종류가 'design_center' 라서 **아무도 못 눌렀습니다.**
 *   수거가 안 닫히면 제작 시작도 막히므로, 그 주문은 그대로 굳습니다.
 *
 * ★ 치과는 절대 못 누릅니다.
 *   물건을 **보내는** 쪽입니다. 받았다고 말할 수 있는 사람은 받은
 *   사람뿐입니다. 보내는 쪽이 도착을 선언하면 그 기록은 아무 값이
 *   없습니다. 치과에는 지금 어디쯤인지만 보여 줍니다.
 *
 * ★ 아직 기공소가 안 정해진 수거는 아무도 못 누릅니다.
 *   labOrgId 가 비어 있으면 받을 사람이 정해지지 않았다는 뜻입니다
 *   (아날로그 주문이 접수되자마자 만들어지는 경우). 배정되면
 *   pickup_fill_lab 트리거가 채우고, 그때부터 눌립니다.
 */
export function canCompletePickup(args: {
  /** 지금 보고 있는 사람의 조직 */
  viewerOrgId: string | null;
  /** 이 수거를 맡은 기공소 */
  labOrgId: string | null;
  /** 수거 상태 — 이미 닫힌 것은 다시 못 누릅니다 */
  pickupStatus: string;
}): boolean {
  if (!args.viewerOrgId || !args.labOrgId) return false;
  if (!pickupWaiting(args.pickupStatus)) return false;

  return args.viewerOrgId === args.labOrgId;
}
