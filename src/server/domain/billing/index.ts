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

// ---------- HOME 금액 카드가 셀 구간 ----------

/** 구간을 무엇으로 갈랐는가 */
export type MoneyBasis = 'period' | 'calendar';

/** 어느 날짜로 세는가 */
export type MoneyCountBy = 'received' | 'shipped';

export interface MoneyRange extends PeriodRange {
  basis: MoneyBasis;
  countBy: MoneyCountBy;
}

/**
 * HOME 의 금액 카드가 더할 구간과, 그 안에서 무엇을 셀지. (사용자 결정 2026-08-12)
 *
 * ★ 치과만 **접수일**로 셉니다.
 *   *"치과는 접수기준, 디자인센터는 배송일 기준으로"*.
 *   치과가 HOME 에서 알고 싶은 것은 청구서가 아니라 **"이번 달에 얼마나
 *   쓰고 있나"** 입니다. 8월에 스무 건을 넣었는데 아직 두 건만 나갔다면,
 *   배송으로 세는 숫자는 그 달의 씀씀이를 전혀 안 보여 줍니다.
 *
 * ★ 디자인센터·기공소는 **배송일**입니다.
 *   이쪽 숫자는 실제로 주고받을 돈입니다. 청구의 근거가 나간 물건이라
 *   정산과 같은 잣대여야 합니다 (isBillable 도 배송을 봅니다).
 *   기공소에는 '접수' 라는 시점 자체가 없습니다 — 배정으로 시작합니다.
 *
 * ★ 그래서 치과 HOME 과 치과 정산은 **일부러 다른 숫자**입니다.
 *   하나는 넣은 것, 하나는 나간 것입니다. 화면이 그렇다고 말해 줘야 합니다.
 *
 * ★ 구간은 치과·기공소가 **자기 정산기간**, 디자인센터만 **달력 월**.
 *   당사자가 하나면 기준일이 하나로 정해집니다. 26일 치과의 HOME 이
 *   달력 8월을 보여 주면 옆의 정산과 시작·끝이 어긋납니다.
 *   디자인센터의 금액은 기준일이 제각각인 치과 여럿을 더한 값이라
 *   '이번 정산기간' 이라는 것이 아예 없습니다 — 없는 기준을 지어내느니
 *   달력 월이라고 밝히는 편이 낫습니다.
 */
export function moneyRange(
  today: IsoDate,
  orgType: 'clinic' | 'design_center' | 'lab',
  closingDay: number,
): MoneyRange {
  return moneyRanges(today, orgType, closingDay, 1)[0];
}

/**
 * 금액 추이 그래프가 쓸 구간들. **오래된 것부터**, 마지막이 이번 구간입니다.
 *
 * ★ 달력 월이 아니라 정산 구간으로 자릅니다 (치과·기공소).
 *   26일 기준 치과에게 '7월' 은 06-26~07-25 입니다. 그래프만 달력 월로
 *   그리면 막대 하나하나가 정산서와 다른 것을 말하게 됩니다.
 *
 * ★ 구간은 서로 겹치지도, 사이가 비지도 않습니다.
 *   periodRange 와 periodOfDate 가 서로의 역이라 (테스트가 잠급니다)
 *   어떤 날짜든 정확히 한 구간에만 듭니다. 그래서 어느 건도 두 번
 *   세어지거나 통째로 빠지지 않습니다.
 *
 * ★ 마지막 구간은 **아직 안 끝났습니다.**
 *   다 지난 달들과 나란히 두면 "이번 달은 왜 이렇게 적나" 로 읽힙니다.
 *   화면이 그 막대를 달리 그려야 합니다.
 */
