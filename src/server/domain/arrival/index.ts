// =========================================================
// 놓을 위치: src/server/domain/arrival/index.ts
//
// 오늘 받을 것. (사용자 요청 2026-08-24, 좁힘 2026-08-24)
//
// ★★ **이것은 배송추적이 아닙니다.** 택배 송장을 달 수 있는 구조가
//   없고, 날짜도 실은 '도착일' 이 아니라 **요청시한** 입니다 —
//   오늘까지 해 달라고 한 것입니다. 처음에 '오늘 도착' 이라고
//   이름 붙인 것이 틀렸습니다.
//
// ★★ 그래서 **한 가지 질문에만** 답하게 좁혔습니다 (사장님 지적) —
//   *오늘 것 중에 아직 안 온 게 있나.*
//
//   받은 것은 **안 세웁니다.** 「수령 완료」는 치과가 자기 손으로
//   누르는 것이라, 그것을 되돌려 보여 주는 것은 새 정보가 아닙니다.
//   목록에 섞이면 정작 봐야 할 줄이 그만큼 밀립니다.
//
// ★ 남는 값은 둘입니다 — 오늘 어느 환자 것이 오기로 했나(체어를
//   잡습니다), 그중 **아직 안 나간 것**(지금 전화할 건입니다).
//
// ★ 기준은 데스크톱 배송조회와 **같은 요청시한** 입니다. 여기서만
//   다른 날짜를 쓰면 두 화면이 서로 다른 말을 하게 됩니다.
//
// ★ 상태를 '접수·디자인·제작대기…' 그대로 보여 주지 않습니다.
//   진료실은 우리 공정을 몰라도 됩니다.
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

/** 아직 안 온 것인가. 목록에 세우는 것은 이것뿐입니다 */
export function isPending(state: ArrivalState): boolean {
  return state !== 'arrived';
}

/**
 * 목록에서의 자리.
 *
 * ★★ 오늘 오기로 했는데 **아직 만들고 있는 것**이 제일 위입니다 —
 *   그것이 전화를 걸어야 하는 건입니다. 나간 것은 기다리면 됩니다.
 */
export function arrivalRank(state: ArrivalState): number {
  if (state === 'making') return 0;
  if (state === 'onTheWay') return 1;

  return 2;
}

/**
 * 머리말에 세우는 한 줄.
 *
 * ★★ **남은 것만 셉니다.** 전에는 '3건 중 2건이 아직' 이었는데,
 *   앞의 3은 답이 아니라 계산거리였습니다 — 알고 싶은 것은
 *   *아직 안 온 게 있나* 이고 그 답은 2입니다.
 *
 * ★ 다 받은 날은 **다 받았다고** 말합니다. 빈 화면과 같은 말이면
 *   오늘 것이 아예 없었던 것인지 다 받은 것인지 구분이 안 됩니다.
 */
export function pendingSummary(states: readonly ArrivalState[]): string {
  if (states.length === 0) return '오늘 받기로 한 것이 없습니다';

  const left = states.filter(isPending).length;

  if (left === 0) return `${states.length}건 모두 받았습니다`;

  return `${left}건이 아직입니다`;
}
