// =========================================================
// 놓을 위치: tests/domain/pricing.test.ts
// 기준: 거래처별 단가 규칙 — 비어 있음과 0 은 다릅니다
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  isPriceable,
  resolvePrice,
  resolvePrices,
  priceSource,
  planSave,
  parseAmount,
  formatAmount,
  EMPTY_PRICES,
  type PriceSet,
} from '@/server/domain/pricing';

const FULL = { hasPontic: true, hasPink: true };
const PLAIN = { hasPontic: false, hasPink: false };

function prices(price: number | null, pontic: number | null, pink: number | null): PriceSet {
  return { price, ponticPrice: pontic, pinkPrice: pink };
}

describe('값을 담을 수 있는 칸', () => {
  it('판매가는 언제나 담는다', () => {
    expect(isPriceable(PLAIN, 'price')).toBe(true);
  });

  it('폰틱이 안 되는 제품에는 폰틱 단가를 담지 않는다', () => {
    expect(isPriceable(PLAIN, 'ponticPrice')).toBe(false);
    expect(isPriceable(FULL, 'ponticPrice')).toBe(true);
  });

  it('핑크가 안 되는 제품에는 핑크 단가를 담지 않는다', () => {
    expect(isPriceable(PLAIN, 'pinkPrice')).toBe(false);
    expect(isPriceable(FULL, 'pinkPrice')).toBe(true);
  });
});

describe('실제로 얼마인가', () => {
  it('덮어쓴 값이 이긴다', () => {
    expect(resolvePrice(150000, 130000)).toBe(130000);
  });

  it('덮어쓴 값이 없으면 기본가', () => {
    expect(resolvePrice(150000, null)).toBe(150000);
  });

  // ★ 여기가 핵심입니다. `||` 로 이으면 0 이 기본가로 새어 나갑니다
  it('0 으로 덮어쓰면 0 이다 (무료)', () => {
    expect(resolvePrice(150000, 0)).toBe(0);
  });

  it('둘 다 없으면 값이 없다', () => {
    expect(resolvePrice(null, null)).toBeNull();
  });

  it('어디서 온 값인지 말한다', () => {
    expect(priceSource(150000, 130000)).toBe('override');
    expect(priceSource(150000, 0)).toBe('override');
    expect(priceSource(150000, null)).toBe('base');
    expect(priceSource(null, null)).toBe('unset');
  });

  it('못 쓰는 칸은 기본가가 있어도 비운다', () => {
    const out = resolvePrices(PLAIN, prices(150000, 90000, 20000), EMPTY_PRICES);

    expect(out.price).toBe(150000);
    expect(out.ponticPrice).toBeNull();
    expect(out.pinkPrice).toBeNull();
  });
});

describe('무엇을 저장하는가', () => {
  it('값을 처음 넣으면 줄을 만든다', () => {
    const plan = planSave(FULL, null, prices(130000, null, null));

    expect(plan.kind).toBe('upsert');
    if (plan.kind === 'upsert') expect(plan.values.price).toBe(130000);
  });

  // ★ 칸을 비우는 것이 '기본가로 되돌리기' 입니다
  it('있던 값을 모두 비우면 줄을 지운다', () => {
    const plan = planSave(FULL, prices(130000, null, null), EMPTY_PRICES);
    expect(plan.kind).toBe('delete');
  });

  it('원래 없던 줄을 비운 채 저장하면 아무것도 안 한다', () => {
    expect(planSave(FULL, null, EMPTY_PRICES).kind).toBe('none');
  });

  it('0 은 값이라 줄이 남는다', () => {
    const plan = planSave(FULL, null, prices(0, null, null));

    expect(plan.kind).toBe('upsert');
    if (plan.kind === 'upsert') expect(plan.values.price).toBe(0);
  });

  it('바뀐 게 없으면 건드리지 않는다', () => {
    const saved = prices(130000, 90000, null);
    expect(planSave(FULL, saved, prices(130000, 90000, null)).kind).toBe('none');
  });

  it('못 쓰는 칸에 넣은 값은 버린다', () => {
    const plan = planSave(PLAIN, null, prices(130000, 90000, 20000));

    expect(plan.kind).toBe('upsert');
    if (plan.kind === 'upsert') {
      expect(plan.values.ponticPrice).toBeNull();
      expect(plan.values.pinkPrice).toBeNull();
    }
  });

  it('못 쓰는 칸에만 값을 넣었으면 저장할 것이 없다', () => {
    expect(planSave(PLAIN, null, prices(null, 90000, 20000)).kind).toBe('none');
  });
});

describe('사람이 친 글자', () => {
  it('빈 칸은 값 없음이다', () => {
    expect(parseAmount('')).toEqual({ ok: true, value: null });
    expect(parseAmount('   ')).toEqual({ ok: true, value: null });
  });

  it('0 은 값이다', () => {
    expect(parseAmount('0')).toEqual({ ok: true, value: 0 });
  });

  it('쉼표를 지우고 읽는다', () => {
    expect(parseAmount('130,000')).toEqual({ ok: true, value: 130000 });
  });

  it('음수와 글자는 막는다', () => {
    expect(parseAmount('-1').ok).toBe(false);
    expect(parseAmount('만원').ok).toBe(false);
    expect(parseAmount('1000.5').ok).toBe(false);
  });

  it('찍을 때 없으면 하이픈, 0 은 0', () => {
    expect(formatAmount(null)).toBe('-');
    expect(formatAmount(0)).toBe('0');
    expect(formatAmount(130000)).toBe('130,000');
  });
});
