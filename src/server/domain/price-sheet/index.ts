// =========================================================
// 놓을 위치: src/server/domain/price-sheet/index.ts
//
// 치과에 보내는 수가표. (사용자 요청 2026-09-07 — "수가표 보내기 버튼,
// 보내기 전에 조정할 수 있게, 지금 값이 기본값")
//
// ★ 기본값은 여기 한 곳에 있습니다 — 2026-09-07 사용자가 준 표 그대로.
//   센터가 '기본값으로 저장' 을 누르면 organizations.price_sheet 에 들어가고
//   그다음부터는 그 값이 기본입니다 (repositories/price-sheet).
// ★ 보낼 때마다 조정할 수 있고, 보낸 값은 문의 줄에 그대로 남습니다
//   (contact_requests.price_sheet_sent) — 나중에 "그때 얼마로 보냈지" 가
//   나옵니다. 단가는 바뀌는데 기록이 따라 바뀌면 안 됩니다.
// ★ 순수 함수만. 메일 글은 mail/price-sheet-mail 이 이 값을 받아 만듭니다.
// =========================================================

export type PriceGroup = 'Crown' | 'Inlay' | 'Implant';

export interface PriceRow {
  group: PriceGroup;
  item: string;
  /** 원. 공급가 */
  price: number;
}

export const PRICE_GROUPS: PriceGroup[] = ['Crown', 'Inlay', 'Implant'];

/** 사용자가 준 표 (2026-09-07). 부가세 면세라 이 값이 곧 청구액입니다 */
export const DEFAULT_PRICE_SHEET: PriceRow[] = [
  { group: 'Crown', item: 'PMMA', price: 10_000 },
  { group: 'Crown', item: 'Zirconia', price: 45_000 },
  { group: 'Inlay', item: 'Hybrid', price: 40_000 },
  { group: 'Inlay', item: 'Zirconia', price: 40_000 },
  { group: 'Implant', item: 'Custom Abutment', price: 45_000 },
  { group: 'Implant', item: 'Custom Abutment + Zirconia', price: 90_000 },
];

export const MAX_PRICE = 9_999_999;
export const MAX_ROWS = 30;

export type PriceSheetVerdict = { ok: true } | { ok: false; reason: string };

/**
 * 보내도 되는 표인가.
 *
 * ★ 0원은 막습니다 — 칸을 비우고 보내면 "무료" 로 읽힙니다.
 * ★ 원 단위 정수만. 45,000.5원은 없습니다.
 */
export function checkPriceSheet(rows: readonly PriceRow[]): PriceSheetVerdict {
  if (rows.length === 0) return { ok: false, reason: '항목이 하나도 없습니다' };
  if (rows.length > MAX_ROWS) return { ok: false, reason: `항목은 ${MAX_ROWS}개까지입니다` };

  for (const r of rows) {
    if (!PRICE_GROUPS.includes(r.group)) return { ok: false, reason: `분류가 이상합니다: ${r.group}` };
    if (!r.item.trim()) return { ok: false, reason: '이름이 빈 항목이 있습니다' };
    if (!Number.isInteger(r.price) || r.price <= 0) {
      return { ok: false, reason: `${r.item}: 가격은 1원 이상의 정수여야 합니다` };
    }
    if (r.price > MAX_PRICE) return { ok: false, reason: `${r.item}: 가격이 너무 큽니다` };
  }

  return { ok: true };
}

/** 45000 → '45,000' */
export function formatWon(price: number): string {
  return Math.round(price).toLocaleString('ko-KR');
}

/** DB 에 든 값을 믿지 않고 다시 봅니다 — 모양이 어긋나면 기본값 */
export function parsePriceSheet(value: unknown): PriceRow[] | null {
  if (!Array.isArray(value)) return null;
  const rows: PriceRow[] = [];
  for (const v of value) {
    if (!v || typeof v !== 'object') return null;
    const { group, item, price } = v as Record<string, unknown>;
    if (typeof group !== 'string' || typeof item !== 'string' || typeof price !== 'number') return null;
    rows.push({ group: group as PriceGroup, item, price });
  }
  return checkPriceSheet(rows).ok ? rows : null;
}

/** 분류 순서대로 묶습니다 — 표는 Crown · Inlay · Implant 순 */
export function groupRows(rows: readonly PriceRow[]): { group: PriceGroup; rows: PriceRow[] }[] {
  return PRICE_GROUPS.map((group) => ({ group, rows: rows.filter((r) => r.group === group) })).filter(
    (g) => g.rows.length > 0,
  );
}
