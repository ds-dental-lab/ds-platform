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
