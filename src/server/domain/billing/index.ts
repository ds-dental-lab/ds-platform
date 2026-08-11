// =========================================================
// 놓을 위치: src/server/domain/billing/index.ts
//
// 정산 기간 규칙. (사용자 확정 2026-08-11)
//
// 큰 틀
//   기간 귀속   실제 배송일(shipped_at) 이 든 달
//   대상        배송으로 넘어간 건. 리메이크·리페어는 청구 제외
//   추가금액    '그때 열려 있는 기간' 에 붙습니다
//
// ★ '요청시한 전인가 후인가' 로 따지지 않습니다.
//   요청시한 8/20 인 건에 8/25 에 차액이 생겼다고 합시다. 시한은 지났지만
//   8월은 아직 안 닫혔습니다. 다음 달로 미룰 이유가 없습니다.
//   '마감했는가' 하나로 보면 경우를 나눌 필요가 없어집니다.
//
// ★ 마감일을 여기에 박지 않습니다.
//   26일이든 다음달 1일이든, 나중에 자동으로 바뀌든, 이 파일은 그대로입니다.
//   "열려 있는 기간 중 가장 이른 것" 만 알면 됩니다.
// =========================================================

import type { IsoDate } from '../week';

/** '2026-08' */
export type YearMonth = string;

export interface PeriodState {
  yearMonth: YearMonth;
  closed: boolean;
}

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidYearMonth(value: string): boolean {
  return YEAR_MONTH.test(value);
}

/** 날짜가 속한 달. '2026-08-31T23:00:00Z' 같은 시각도 받습니다 */
export function yearMonthOf(when: string): YearMonth {
  return when.slice(0, 7);
}

/** 다음 달. 12월은 해를 넘깁니다 */
export function nextYearMonth(ym: YearMonth): YearMonth {
  const [year, month] = ym.split('-').map(Number);
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, '0')}`;
}

// ---------- 무엇을 청구하는가 ----------

export interface BillableOrder {
  /** 배송으로 넘어간 시각. 아직 안 나갔으면 null */
  shippedAt: string | null;
  /** 리메이크·리페어는 false */
  isBillable: boolean;
}

/**
 * 이 주문이 청구 대상인가.
 *
 * ★ 배송으로 넘어간 것만 셉니다.
 *   완료는 치과가 눌러야 붙는데, 안 누르고 지나가는 일이 흔합니다.
 *   물건이 나간 시점이 청구의 근거입니다.
 */
export function isBillable(order: BillableOrder): boolean {
  return order.isBillable && order.shippedAt !== null;
}

/** 이 주문의 기본금액이 들어갈 달. 아직 안 나갔으면 null */
export function basePeriodOf(order: BillableOrder): YearMonth | null {
  if (!isBillable(order)) return null;
  return yearMonthOf(order.shippedAt!);
}

// ---------- 어느 기간에 딱지를 찍는가 ----------

/**
 * 지금 생긴 금액을 어느 달에 붙일지 정합니다.
 *
 *   원하는 달이 열려 있으면      → 그 달
 *   마감됐으면                  → 그 뒤로 열려 있는 첫 달
 *   그마저 없으면               → 마지막 달의 다음 달 (새로 열어야 합니다)
 *
 * ★ 마감된 기간을 건드리지 않는 것이 전부입니다.
 *   한 번 나간 정산서의 숫자가 나중에 달라지면 신뢰가 무너집니다.
 */
export function postingPeriod(
  wanted: YearMonth,
  periods: PeriodState[],
): YearMonth {
  const known = new Map(periods.map((p) => [p.yearMonth, p.closed]));

  // 원하는 달이 아직 없으면 새로 열면 됩니다
  if (!known.has(wanted)) return wanted;
  if (!known.get(wanted)) return wanted;

  // 마감됐으면 뒤로 밀며 열린 달을 찾습니다
  let cursor = nextYearMonth(wanted);
  const guard = periods.length + 2; // 알려진 달 수를 넘어서면 무조건 새 달입니다

  for (let i = 0; i < guard; i++) {
    if (!known.has(cursor)) return cursor;
    if (!known.get(cursor)) return cursor;
    cursor = nextYearMonth(cursor);
  }

  return cursor;
}

// ---------- 예상 청구액 ----------

/**
 * 아직 안 나간 건까지 더한 '이번 달 예상' 에 넣을지.
 *
 * ★ 여기서만 요청시한을 씁니다.
 *   실제 청구는 배송일로 가르지만, 치과는 이번 달에 얼마가 나올지
 *   미리 알고 싶어 합니다. 그 어림셈에는 요청시한이 맞습니다.
 */
export function isExpectedIn(
  ym: YearMonth,
  order: { shippedAt: string | null; dueDate: IsoDate; isBillable: boolean },
): boolean {
  if (!order.isBillable) return false;

  // 이미 나갔으면 어림이 아니라 확정입니다
  if (order.shippedAt) return yearMonthOf(order.shippedAt) === ym;

  return yearMonthOf(order.dueDate) === ym;
}
