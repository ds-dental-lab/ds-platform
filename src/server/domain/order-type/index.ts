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
