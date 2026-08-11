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

/** 지난 달. 1월은 해를 내려갑니다 */
export function prevYearMonth(ym: YearMonth): YearMonth {
  const [year, month] = ym.split('-').map(Number);
  return month === 1
    ? `${year - 1}-12`
    : `${year}-${String(month - 1).padStart(2, '0')}`;
}

// ---------- 기준일이 기간을 가릅니다 (거래처마다 다릅니다) ----------
//
// ★ 정산 기준일은 거래처 설정입니다 (organizations.closing_day).
//   한 달이 모두에게 같은 날 시작하지 않습니다 —
//     1일  치과 → 08-01 ~ 08-31
//     26일 치과 → 07-26 ~ 08-25
//   둘 다 '2026-08 정산' 입니다. **끝나는 달**로 이름을 붙입니다.
//
// ★ 기준일은 1~28 만 받습니다.
//   29·30·31 로 두면 2월에 그 날이 없어 기간이 끊깁니다.
//   '말일' 이 필요하면 1일 기준과 같은 뜻이라 1일로 적습니다.

export const MIN_CLOSING_DAY = 1;
export const MAX_CLOSING_DAY = 28;

export function isValidClosingDay(day: number): boolean {
  return Number.isInteger(day) && day >= MIN_CLOSING_DAY && day <= MAX_CLOSING_DAY;
}

export interface PeriodRange {
  /** 첫날 (포함) */
  from: IsoDate;
  /** 끝날 (포함) */
  to: IsoDate;
}

