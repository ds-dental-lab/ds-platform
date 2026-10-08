// =========================================================
// 놓을 위치: src/server/domain/pricing/index.ts
//
// 거래처별 단가 규칙. (디자인센터 사용자탭)
//
// 제품탭이 정한 기본가가 있고, 거래처마다 그것을 덮어쓸 수 있습니다.
//   치과  clinic_product_prices  — 청구할 값
//   기공소 lab_product_costs      — 지급할 값(기공원가)
//
// ★ 비어 있음(null) 과 0 은 다릅니다.
//   null 은 '이 거래처는 기본가를 쓴다', 0 은 '이 거래처에는 무료' 입니다.
//   `?? ` 로만 이어야 합니다 — `||` 를 쓰면 0 이 기본가로 새어 나갑니다.
//
// ★ 칸을 비우면 줄을 지웁니다.
//   덮어쓰기를 지워야 기본가로 돌아갑니다. 0 으로 두면 공짜가 됩니다.
//   그래서 '무엇을 저장하는가' 를 화면이 아니라 여기서 정합니다.
//
// ★ 못 쓰는 칸에는 값을 담지 않습니다.
//   폰틱이 안 되는 제품에 폰틱 단가를 넣어 두면, 나중에 그 제품이
//   폰틱을 켜는 순간 아무도 모르는 값이 살아납니다.
// =========================================================

/** 제품 하나가 값을 가질 수 있는 칸 */
export type PriceField = 'price' | 'ponticPrice' | 'pinkPrice';

export const PRICE_FIELDS: PriceField[] = ['price', 'ponticPrice', 'pinkPrice'];

/** 한 제품의 세 칸. 비어 있으면 null */
export type PriceSet = Record<PriceField, number | null>;

export const EMPTY_PRICES: PriceSet = {
  price: null,
  ponticPrice: null,
  pinkPrice: null,
};

/** 값을 담을 수 있는지 정하는 제품의 성질 */
export interface PricedProduct {
  hasPontic: boolean;
  hasPink: boolean;
}

/** 이 칸에 값을 넣을 수 있는 제품인가 */
export function isPriceable(product: PricedProduct, field: PriceField): boolean {
  if (field === 'ponticPrice') return product.hasPontic;
  if (field === 'pinkPrice') return product.hasPink;
  return true;
}

// ---------- 실제로 얼마인가 ----------

export type PriceSource = 'override' | 'base' | 'unset';

/**
 * 이 거래처에 적용되는 값.
 *
 * 덮어쓴 값이 있으면 그것, 없으면 기본가, 둘 다 없으면 null 입니다.
 */
export function resolvePrice(base: number | null, override: number | null): number | null {
  return override ?? base;
}

/**
 * 거래처 종류까지 따진 값.
 *
 * ★ 기공소에는 제품 기본가로 떨어지지 않습니다.
 *   제품의 price 는 **치과에 파는 값**입니다 (제품탭 '판매 가격').
 *   기공원가는 사용자탭에서 기공소마다 따로 넣습니다.
 *
 *   둘 다 기본가로 떨어지게 두면, 기공원가를 안 정한 칸이 치과 판매가
 *   그대로 잡힙니다 — 5만원에 팔고 5만원을 지급하는 셈입니다.
 *   안 정했으면 0원이 아니라 '미정' 이어야 사람이 알아챕니다.
 */
export function resolvePartyPrice(
  base: number | null,
  override: number | null,
  partyType: 'clinic' | 'lab',
): number | null {
  return partyType === 'clinic' ? resolvePrice(base, override) : override;
}

/** 그 값이 어디서 왔는가. 화면에서 색을 달리 찍는 데 씁니다 */
export function priceSource(base: number | null, override: number | null): PriceSource {
  if (override !== null) return 'override';
  if (base !== null) return 'base';
  return 'unset';
}

/** 제품 하나의 세 칸을 한꺼번에 풉니다 */
export function resolvePrices(
  product: PricedProduct,
  base: PriceSet,
  override: PriceSet,
): PriceSet {
  const out: PriceSet = { ...EMPTY_PRICES };

  for (const field of PRICE_FIELDS) {
    // 못 쓰는 칸은 기본가가 있어도 null 입니다
    out[field] = isPriceable(product, field) ? resolvePrice(base[field], override[field]) : null;
  }

  return out;
}

// ---------- 무엇을 저장하는가 ----------