export function moneyRanges(
  today: IsoDate,
  orgType: 'clinic' | 'design_center' | 'lab',
  closingDay: number,
  count = 6,
): MoneyRange[] {
  // 디자인센터는 거래처 기준일이 제각각이라 달력 월(=기준일 1일)로 갑니다
  const day = orgType === 'design_center' ? 1 : closingDay;

  const shape = {
    basis: (orgType === 'design_center' ? 'calendar' : 'period') as MoneyBasis,
    countBy: (orgType === 'clinic' ? 'received' : 'shipped') as MoneyCountBy,
  };

  const out: MoneyRange[] = [];
  let ym = periodOfDate(today, day);

  for (let i = 0; i < Math.max(1, count); i++) {
    out.unshift({ ...periodRange(ym, day), ...shape });
    ym = prevYearMonth(ym);
  }

  return out;
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

// ---------- 청구서는 누가 누구에게 ----------
//
// ★ 방향이 반대인 두 청구서가 있습니다 (사용자 확정 2026-08-12).
//     디자인센터 → 치과      만들어 준 값을 받습니다
//     기공소     → 디자인센터  만들어 준 값을 받습니다
//
//   금액은 양쪽 다 디자인센터가 정합니다 —
//   치과 단가도 기공원가도 사용자탭에서 디자인센터가 넣습니다.
//   그래서 계산과 마감은 한 곳에서 하고, **문서의 머리만 방향에 맞춥니다**.
//
// ★ 헷갈리기 쉬운 자리입니다.
//   기공소 정산을 '청구' 로 적으면 디자인센터가 기공소에 돈을 달라는
//   문서가 됩니다. 실제로는 주는 쪽입니다.

export type BillingDirection = 'to_clinic' | 'from_lab';

export interface InvoiceParties {
  /** 청구하는 쪽 (돈을 받는 쪽) */
  from: 'design_center' | 'lab';
  /** 청구받는 쪽 (돈을 내는 쪽) */
  to: 'clinic' | 'design_center';
  direction: BillingDirection;
  /** 문서 이름 */
  title: string;
  /** 금액 칸 이름 */
  amountLabel: string;
}

export function invoicePartiesFor(partyType: 'clinic' | 'lab'): InvoiceParties {
  if (partyType === 'clinic') {
    return {
      from: 'design_center',
      to: 'clinic',
      direction: 'to_clinic',
      title: '청구서',
      amountLabel: '청구 금액',
    };
  }

  // 기공소는 받는 쪽입니다. 디자인센터가 내는 쪽입니다
  return {
    from: 'lab',
    to: 'design_center',
    direction: 'from_lab',
    title: '청구서 (기공료)',
    amountLabel: '지급 금액',
  };
}

/**
 * 인쇄할 때 창 제목으로 걸 이름. (사용자 결정 2026-08-13)
 *
 * ★ 크롬은 'PDF 로 저장' 의 **기본 파일명을 창 제목에서 가져옵니다.**
 *   그대로 두면 거래처마다 `DS Flow.pdf` 가 나와서, 열 개를 뽑으면
 *   `DS Flow (1).pdf` … 가 됩니다. 나중에 누구 것인지 알 수가 없습니다.
 *
 * ★ 파일명에 못 쓰는 글자를 미리 지웁니다.
 *   `/ \ : * ? " < > |` 가 들어가면 저장이 막히거나 이름이 잘립니다.
 *   거래처 이름에 괄호나 점은 흔하니 그대로 두고 이것만 뺍니다.
 */
export function invoiceFileName(
  title: string,
  receiverName: string,
  yearMonth: string,
): string {
  const parts = [title, receiverName, yearMonth]
    .map((part) => part.replace(/[/\\:*?"<>|]/g, '').trim())
    .filter(Boolean);

  return parts.join('_');
}

// ---------- 조정 ----------

/**
 * 손으로 넣는 금액 조정. (몽키스패너)
 *
 * ★ 원금액을 덮어쓰지 않고 차액 한 줄을 덧댑니다.
 *   42번을 50,000 → 30,000 으로 깎았을 때 원금액을 고쳐 버리면
 *   "얼마였는데 왜 깎았나" 가 사라집니다.
 *
 * ★ 사유가 없으면 못 넣습니다.
 *   한 달 뒤에 보면 왜 깎았는지 아무도 기억하지 못합니다.
 *   청구서에 그대로 실리므로 치과가 읽을 말이어야 합니다.
 */
export function checkAdjustment(amount: number, reason: string): CloseVerdict {
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    return { ok: false, reason: '금액은 정수여야 합니다' };
  }
  if (amount === 0) return { ok: false, reason: '0 원은 조정할 것이 없습니다' };
  if (!reason.trim()) return { ok: false, reason: '사유를 적어 주세요' };

  return { ok: true };
}

// ---------- 청구서 세부내역 묶기 ----------
//
// ★ 브릿지는 물리적으로 **하나**입니다 (사용자 제안 2026-08-12).
//   15번 지르코니아 + 16번 폰틱이 이어진 브릿지는 기공소가 한 덩어리로
//   만들고 치과가 한 번에 붙입니다. 청구서에서 두 줄로 갈라 놓으면
//   "이게 따로 만든 두 개인가" 로 읽힙니다.
//
//   값은 유닛(치식)당 매기지만, 그것은 **셈하는 방법**이지 물건의 단위가
//   아닙니다. 문서는 물건 단위로 적고 셈은 안쪽에 보여 줍니다.
//
// ★ 저장은 그대로 치식별입니다.
//   billing_lines 는 한 치아에 한 줄로 굳습니다 — 그것이 근거이고,
//   묶는 것은 읽기 좋으라고 하는 일입니다. 저장까지 묶으면 나중에
//   "16번만 얼마였나" 를 되짚을 수 없습니다.
//
// ★ 작업 화면(정산관리)은 안 묶습니다.
//   거기서는 치식마다 금액을 조정합니다. 묶어 놓으면 어느 이빨을
//   깎는지 고를 수가 없습니다. 문서만 묶습니다.

export interface GroupableItem {
  orderId: string;
  itemId: string;
  toothNumber: number;
  typeCode: string;
  materialCode: string;
  isPontic: boolean;
  label: string;
  amount: number;
  adjustment: number;
  billable: boolean;
}

export interface GroupedLine<T extends GroupableItem> {
  key: string;
  /** 이 묶음에 든 치식들. 브릿지면 이어진 순서입니다 */
  teeth: number[];
  /** 화면에 찍는 이름 */
  label: string;
  /** 몇 유닛인가 */
  count: number;
  amount: number;
  adjustment: number;
  isBridge: boolean;
  /** 묶음의 첫 줄. 환자·날짜처럼 묶어도 같은 값을 여기서 꺼냅니다 */
  first: T;
  items: T[];
}

/**
 * 청구서 세부내역을 묶습니다.
 *
 *   브릿지          한 줄 — 'Zir-Cr 브릿지 3본 (폰틱 1)' · 치식 15-16-17
 *   그 밖의 낱개    같은 주문·같은 제품끼리 한 줄 — 치식 16, 26, 36
 *
 * ★ 브릿지 여부는 저장된 것을 씁니다 (bridgeOf).
 *   여기서 다시 계산하면 사용자가 손으로 끊어 둔 연결을 도로 이어 버립니다.
 */
export function groupInvoiceLines<T extends GroupableItem>(
  items: T[],
  bridgeOf: (itemId: string) => string | null,
): GroupedLine<T>[] {
  const groups = new Map<string, GroupedLine<T>>();

  for (const item of items) {
    const bridgeId = bridgeOf(item.itemId);

    // 청구하지 않는 줄(리메이크)은 섞지 않습니다 — 0원이 낱개 금액에 묻힙니다
    const key = bridgeId
      ? `b:${bridgeId}`
      : `i:${item.orderId}|${item.typeCode}|${item.materialCode}|${item.isPontic}|${item.billable}`;

    const found = groups.get(key);

    if (found) {
      found.teeth.push(item.toothNumber);
      found.count += 1;
      found.amount += item.amount;
      found.adjustment += item.adjustment;
      found.items.push(item);
      continue;
    }

    groups.set(key, {
      key,
      teeth: [item.toothNumber],
      label: item.label,
      count: 1,
      amount: item.amount,
      adjustment: item.adjustment,
      isBridge: Boolean(bridgeId),
      first: item,
      items: [item],
    });
  }

  for (const group of groups.values()) {
    group.teeth.sort((a, b) => a - b);
    if (group.isBridge) group.label = bridgeLabel(group.items);
  }

  return [...groups.values()];
}

/** 'Zir-Cr 브릿지 3본 (폰틱 1)' — 몇 본이고 그중 폰틱이 몇인지 */
function bridgeLabel(items: GroupableItem[]): string {
  const base = items.find((i) => !i.isPontic)?.label ?? items[0].label;
  const pontics = items.filter((i) => i.isPontic).length;

  const name = base.replace(/\s*\(Pontic\)\s*$/, '');
  const tail = pontics > 0 ? ` (폰틱 ${pontics})` : '';

  return `${name} 브릿지 ${items.length}본${tail}`;
}

/** '15-16-17' (브릿지는 이어서) 또는 '16, 26, 36' */
export function formatTeeth(teeth: number[], isBridge: boolean): string {
  return teeth.join(isBridge ? '-' : ', ');
}
