// =========================================================
// 놓을 위치: src/server/domain/arrival/index.ts
//
// 오늘 도착할 보철물. (사용자 요청 2026-08-24 —
//   "핸드폰에서 버튼 하나로 오늘 도착할 보철물 리스트")
//
// ★★ **왜 폰인가.** 이건 아침에 서서 보는 화면입니다. 데스크톱의
//   배송조회는 한 주를 달력으로 펼쳐 놓은 것이라 앉아서 보는 것이고요.
//   진료실에서 알고 싶은 것은 딱 하나입니다 — **오늘 뭐 오나.**
//
// ★ 기준은 데스크톱과 **같은 요청시한(due_date)** 입니다. 여기서만
//   다른 날짜를 쓰면 두 화면이 서로 다른 말을 하게 됩니다.
//
// ★ 상태를 '접수·디자인·제작대기…' 그대로 보여 주지 않습니다.
//   진료실은 우리 공정을 몰라도 됩니다. 알고 싶은 것은
//   **왔나 · 오는 중인가 · 아직 만드는 중인가** 셋뿐입니다.
// =========================================================

import type { OrderStatus } from '@/server/domain/order-status';

export type ArrivalState = 'arrived' | 'onTheWay' | 'making';

export const ARRIVAL_LABEL: Record<ArrivalState, string> = {
  arrived: '도착',
  onTheWay: '오는 중',
  making: '만드는 중',
};

/**
 * 진료실 말로 옮깁니다.
 *
 * ★ 취소는 `null` — 목록에서 뺍니다. 오늘 안 오는 것이 맞습니다.
 */
export function arrivalStateOf(status: OrderStatus): ArrivalState | null {
  if (status === 'cancelled') return null;
  if (status === 'completed') return 'arrived';
  if (status === 'shipping') return 'onTheWay';

  return 'making';
}

/**
 * 목록에서의 자리.
 *
 * ★★ **아직 안 온 것이 위**입니다. 도착한 것은 이미 손에 있어서
 *   화면을 볼 이유가 없습니다. 오늘 오기로 했는데 아직 만들고 있는
 *   것이 제일 위여야 합니다 — 그것이 전화를 걸어야 하는 건입니다.
 */
export function arrivalRank(state: ArrivalState): number {
  if (state === 'making') return 0;
  if (state === 'onTheWay') return 1;

  return 2;
}

/**
 * 머리말에 세우는 한 줄.
 *
 * ★ 숫자만 세지 않습니다. '3건' 만으로는 그중 둘이 아직 안 왔다는
 *   것을 모릅니다 — 세어 보려면 목록을 끝까지 읽어야 합니다.
 */
export function arrivalSummary(states: readonly ArrivalState[]): string {
  if (states.length === 0) return '오늘 도착 예정이 없습니다';

  const left = states.filter((s) => s !== 'arrived').length;

  if (left === 0) return `${states.length}건 모두 도착했습니다`;

  return `${states.length}건 중 ${left}건이 아직입니다`;
}