export type SaveAction =
  | { kind: 'none' }
  | { kind: 'delete' }
  | { kind: 'upsert'; values: PriceSet };

/**
 * 화면에서 고친 값을 두고, 줄을 넣을지 지울지 그대로 둘지 정합니다.
 *
 * - 못 쓰는 칸의 값은 버립니다
 * - 남은 값이 하나도 없으면 줄을 지웁니다 (= 기본가로 돌아갑니다)
 * - 이미 있던 것과 같으면 아무것도 안 합니다
 */
export function planSave(
  product: PricedProduct,
  saved: PriceSet | null,
  edited: PriceSet,
): SaveAction {
  const cleaned: PriceSet = { ...EMPTY_PRICES };

  for (const field of PRICE_FIELDS) {
    cleaned[field] = isPriceable(product, field) ? edited[field] : null;
  }

  const empty = PRICE_FIELDS.every((f) => cleaned[f] === null);

  if (empty) return saved === null ? { kind: 'none' } : { kind: 'delete' };

  if (saved !== null && PRICE_FIELDS.every((f) => saved[f] === cleaned[f])) {
    return { kind: 'none' };
  }

  return { kind: 'upsert', values: cleaned };
}

// ---------- 사람이 친 글자를 값으로 ----------

/**
 * 입력칸의 글자를 금액으로 읽습니다.
 *
 * 빈 칸은 null(기본가를 쓴다), '0' 은 0(무료)입니다.
 * 쉼표는 눈으로 읽으라고 찍는 것이라 지웁니다.
 */
export function parseAmount(text: string): { ok: true; value: number | null } | { ok: false } {
  const trimmed = text.replace(/,/g, '').trim();
  if (trimmed === '') return { ok: true, value: null };

  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 0) return { ok: false };

  return { ok: true, value };
}

/** 화면에 찍는 금액. 없으면 '-', 0 은 '0' */
export function formatAmount(value: number | null): string {
  return value === null ? '-' : value.toLocaleString('ko-KR');
}

// ---------- 그 날의 단가 ----------
//
// 사용자 결정 2026-10-08 — "앞으로는 수가가 바뀐 이후에 적용이 되는게 맞다".
//
// ★★ 전에는 정산이 **지금 단가표**를 볼 때마다 다시 읽었습니다. 그래서
//   10월 8일에 값을 올리면 10월 1일에 이미 배송된 건까지 그 값이 됐습니다.
//   마감한 달만 안전했습니다. 이제 바뀐 날을 같이 남기고(product_price_history),
//   **그 건의 배송일에 유효했던 줄**을 고릅니다.
//
// ★ 이 파일은 DB 를 모릅니다. 줄을 받아 고르기만 합니다.

/** 한 제품의 한 시점. 값이 전부 비어 있으면 '그 날부터 덮어쓰기 없음' 입니다 */
export interface DatedPrice extends PriceSet {
  /** 'YYYY-MM-DD' — 이 날 배송된 건부터 이 값입니다 (그 날 포함) */
  effectiveFrom: string;
}

/**
 * 그 날짜에 유효한 덮어쓰기. 줄이 없으면 비어 있는 값(= 기본가로)을 줍니다.
 *
 * ★ 날짜가 **이하**인 줄 중 가장 늦은 것입니다. 바꾼 날 배송된 건은
 *   새 값입니다 — "오늘부터" 라고 말했을 때 사람이 기대하는 쪽입니다.
 *
 * ★ 모든 줄보다 이른 날짜면 **가장 오래된 줄**을 씁니다.
 *   기록을 남기기 시작한 2026-10-08 전에 배송된 건들이 여기 걸립니다.
 *   기본가로 떨어뜨리면 그 건들의 청구액이 **오늘 갑자기 달라집니다** —
 *   지나간 값을 모르니 '처음부터 그 값이었다' 로 두는 것이 덜 틀립니다.
 */
export function priceOn(rows: DatedPrice[], date: string): PriceSet {
  if (rows.length === 0) return { ...EMPTY_PRICES };

  // ISO 날짜는 글자 순서가 곧 날짜 순서입니다
  const sorted = [...rows].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));

  let picked = sorted[0];

  for (const row of sorted) {
    if (row.effectiveFrom > date) break;
    picked = row;
  }

  return { price: picked.price, ponticPrice: picked.ponticPrice, pinkPrice: picked.pinkPrice };
}
