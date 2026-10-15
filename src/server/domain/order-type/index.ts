// =========================================================
// 놓을 위치: src/server/domain/order-type/index.ts
//
// 주문 종류가 딸고 오는 것들. (사용자 결정 2026-08-13)
//   "아날로그는 주문시 수거요청으로 가야해. 실제 임프로 작업을 진행하니깐"
//
// ★ 모델리스와 아날로그는 물건이 오가느냐가 다릅니다.
//   모델리스는 스캔 파일만 건너옵니다. 아날로그는 **인상체가 실제로
//   움직입니다** — 치과에서 뜬 임프레션을 누군가 가져가야 작업이
//   시작됩니다. 그래서 주문을 넣는 순간 수거요청이 함께 서야 합니다.
//   안 그러면 기공소는 주문만 받아 놓고 물건을 기다리는데, 기다리는
//   중이라는 사실이 어디에도 안 남습니다.
//
// ★ 딱지도 같이 답니다.
//   목록과 HOME 에 '아날로그' 이슈 칸이 이미 있는데, 여는 곳이 없어
//   영영 0이었습니다 (재스캔과 똑같은 사고였습니다 —
//   domain/order-status 의 issueOnTransition 참고).
//
// ★ 리페어의 수거와 종류가 다릅니다.
//   리페어는 **고칠 보철물**(prosthesis)을 가져오고, 아날로그는
//   **인상체**(impression)를 가져옵니다. 기공소가 무엇을 받으러
//   가는지 알아야 하므로 kind 를 나눕니다.
// =========================================================

export type OrderType = 'modelless' | 'analog' | 'with_model' | 'model_only' | 'repair';

export type PickupKind = 'prosthesis' | 'model' | 'impression';

/** 이 종류의 주문이 만들어질 때 함께 서야 하는 것들 */
export interface OrderTypeSetup {
  /** 열어야 할 이슈 딱지 */
  issue: 'analog' | null;
  /** 만들어야 할 수거요청의 종류 */
  pickup: PickupKind | null;
  /**
   * 수거요청 메모에 적을 말.
   *
   * ★ 무엇을 가져가는지는 kind 가 이미 말합니다 ('인상체').
   *   메모까지 '인상체 수거' 라고 쓰면 화면에 같은 말이 두 번 뜹니다.
   *   메모는 **왜** 인지를 적습니다.
   */
  pickupMemo: string;
  /** 딱지에 적을 말 */
  issueReason: string;
}

const NOTHING: OrderTypeSetup = {
  issue: null,
  pickup: null,
  pickupMemo: '',
  issueReason: '',
};

export function setupForOrderType(orderType: OrderType | null | undefined): OrderTypeSetup {
  if (orderType === 'analog') {
    return {
      issue: 'analog',
      pickup: 'impression',
      pickupMemo: '아날로그 주문입니다',
      issueReason: '아날로그 주문 — 인상체를 받아야 제작을 시작합니다',
    };
  }

  /*
    ★ with_model · model_only 는 아직 화면에 없습니다.
      주문등록에서 고를 수 있는 것은 모델리스와 아날로그 둘뿐이라,
      나머지는 규칙을 미리 정하지 않습니다. 실제로 쓰게 될 때
      "모델도 수거인가" 를 사용자에게 물어야 합니다.
  */
  return NOTHING;
}

/** 종류가 바뀌었을 때, 전에 달아 둔 것을 거둬야 하는가 */
export function needsTeardown(before: OrderType, after: OrderType): boolean {
  return setupForOrderType(before).pickup !== null && setupForOrderType(after).pickup === null;
}

// ---------- 고를 수 없는 주문 종류 ----------

/**
 * 이 주문이 **반드시** 따라야 하는 주문 종류. 고를 수 있으면 null.
 *
 * ★★ **FlowTemp(자동 출력 제품)가 하나라도 들면 모델리스뿐입니다**
 *   (사용자 요청 2026-10-15 — "아날로그 고를 수 없게"). 이 제품은 치과가
 *   올린 **스캔 파일**을 덴트버드에 넣어 설계하고 치과 프린터로 뽑습니다.
 *   인상체가 오가는 아날로그로 넣으면 설계할 스캔이 없고, 아날로그가
 *   여는 수거요청은 갈 물건이 없는 헛걸음이 됩니다.
 * ★ 제품에 물어봅니다(autoPipeline). 'auto_temp 면' 이라고 코드에 적지
 *   않습니다 — 자동 제품이 늘어도 이 규칙이 그대로 따라갑니다.
 */
export function lockedOrderType(autoPipelineFlags: boolean[]): OrderType | null {
  return autoPipelineFlags.some(Boolean) ? 'modelless' : null;
}

/**
 * 주문등록에서 **지금 고를 수 있는** 주문 종류.
 *
 * ★★ **아날로그는 아직 뺍니다** (사용자 결정 2026-10-15 — "아직 전 보철물이
 *   아날로그가 준비 안 되었어"). 인상체를 받아 작업하는 길이 갖춰지지 않았는데
 *   고를 수 있게 두면, 치과는 아날로그로 넣고 기공소는 받을 물건을 모르는
 *   채로 수거요청만 섭니다.
 * ★ 아날로그를 열 때는 **여기 한 줄**입니다 (`'analog'` 를 다시 넣기).
 *   화면(주문등록)과 서버(validateOrder)가 둘 다 이 목록을 봅니다.
 * ★ 아날로그 규칙들(수거요청·딱지, setupForOrderType)은 그대로 둡니다 —
 *   다시 열면 바로 돕니다.
 */
export const ORDERABLE_TYPES: OrderType[] = ['modelless'];

export function isOrderable(orderType: OrderType | null | undefined): boolean {
  return ORDERABLE_TYPES.includes(orderType ?? 'modelless');
}
