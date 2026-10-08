// =========================================================
// 놓을 위치: tests/domain/pricing.test.ts
// 기준: 거래처별 단가 규칙 — 비어 있음과 0 은 다릅니다
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  isPriceable,
  resolvePrice,
  resolvePartyPrice,
  resolvePrices,
  priceSource,
  planSave,
  parseAmount,
  formatAmount,
  EMPTY_PRICES,
  priceOn,
  type DatedPrice,
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

// =========================================================
// 기공원가에는 제품 기본가가 없습니다 (2026-08-12 발견)
//
// ★ prosthesis_materials.price 는 '치과에 파는 값' 입니다.
//   기공소에도 그 값으로 떨어지게 두면, 기공원가를 안 정한 칸이
//   치과 판매가 그대로 잡힙니다 — 5만원에 팔고 5만원을 지급하는 셈입니다.
// =========================================================

describe('거래처 종류에 따른 기본가', () => {
  const base = 150000;

  it('치과는 기본가로 떨어진다', () => {
    expect(resolvePartyPrice(base, null, 'clinic')).toBe(base);
  });

  // ★ 이것이 이 함수가 있는 이유입니다
  it('★ 기공소는 안 정했으면 미정이다 — 판매가로 떨어지지 않는다', () => {
    expect(resolvePartyPrice(base, null, 'lab')).toBeNull();
  });

  it('기공소도 정해 뒀으면 그 값이다', () => {
    expect(resolvePartyPrice(base, 40000, 'lab')).toBe(40000);
  });

  it('기공소 0원은 0원이다 (미정이 아닙니다)', () => {
    expect(resolvePartyPrice(base, 0, 'lab')).toBe(0);
  });

  it('치과는 덮어쓴 값이 이긴다', () => {
    expect(resolvePartyPrice(base, 130000, 'clinic')).toBe(130000);
  });
});

// =========================================================
// 배송일에 유효했던 단가 (사용자 결정 2026-10-08)
//
// ★★ 전에는 정산이 **지금** 단가표를 읽어서, 10월 8일에 값을 올리면
//   10월 1일에 이미 배송된 건까지 올라갔습니다. 메이트 치과에서 실제로
//   났습니다(임플란트 1 → 2). 이제 바뀐 날을 같이 남기고 그 건의
//   배송일에 유효했던 줄을 고릅니다.
// =========================================================

function at(day: string, price: number | null): DatedPrice {
  return { effectiveFrom: day, price, ponticPrice: null, pinkPrice: null };
}

describe('배송일로 단가를 고릅니다', () => {
  const 줄 = [at('2026-09-21', 1), at('2026-10-08', 2)];

  it('바뀌기 전에 나간 건은 옛 값입니다', () => {
    expect(priceOn(줄, '2026-10-01').price).toBe(1);
  });

  // ★ "오늘부터" 라고 말했을 때 사람이 기대하는 쪽입니다
  it('★ 바꾼 날 나간 건은 새 값입니다', () => {
    expect(priceOn(줄, '2026-10-08').price).toBe(2);
  });

  it('그 뒤로도 새 값입니다', () => {
    expect(priceOn(줄, '2026-12-25').price).toBe(2);
  });

  it('줄 순서가 뒤섞여 와도 같습니다', () => {
    const 뒤섞임 = [at('2026-10-08', 2), at('2026-09-21', 1)];
    expect(priceOn(뒤섞임, '2026-10-01').price).toBe(1);
  });

  // ★ 하루에 세 번 고쳐도 DB 가 한 줄만 남깁니다(unique index).
  //   그래도 두 줄이 들어오면 **마지막에 적힌 값**을 씁니다.
  it('같은 날짜가 둘이면 뒤에 온 줄이 이깁니다', () => {
    expect(priceOn([at('2026-10-08', 2), at('2026-10-08', 3)], '2026-10-08').price).toBe(3);
  });

  /*
    ★★ 기록을 남기기 **전에** 배송된 건들입니다 (2026-10-08 미그레이션 전).
      지나간 값은 아무도 적어 두지 않았으니 알 길이 없습니다. 기본가로
      떨어뜨리면 그 건들의 청구액이 **오늘 갑자기 달라집니다** —
      '처음부터 그 값이었다' 로 두는 것이 덜 틀립니다.
  */
  it('★ 모든 줄보다 이른 날이면 가장 오래된 줄을 씁니다', () => {
    expect(priceOn(줄, '2026-08-01').price).toBe(1);
  });

  it('줄이 없으면 덮어쓰기가 없습니다 (기본가로)', () => {
    expect(priceOn([], '2026-10-08')).toEqual(EMPTY_PRICES);
  });

  // ★ 0 과 비어 있음은 다릅니다. 0 원 거래처 단가가 기본가로 새면 안 됩니다
  it('★ 0원도 값입니다', () => {
    expect(priceOn([at('2026-10-01', 0)], '2026-10-08').price).toBe(0);
  });

  // ★ 줄을 지운 날 — 그 날부터 덮어쓰기가 없습니다(치과는 기본가로)
  it('★ 비운 줄은 비운 채로 옵니다', () => {
    const 지움 = [at('2026-09-21', 1), at('2026-10-08', null)];
    expect(priceOn(지움, '2026-10-08').price).toBeNull();
    expect(priceOn(지움, '2026-10-07').price).toBe(1);
  });

  it('폰틱·핑크도 그 날 값으로 함께 옵니다', () => {
    const 줄들: DatedPrice[] = [
      { effectiveFrom: '2026-09-21', price: 1, ponticPrice: 1, pinkPrice: 1 },
      { effectiveFrom: '2026-10-08', price: 2, ponticPrice: 3, pinkPrice: 4 },
    ];
    expect(priceOn(줄들, '2026-10-08')).toEqual({ price: 2, ponticPrice: 3, pinkPrice: 4 });
  });

  it('받은 줄을 건드리지 않습니다', () => {
    const 원본 = [at('2026-10-08', 2), at('2026-09-21', 1)];
    priceOn(원본, '2026-10-01');
    expect(원본[0].effectiveFrom).toBe('2026-10-08');
  });
});