function lastDayOfMonth(year: number, month: number): number {
  // month 는 1~12. 다음 달 0일 = 이 달 마지막 날
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function iso(ym: YearMonth, day: number): IsoDate {
  return `${ym}-${String(day).padStart(2, '0')}`;
}

/**
 * '2026-08' 정산이 실제로 어느 날부터 어느 날까지인가.
 *
 *   기준일 1일  → 2026-08-01 ~ 2026-08-31
 *   기준일 26일 → 2026-07-26 ~ 2026-08-25
 *
 * ★ 1일은 지난달로 넘어가지 않습니다.
 *   1일 기준이면 그 달이 통째로 그 달입니다. 다른 날만 앞달에서 시작합니다.
 */
export function periodRange(ym: YearMonth, closingDay: number): PeriodRange {
  const day = clampClosingDay(closingDay);

  if (day === 1) {
    const [year, month] = ym.split('-').map(Number);
    return { from: iso(ym, 1), to: iso(ym, lastDayOfMonth(year, month)) };
  }

  return { from: iso(prevYearMonth(ym), day), to: iso(ym, day - 1) };
}

/**
 * 이 날짜(배송일)가 드는 정산 달.
 *
 *   26일 기준에서 08-25 는 2026-08, 08-26 은 벌써 2026-09 입니다.
 *
 * ★ periodRange 의 역입니다. 둘이 어긋나면 어느 건이 어느 달에도
 *   안 잡히거나 두 달에 겹쳐 잡힙니다. 테스트가 왕복을 잠급니다.
 */
export function periodOfDate(when: string, closingDay: number): YearMonth {
  const day = clampClosingDay(closingDay);
  const ym = yearMonthOf(when);
  const dayOfMonth = Number(when.slice(8, 10));

  return day > 1 && dayOfMonth >= day ? nextYearMonth(ym) : ym;
}

/** 잘못된 기준일이 와도 화면이 죽지 않게 1~28 안으로 당깁니다 */
function clampClosingDay(day: number): number {
  if (!Number.isFinite(day)) return MIN_CLOSING_DAY;
  return Math.min(MAX_CLOSING_DAY, Math.max(MIN_CLOSING_DAY, Math.trunc(day)));
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

/**
 * 이 주문의 기본금액이 들어갈 달. 아직 안 나갔으면 null.
 *
 * ★ 거래처의 기준일이 필요합니다.
 *   같은 8월 26일 배송이라도 1일 치과는 8월, 26일 치과는 9월입니다.
 */
export function basePeriodOf(order: BillableOrder, closingDay: number): YearMonth | null {
  if (!isBillable(order)) return null;
  return periodOfDate(order.shippedAt!, closingDay);
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

// ---------- 보철 한 줄이 얼마인가 ----------
//
// ★ '값이 없다' 를 0원으로 삼키지 않습니다.
//   단가를 안 정한 제품을 조용히 0원으로 청구하면 돈을 못 받고,
//   그 사실을 아무도 모릅니다. 0원과 미정을 갈라 화면에 띄웁니다.

export interface BillableItem {
  /** 폰틱 자리인가. 폰틱이면 폰틱 단가를 씁니다 */
  isPontic: boolean;
  /** 치은(핑크) 포셀린을 붙였는가. 붙였으면 그 값을 더합니다 */
  hasGingival: boolean;

  /** 이 거래처에 적용되는 값들 (domain/pricing 의 resolvePrice 를 지난 뒤) */
  price: number | null;
  ponticPrice: number | null;
  pinkPrice: number | null;
}

export interface ItemAmount {
  amount: number;
  /** 쓸 단가가 비어 있었는가. 화면에서 '미정' 으로 표시해야 합니다 */
  unpriced: boolean;
}

/**
 * 보철 한 줄의 청구액.
 *
 *   폰틱이면 폰틱 단가, 아니면 판매가.
 *   치은포셀린을 붙였으면 그만큼 더합니다.
 *
 * ★ 리메이크·리페어는 여기까지 오지 않습니다 (isBillable 이 먼저 걸러냅니다).
 *   주문 단위로 걸러야 '리메이크 주문의 한 줄만 청구' 같은 일이 안 생깁니다.
 */
export function itemAmount(item: BillableItem): ItemAmount {
  const base = item.isPontic ? item.ponticPrice : item.price;

  // 치은포셀린 값을 안 정했으면 그것도 미정입니다 — 붙였는데 공짜일 리 없습니다
  const pink = item.hasGingival ? item.pinkPrice : 0;

  const unpriced = base === null || pink === null;

  return { amount: (base ?? 0) + (pink ?? 0), unpriced };
}

/** 여러 줄을 더합니다. 하나라도 미정이면 합계도 미정 표시를 답니다 */
export function sumItems(items: BillableItem[]): ItemAmount {
  return items.reduce<ItemAmount>(
    (acc, item) => {
      const one = itemAmount(item);
      return { amount: acc.amount + one.amount, unpriced: acc.unpriced || one.unpriced };
    },
    { amount: 0, unpriced: false },
  );
}

// ---------- 마감 ----------
//
// ★ 마감은 '지금까지의 셈을 굳히는 일' 입니다.
//   열린 기간의 정산 화면은 주문에서 그때그때 셉니다 — 주문이 바뀌면
//   금액도 따라 바뀝니다. 마감을 누르는 순간의 결과를 줄로 박아 두면
//   그 뒤에 무엇이 바뀌어도 지난 청구서의 숫자가 흔들리지 않습니다.

export interface ClosableRange {
  from: IsoDate;
  to: IsoDate;
}

export type CloseVerdict = { ok: true } | { ok: false; reason: string };

/**
 * 이 기간을 지금 마감해도 되는가.
 *
 * ★ 기간이 끝나기 전에는 못 닫습니다.
 *   8월(26일 기준)은 8월 25일까지입니다. 20일에 닫아 버리면
 *   21~25일에 나간 물건이 조용히 9월로 밀립니다 — 치과는 이번 달
 *   청구서에 있어야 할 건이 왜 없는지 알 수 없습니다.
 *
 * ★ 이미 닫힌 기간은 두 번 닫지 않습니다.
 *   두 번 닫으면 같은 금액이 두 줄이 됩니다.
 */
export function canClosePeriod(
  range: ClosableRange,
  today: IsoDate,
  alreadyClosed: boolean,
): CloseVerdict {
  if (alreadyClosed) return { ok: false, reason: '이미 마감한 기간입니다' };

  if (today <= range.to) {
    return { ok: false, reason: `${range.to} 이 지나야 마감할 수 있습니다` };
  }

  return { ok: true };
}

/**
 * 마감을 되돌려도 되는가.
 *
 * ★ 청구서를 뽑기 전까지입니다.
 *   한 번 나간 청구서의 숫자가 나중에 달라지면 신뢰가 무너집니다.
 *   뽑기 전이라면 아직 아무도 못 봤으니 되돌려도 됩니다 —
 *   잘못 눌렀을 때 손쓸 길이 없으면 그게 더 위험합니다.
 */
export function canReopenPeriod(period: {
  closedAt: string | null;
  issuedAt: string | null;
}): CloseVerdict {
  if (!period.closedAt) return { ok: false, reason: '아직 마감하지 않은 기간입니다' };
  if (period.issuedAt) return { ok: false, reason: '청구서를 이미 뽑아 되돌릴 수 없습니다' };

  return { ok: true };
}

// ---------- 무엇을 줄로 남기는가 ----------

export type LineKind = 'base' | 'surcharge' | 'remake_diff' | 'adjustment';

export interface FrozenLine {
  kind: LineKind;
  amount: number;
  reason?: string;
}

/**
 * 보철 한 줄을 정산줄로 폅니다.
 *
 * ★ 치은포셀린을 따로 뗍니다.
 *   합쳐 놓으면 청구서에 '지르코니아 200,000' 한 줄만 남아, 치과가
 *   "왜 이 이는 비싼가" 를 물었을 때 답할 근거가 화면에 없습니다.
 *   붙인 값은 붙인 값대로 보여야 합니다.
 *
 * ★ 단가를 안 정한 줄은 0원짜리 줄로 남깁니다.
 *   빼 버리면 청구서에서 그 보철이 통째로 사라져 아무도 모릅니다.
 *   0원으로 남으면 적어도 '왜 0원이지' 를 묻게 됩니다.
 */
export function splitItemLines(item: BillableItem): FrozenLine[] {
  const lines: FrozenLine[] = [];
  const base = item.isPontic ? item.ponticPrice : item.price;

  lines.push({ kind: 'base', amount: base ?? 0 });

  if (item.hasGingival) {
    lines.push({ kind: 'surcharge', amount: item.pinkPrice ?? 0, reason: '핑크 포셀린' });
  }

  return lines;
}
