// =========================================================
// 놓을 위치: src/server/domain/auto-complete/index.ts
//
// 요청시한이 된 제작 건을 스스로 '완료' 로 넘기는 규칙 (사용자 요청 2026-10-01 —
// "제작 단계에서 배송 버튼 안 눌러도 디데이 되면 완료로 자동으로 바꿔 줘").
//
// ★★ **배송 시각을 같이 남겨야 합니다.** 정산은 상태가 아니라 `shipped_at` 으로
//   달을 가릅니다 (domain/billing 의 isBillable·periodOfDate). 상태만 완료로
//   바꾸고 시각을 안 남기면 그 주문은 **어느 달에도 안 잡혀 영원히 청구가 안 됩니다.**
//
// ★★ **도는 시각과 적는 시각을 떼어 놓습니다** (사용자 결정 2026-10-01 —
//   파기 작업과 같은 **새벽 3시**에 묶고 싶다).
//   한국 새벽 3시는 UTC 로 전날 18시입니다. 그대로 적으면 10월 1일 새벽에 넘어간 건이
//   **9월로** 잡히고, 이미 마감한 9월에 금액이 뒤늦게 생깁니다 (마감된 정산은 못 바뀝니다).
//   그래서 **그날의 한국 날짜 00:00 UTC**(= 한국 아침 9시)로 적습니다 —
//   언제 돌든 한국 날짜와 정산 달이 어긋나지 않습니다.
//
// ★ 자동으로 넘기는 것은 **제작·배송** 뿐입니다. 접수·디자인·제작대기는
//   아직 만들지도 않은 것이라 시한이 지나도 완료가 아닙니다 — 늦은 것이지
//   끝난 것이 아닙니다.
// =========================================================

import type { OrderStatus } from '@/server/domain/order-status';
import { todayInKst } from '@/server/domain/week';

/** 자동 완료 대상이 되는 상태 */
export const AUTO_COMPLETE_FROM: OrderStatus[] = ['production', 'shipping'];

/** 시계가 부르는 시각 — 03:00 KST. 몇 시에 돌든 적히는 시각은 stampFor 가 정합니다 */
export const AUTO_COMPLETE_HOUR_KST = 3;

export function isAutoCompletable(status: OrderStatus): boolean {
  return AUTO_COMPLETE_FROM.includes(status);
}

/**
 * 시한이 됐는가. 오늘(한국 날짜)이 요청시한과 같거나 지났으면 참입니다.
 * ★ 문자열 비교로 충분합니다 — 둘 다 'YYYY-MM-DD' 입니다.
 */
export function dueReached(dueDate: string | null, todayKst: string): boolean {
  if (!dueDate) return false;
  return dueDate <= todayKst;
}

/**
 * 그날(한국 날짜)을 가리키는 시각. 00:00 UTC = 한국 아침 9시입니다.
 *
 * ★ 새벽에 돌아도 한국 날짜 그대로 적힙니다 — 달 경계에서 하루가 밀리지 않습니다.
 * ★ 화면에는 '아침 9시 배송' 으로 보입니다. 실제 실행은 새벽이지만, 그 하루가
 *   어느 날인지가 돈에서는 더 중요합니다.
 */
export function stampFor(now: Date): string {
  return `${todayInKst(now)}T00:00:00.000Z`;
}

/**
 * 자동 완료가 남길 배송 시각.
 *
 * ★ 이미 배송을 눌러 시각이 있으면 **그대로 둡니다** — 실제로 나간 날이 맞습니다.
 * ★ 없으면 **오늘(한국 날짜)** 입니다. 시한 날짜로 소급하지 않습니다 — 밀린 주문을
 *   옛 날짜로 적으면 **이미 마감한 달**에 금액이 생깁니다. 마감된 정산은 못 바뀝니다.
 */
export function shippedAtFor(existing: string | null, now: Date): string {
  return existing ?? stampFor(now);
}
