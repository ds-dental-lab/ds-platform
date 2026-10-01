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
// ★ 그래서 **아침 9시(KST)** 에 돕니다. 그 시각은 UTC 로 같은 날 0시라,
//   저장되는 시각의 UTC 날짜와 한국 날짜가 같습니다. 자정에 돌리면
//   한국 1일 0시 = UTC 전달 말일이 되어 **10월 건이 9월 정산에 끼어듭니다.**
//
// ★ 자동으로 넘기는 것은 **제작·배송** 뿐입니다. 접수·디자인·제작대기는
//   아직 만들지도 않은 것이라 시한이 지나도 완료가 아닙니다 — 늦은 것이지
//   끝난 것이 아닙니다.
// =========================================================

import type { OrderStatus } from '@/server/domain/order-status';

/** 자동 완료 대상이 되는 상태 */
export const AUTO_COMPLETE_FROM: OrderStatus[] = ['production', 'shipping'];

/** 시계가 부르는 시각 — 09:00 KST (= 00:00 UTC). 바꾸면 migration 의 cron 도 같이 */
export const AUTO_COMPLETE_HOUR_KST = 9;

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
 * 자동 완료가 남길 배송 시각.
 *
 * ★ 이미 배송을 눌러 시각이 있으면 **그대로 둡니다** — 실제로 나간 날이 맞습니다.
 * ★ 없으면 지금입니다. 시한 날짜가 아니라 지금인 이유: 밀린 주문(시한이 한참 지난)을
 *   옛 날짜로 적으면 **이미 마감한 달**에 금액이 생깁니다. 마감된 정산은 못 바뀝니다.
 */
export function shippedAtFor(existing: string | null, now: Date): string {
  return existing ?? now.toISOString();
}
