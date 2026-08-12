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

/** 아직 물건을 안 가져갔는가 — 카드에서 눈에 띄게 할지 정합니다 */
export function pickupWaiting(pickupStatus: string): boolean {
  return pickupStatus === 'open' || pickupStatus === 'assigned';
}
