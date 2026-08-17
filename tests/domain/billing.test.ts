// =========================================================
// 놓을 위치: tests/domain/billing.test.ts
// 기준: 사용자 확정 2026-08-11 — 정산 기간 규칙
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  yearMonthOf,
  nextYearMonth,
  isValidYearMonth,
  isBillable,
  basePeriodOf,
  postingPeriod,
  isExpectedIn,
  prevYearMonth,
  periodRange,
  periodOfDate,
  isValidClosingDay,
  itemAmount,
  sumItems,
  canClosePeriod,
  canIssueInvoice,
  repriceWarning,
  settlementParties,
  canReopenPeriod,
  splitItemLines,
  invoicePartiesFor,
  checkAdjustment,
  groupInvoiceLines,
  formatTeeth,
  moneyRange,
  moneyRanges,
  type GroupableItem,
} from '@/server/domain/billing';

describe('달 셈', () => {
  it('날짜에서 달을 뽑는다', () => {
    expect(yearMonthOf('2026-08-11')).toBe('2026-08');
    expect(yearMonthOf('2026-08-11T14:30:00.000Z')).toBe('2026-08');
  });

  it('다음 달로 넘어간다', () => {
    expect(nextYearMonth('2026-08')).toBe('2026-09');
  });

  it('12월은 해를 넘긴다', () => {
    expect(nextYearMonth('2026-12')).toBe('2027-01');
  });

  it('모양을 검사한다', () => {
    expect(isValidYearMonth('2026-08')).toBe(true);
    expect(isValidYearMonth('2026-13')).toBe(false);
    expect(isValidYearMonth('2026-8')).toBe(false);
  });
});

// =========================================================
// 무엇을 청구하는가
// =========================================================

describe('청구 대상', () => {
  it('★ 배송으로 넘어간 것만 센다', () => {
    expect(isBillable({ shippedAt: '2026-08-11T00:00:00Z', isBillable: true })).toBe(true);
    expect(isBillable({ shippedAt: null, isBillable: true })).toBe(false);
  });

  it('★ 리메이크·리페어는 청구하지 않는다', () => {
    expect(isBillable({ shippedAt: '2026-08-11T00:00:00Z', isBillable: false })).toBe(false);
  });

  it('★ 기간은 배송일로 가른다 — 요청시한이 아니다', () => {
    // 요청시한이 8월이어도 9월에 나갔으면 9월 정산입니다
    expect(basePeriodOf({ shippedAt: '2026-09-05T02:00:00Z', isBillable: true }, 1)).toBe('2026-09');
  });

  // ★ 같은 날 나간 같은 물건인데 치과마다 정산 달이 다릅니다
  it('★ 기준일이 다르면 같은 배송일도 다른 달로 간다', () => {
    const order = { shippedAt: '2026-08-26T02:00:00Z', isBillable: true };

    expect(basePeriodOf(order, 1)).toBe('2026-08');
    expect(basePeriodOf(order, 26)).toBe('2026-09');
  });

  it('안 나간 건은 아직 어느 달에도 안 든다', () => {
    expect(basePeriodOf({ shippedAt: null, isBillable: true }, 26)).toBeNull();
  });
});

// =========================================================
// 딱지를 어디에 찍는가
//
// ★ '요청시한 전후' 가 아니라 '마감 전후' 로 봅니다.
// =========================================================

describe('딱지 찍기', () => {
  it('★ 열려 있는 달이면 그 달에 붙는다', () => {
    const periods = [{ yearMonth: '2026-08', closed: false }];
    expect(postingPeriod('2026-08', periods)).toBe('2026-08');
  });

  it('★ 요청시한이 지났어도 그 달이 안 닫혔으면 그 달이다', () => {
    // 요청시한 8/20 인 건에 8/25 차액 발생 — 8월은 아직 열려 있습니다
    const periods = [{ yearMonth: '2026-08', closed: false }];
    expect(postingPeriod('2026-08', periods)).toBe('2026-08');
  });

  it('★ 마감됐으면 다음 달로 넘어간다', () => {
    const periods = [
      { yearMonth: '2026-08', closed: true },
      { yearMonth: '2026-09', closed: false },
    ];
    expect(postingPeriod('2026-08', periods)).toBe('2026-09');
  });

  it('★ 연달아 마감돼 있으면 열린 달까지 계속 민다', () => {
    const periods = [
      { yearMonth: '2026-08', closed: true },
      { yearMonth: '2026-09', closed: true },
      { yearMonth: '2026-10', closed: false },
    ];
    expect(postingPeriod('2026-08', periods)).toBe('2026-10');
  });

  it('아직 안 만든 달은 열려 있는 것으로 본다', () => {
    const periods = [{ yearMonth: '2026-08', closed: true }];
    expect(postingPeriod('2026-08', periods)).toBe('2026-09');
  });

  it('전부 마감돼 있으면 그 뒤 새 달로 간다', () => {
    const periods = [
      { yearMonth: '2026-11', closed: true },
      { yearMonth: '2026-12', closed: true },
    ];
    expect(postingPeriod('2026-11', periods)).toBe('2027-01');
  });

  it('아무 기간도 없으면 원하는 달 그대로', () => {
    expect(postingPeriod('2026-08', [])).toBe('2026-08');
  });
});

// =========================================================
// 예상 청구액 — 여기서만 요청시한을 씁니다
// =========================================================

describe('예상 청구액', () => {
  it('아직 안 나간 건은 요청시한이 든 달에 어림잡는다', () => {
    expect(
      isExpectedIn('2026-08', { shippedAt: null, dueDate: '2026-08-20', isBillable: true }),
    ).toBe(true);
  });

  it('★ 이미 나갔으면 어림이 아니라 배송일을 따른다', () => {
    // 요청시한은 8월이지만 9월에 나갔으므로 8월 예상에서 빠집니다
    const order = { shippedAt: '2026-09-05T00:00:00Z', dueDate: '2026-08-20', isBillable: true };

    expect(isExpectedIn('2026-08', order)).toBe(false);
    expect(isExpectedIn('2026-09', order)).toBe(true);
  });

  it('리메이크는 예상에도 안 든다', () => {
    expect(
      isExpectedIn('2026-08', { shippedAt: null, dueDate: '2026-08-20', isBillable: false }),
    ).toBe(false);
  });
});

// =========================================================
// 기준일이 기간을 가릅니다 (거래처마다 다릅니다) — 2026-08-11 결정
// =========================================================

describe('기준일과 기간', () => {
  it('1일 기준은 그 달 통째다', () => {
    expect(periodRange('2026-08', 1)).toEqual({ from: '2026-08-01', to: '2026-08-31' });
  });

  it('26일 기준은 지난달 26일에 시작한다', () => {
    expect(periodRange('2026-08', 26)).toEqual({ from: '2026-07-26', to: '2026-08-25' });
  });

  it('짧은 달도 끝을 맞춘다', () => {
    expect(periodRange('2026-02', 1)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(periodRange('2026-03', 1)).toEqual({ from: '2026-03-01', to: '2026-03-31' });
  });

  it('윤년 2월을 안다', () => {
    expect(periodRange('2028-02', 1).to).toBe('2028-02-29');
  });

  it('해를 넘긴다', () => {
    expect(periodRange('2027-01', 26)).toEqual({ from: '2026-12-26', to: '2027-01-25' });
  });

  it('배송일이 어느 달로 가는지 안다', () => {
    expect(periodOfDate('2026-08-07', 26)).toBe('2026-08');
    expect(periodOfDate('2026-08-25', 26)).toBe('2026-08');
    expect(periodOfDate('2026-08-26', 26)).toBe('2026-09');
  });

  it('1일 기준은 달을 그대로 쓴다', () => {
    expect(periodOfDate('2026-08-01', 1)).toBe('2026-08');
    expect(periodOfDate('2026-08-31', 1)).toBe('2026-08');
  });

  it('시각이 붙어 있어도 읽는다', () => {
    expect(periodOfDate('2026-08-26T09:30:00.000Z', 26)).toBe('2026-09');
  });

  // ★ 둘이 어긋나면 어떤 건은 어느 달에도 안 잡히고 어떤 건은 두 번 잡힙니다
  it('★ 기간의 첫날과 끝날은 그 기간으로 되돌아온다', () => {
    for (const day of [1, 5, 15, 26, 28]) {
      for (const ym of ['2026-01', '2026-02', '2026-08', '2026-12']) {
        const { from, to } = periodRange(ym, day);

        expect(periodOfDate(from, day)).toBe(ym);
        expect(periodOfDate(to, day)).toBe(ym);
      }
    }
  });

  it('기준일은 1~28 만 받는다', () => {
    expect(isValidClosingDay(1)).toBe(true);
    expect(isValidClosingDay(28)).toBe(true);
    expect(isValidClosingDay(29)).toBe(false);
    expect(isValidClosingDay(0)).toBe(false);
    expect(isValidClosingDay(1.5)).toBe(false);
  });

  it('잘못된 기준일이 와도 화면이 죽지 않는다', () => {
    expect(periodRange('2026-08', 99).to).toBe('2026-08-27');
    expect(periodRange('2026-08', 0)).toEqual({ from: '2026-08-01', to: '2026-08-31' });
  });

  it('지난 달로도 간다', () => {
    expect(prevYearMonth('2026-08')).toBe('2026-07');
    expect(prevYearMonth('2026-01')).toBe('2025-12');
  });
});

// =========================================================
// 보철 한 줄이 얼마인가
// =========================================================

describe('줄 금액', () => {
  const PRICED = { price: 150000, ponticPrice: 90000, pinkPrice: 20000 };

  it('보통 줄은 판매가다', () => {
    expect(itemAmount({ ...PRICED, isPontic: false, hasGingival: false }))
      .toEqual({ amount: 150000, unpriced: false });
  });

  it('폰틱 자리는 폰틱 단가를 쓴다', () => {
    expect(itemAmount({ ...PRICED, isPontic: true, hasGingival: false }).amount).toBe(90000);
  });

  it('치은포셀린은 더한다', () => {
    expect(itemAmount({ ...PRICED, isPontic: false, hasGingival: true }).amount).toBe(170000);
  });

  // ★ 여기가 핵심입니다 — 안 정한 단가를 0원으로 삼키면 돈을 못 받습니다
  it('★ 단가를 안 정했으면 0원이 아니라 미정이다', () => {
    const out = itemAmount({ price: null, ponticPrice: null, pinkPrice: null, isPontic: false, hasGingival: false });

    expect(out.amount).toBe(0);
    expect(out.unpriced).toBe(true);
  });

  it('0원은 미정이 아니다', () => {
    const out = itemAmount({ price: 0, ponticPrice: null, pinkPrice: null, isPontic: false, hasGingival: false });

    expect(out.amount).toBe(0);
    expect(out.unpriced).toBe(false);
  });

  it('치은포셀린 값만 비어도 미정이다', () => {
    expect(itemAmount({ ...PRICED, pinkPrice: null, isPontic: false, hasGingival: true }).unpriced).toBe(true);
  });

  it('안 붙인 치은포셀린 값은 따지지 않는다', () => {
    expect(itemAmount({ ...PRICED, pinkPrice: null, isPontic: false, hasGingival: false }).unpriced).toBe(false);
  });

  it('여러 줄을 더하고, 하나라도 미정이면 합계도 미정이다', () => {
    const out = sumItems([
      { ...PRICED, isPontic: false, hasGingival: false },
      { ...PRICED, isPontic: true, hasGingival: false },
      { ...PRICED, price: null, isPontic: false, hasGingival: false },
    ]);

    expect(out.amount).toBe(240000);
    expect(out.unpriced).toBe(true);
  });
});

// =========================================================
// 마감 — 지금까지의 셈을 굳힙니다 (2026-08-12)
// =========================================================

describe('마감할 수 있는가', () => {
  const range = { from: '2026-07-26', to: '2026-08-25' };

  it('기간이 끝난 뒤에는 마감한다', () => {
    expect(canClosePeriod(range, '2026-08-26', false)).toEqual({ ok: true });
  });

  // ★ 일찍 닫으면 남은 날에 나간 물건이 조용히 다음 달로 밀립니다
  it('★ 기간이 끝나기 전에는 못 닫는다', () => {
    const verdict = canClosePeriod(range, '2026-08-20', false);

    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain('2026-08-25');
  });

  it('★ 마지막 날에도 아직 못 닫는다', () => {
    expect(canClosePeriod(range, '2026-08-25', false).ok).toBe(false);
  });

  it('★ 두 번 닫지 않는다', () => {
    expect(canClosePeriod(range, '2026-08-26', true)).toEqual({
      ok: false,
      reason: '이미 마감한 기간입니다',
    });
  });
});

// ---------- 셀 것이 없으면 안 닫습니다 (사용자 요청 2026-08-13) ----------
//
// 실제로 7월을 연습하다가, 그 달에 나간 물건이 하나도 없는 치과 둘을
// 닫아 버렸습니다. 줄이 하나도 안 굳은 빈 기간이 둘 생겼고, 청구내역이
// 비어 있는 이유를 한참 찾았습니다.

describe('빈 기간은 안 닫는다', () => {
  const range = { from: '2026-06-26', to: '2026-07-25' };
  const after = '2026-08-13';

  it('★ 청구할 건이 0이면 못 닫는다', () => {
    const verdict = canClosePeriod(range, after, false, 0);

    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('이 기간에 청구할 건이 없습니다');
  });

  it('한 줄이라도 있으면 닫힌다', () => {
    expect(canClosePeriod(range, after, false, 1)).toEqual({ ok: true });
  });

  // ★ 0원과 '없음' 은 다릅니다. 무상 처리한 건도 청구서에는 남아야 합니다
  it('★ 0원짜리 줄만 있어도 닫힌다 — 0원과 없음은 다릅니다', () => {
    expect(canClosePeriod(range, after, false, 3).ok).toBe(true);
  });

  it('건수를 안 주면 예전처럼 닫힌다 — 날짜만 보던 곳이 안 깨집니다', () => {
    expect(canClosePeriod(range, after, false)).toEqual({ ok: true });
  });

  // ★ 날짜가 먼저입니다. 아직 안 끝난 기간은 건수와 상관없이 못 닫습니다
  it('★ 기간이 안 끝났으면 건수가 있어도 못 닫는다', () => {
    const verdict = canClosePeriod(range, '2026-07-20', false, 5);

    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain('2026-07-25');
  });
});

// ---------- 다음 달에 영향이 없어야 합니다 (사용자 조건 2026-08-13) ----------
//
// *"그 대신 다음달 진행시 문제가 있으면 안 됨"*.
// 기간은 (거래처 · 연월) 마다 따로 서고, 앞 기간을 보지 않습니다.

describe('★ 빈 달을 건너뛰어도 다음 달이 멀쩡합니다', () => {
  const july = periodRange('2026-07', 26);
  const august = periodRange('2026-08', 26);

  it('7월을 못 닫아도 8월은 닫힌다', () => {
    // 7월: 건이 없어 막힘
    expect(canClosePeriod(july, '2026-08-26', false, 0).ok).toBe(false);
    // 8월: 앞 달과 무관하게 닫힘
    expect(canClosePeriod(august, '2026-09-26', false, 2).ok).toBe(true);
  });

  it('★ 두 기간이 안 겹치고 사이가 안 벌어진다 — 넘어갈 물건이 없습니다', () => {
    expect(july.to < august.from).toBe(true);

    const dayAfterJuly = new Date(Date.parse(`${july.to}T00:00:00Z`) + 86400000)
      .toISOString()
      .slice(0, 10);

    expect(dayAfterJuly).toBe(august.from);
  });

  it('★ 7월 마지막 날 배송분은 8월이 아니라 7월로 간다', () => {
    // 못 닫은 달의 물건이 다음 달로 밀리는 일은 없습니다 — 구간이 정합니다
    expect(periodOfDate(july.to, 26)).toBe('2026-07');
    expect(periodOfDate(august.from, 26)).toBe('2026-08');
  });
});

describe('마감을 되돌릴 수 있는가', () => {
  it('청구서를 뽑기 전이면 되돌린다', () => {
    expect(canReopenPeriod({ closedAt: '2026-08-26T00:00:00Z', issuedAt: null })).toEqual({
      ok: true,
    });
  });

  // ★ 한 번 나간 청구서의 숫자가 달라지면 신뢰가 무너집니다
  it('★ 청구서를 뽑았으면 못 되돌린다', () => {
    const verdict = canReopenPeriod({
      closedAt: '2026-08-26T00:00:00Z',
      issuedAt: '2026-08-27T00:00:00Z',
    });

    expect(verdict.ok).toBe(false);
  });

  it('안 닫은 기간은 되돌릴 것이 없다', () => {
    expect(canReopenPeriod({ closedAt: null, issuedAt: null }).ok).toBe(false);
  });
});

describe('정산줄로 펴기', () => {
  const item = {
    isPontic: false,
    hasGingival: false,
    price: 150000,
    ponticPrice: 90000,
    pinkPrice: 20000,
  };

  it('보통 줄은 기본 한 줄이다', () => {
    expect(splitItemLines(item)).toEqual([{ kind: 'base', amount: 150000 }]);
  });

  it('폰틱은 폰틱 단가로 남는다', () => {
    expect(splitItemLines({ ...item, isPontic: true })[0].amount).toBe(90000);
  });

  // ★ 합쳐 놓으면 "왜 이 이는 비싼가" 에 답할 근거가 화면에 없습니다
  it('★ 치은포셀린은 따로 뗀다', () => {
    const lines = splitItemLines({ ...item, hasGingival: true });

    expect(lines).toHaveLength(2);
    expect(lines[1]).toEqual({ kind: 'surcharge', amount: 20000, reason: '핑크 포셀린' });
  });

  // ★ 빼 버리면 청구서에서 그 보철이 통째로 사라집니다
  it('★ 단가를 안 정했어도 0원 줄로 남긴다', () => {
    expect(splitItemLines({ ...item, price: null })).toEqual([{ kind: 'base', amount: 0 }]);
  });

  it('펴 놓은 합계가 줄 금액과 같다', () => {
    const full = { ...item, hasGingival: true };
    const sum = splitItemLines(full).reduce((n, l) => n + l.amount, 0);

    expect(sum).toBe(itemAmount(full).amount);
  });
});

// =========================================================
// 청구서 방향 — 기공소는 받는 쪽입니다 (사용자 확정 2026-08-12)
// =========================================================

describe('청구서 방향', () => {
  it('치과 정산은 디자인센터가 치과에 청구한다', () => {
    const parties = invoicePartiesFor('clinic');

    expect(parties.from).toBe('design_center');
    expect(parties.to).toBe('clinic');
  });

  // ★ 여기를 뒤집으면 주는 쪽에 돈을 달라는 문서가 나갑니다
  it('★ 기공소 정산은 기공소가 디자인센터에 청구한다', () => {
    const parties = invoicePartiesFor('lab');

    expect(parties.from).toBe('lab');
    expect(parties.to).toBe('design_center');
    expect(parties.amountLabel).toBe('지급 금액');
  });
});

describe('금액 조정', () => {
  it('사유가 있으면 넣는다', () => {
    expect(checkAdjustment(-20000, '마진 불량으로 감액')).toEqual({ ok: true });
  });

  // ★ 한 달 뒤에 보면 왜 깎았는지 아무도 기억하지 못합니다
  it('★ 사유가 없으면 막는다', () => {
    expect(checkAdjustment(-20000, '   ').ok).toBe(false);
  });

  it('0 원은 조정할 것이 없다', () => {
    expect(checkAdjustment(0, '사유').ok).toBe(false);
  });

  it('더하는 조정도 된다', () => {
    expect(checkAdjustment(30000, '긴급 제작 추가금').ok).toBe(true);
  });

  it('소수는 막는다', () => {
    expect(checkAdjustment(1000.5, '사유').ok).toBe(false);
  });
});

// =========================================================
// 청구서 세부내역 묶기 — 브릿지는 물리적으로 하나입니다 (2026-08-12)
// =========================================================

describe('세부내역 묶기', () => {
  function item(over: Partial<GroupableItem> & { itemId: string; toothNumber: number }): GroupableItem {
    return {
      orderId: 'o1',
      typeCode: 'crown',
      materialCode: 'zirconia',
      isPontic: false,
      label: 'Zir-Cr',
      amount: 50000,
      adjustment: 0,
      billable: true,
      ...over,
    };
  }

  // ★ 사용자가 든 예 그대로입니다
  it('★ 15번 지르코니아 + 16번 폰틱 브릿지는 한 줄이 된다', () => {
    const items = [
      item({ itemId: 'a', toothNumber: 15 }),
      item({ itemId: 'b', toothNumber: 16, isPontic: true, label: 'Zir-Cr (Pontic)' }),
    ];

    const lines = groupInvoiceLines(items, (id) => (id === 'a' || id === 'b' ? 'br1' : null));

    expect(lines).toHaveLength(1);
    expect(lines[0].teeth).toEqual([15, 16]);
    expect(lines[0].amount).toBe(100000);
    expect(lines[0].label).toBe('Zir-Cr 브릿지 2본 (폰틱 1)');
    expect(formatTeeth(lines[0].teeth, true)).toBe('15-16');
  });

  it('세 본 브릿지도 한 줄이다', () => {
    const items = [
      item({ itemId: 'a', toothNumber: 15 }),
      item({ itemId: 'b', toothNumber: 16, isPontic: true, label: 'Zir-Cr (Pontic)' }),
      item({ itemId: 'c', toothNumber: 17 }),
    ];

    const lines = groupInvoiceLines(items, () => 'br1');

    expect(lines[0].count).toBe(3);
    expect(lines[0].label).toBe('Zir-Cr 브릿지 3본 (폰틱 1)');
    expect(formatTeeth(lines[0].teeth, true)).toBe('15-16-17');
  });

  it('낱개는 같은 주문·같은 제품끼리 묶인다', () => {
    const items = [
      item({ itemId: 'a', toothNumber: 36 }),
      item({ itemId: 'b', toothNumber: 16 }),
      item({ itemId: 'c', toothNumber: 26 }),
    ];

    const lines = groupInvoiceLines(items, () => null);

    expect(lines).toHaveLength(1);
    expect(formatTeeth(lines[0].teeth, false)).toBe('16, 26, 36');
    expect(lines[0].amount).toBe(150000);
  });

  it('★ 다른 주문끼리는 묶지 않는다', () => {
    const items = [
      item({ itemId: 'a', toothNumber: 16 }),
      item({ itemId: 'b', toothNumber: 16, orderId: 'o2' }),
    ];

    expect(groupInvoiceLines(items, () => null)).toHaveLength(2);
  });

  it('제품이 다르면 따로 선다', () => {
    const items = [
      item({ itemId: 'a', toothNumber: 16 }),
      item({ itemId: 'b', toothNumber: 26, materialCode: 'pmma', label: 'PMMA-Cr', amount: 20000 }),
    ];

    expect(groupInvoiceLines(items, () => null)).toHaveLength(2);
  });

  // ★ 0원이 낱개 금액에 묻히면 안 됩니다
  it('★ 리메이크(0원)는 청구 줄과 섞이지 않는다', () => {
    const items = [
      item({ itemId: 'a', toothNumber: 16 }),
      item({ itemId: 'b', toothNumber: 26, billable: false, amount: 0 }),
    ];

    const lines = groupInvoiceLines(items, () => null);

    expect(lines).toHaveLength(2);
    expect(lines.find((l) => !l.first.billable)?.amount).toBe(0);
  });

  it('조정도 함께 더해진다', () => {
    const items = [
      item({ itemId: 'a', toothNumber: 15 }),
      item({ itemId: 'b', toothNumber: 16, adjustment: -20000 }),
    ];

    expect(groupInvoiceLines(items, () => 'br1')[0].adjustment).toBe(-20000);
  });

  it('묶어도 합계는 그대로다', () => {
    const items = [
      item({ itemId: 'a', toothNumber: 15 }),
      item({ itemId: 'b', toothNumber: 16, isPontic: true, label: 'Zir-Cr (Pontic)' }),
      item({ itemId: 'c', toothNumber: 36, orderId: 'o2' }),
    ];

    const before = items.reduce((n, i) => n + i.amount, 0);
    const after = groupInvoiceLines(items, (id) =>
      id === 'a' || id === 'b' ? 'br1' : null,
    ).reduce((n, l) => n + l.amount, 0);

    expect(after).toBe(before);
  });
});

// =========================================================
// HOME 금액 카드 (사용자 결정 2026-08-12)
//   치과        접수일 · 자기 정산기간
//   디자인센터  배송일 · 달력 월
//   기공소      배송일 · 자기 정산기간
// =========================================================
describe('HOME 금액 구간', () => {
  it('치과는 접수일로, 자기 정산기간 안에서 센다', () => {
    expect(moneyRange('2026-08-11', 'clinic', 26)).toEqual({
      from: '2026-07-26',
      to: '2026-08-25',
      basis: 'period',
      countBy: 'received',
    });
  });

  // ★ 넣은 것과 나간 것은 다릅니다. 치과가 알고 싶은 건 넣은 쪽입니다
  it('치과와 기공소는 같은 구간이라도 세는 날짜가 다르다', () => {
    const clinic = moneyRange('2026-08-11', 'clinic', 26);
    const lab = moneyRange('2026-08-11', 'lab', 26);

    expect(clinic.from).toBe(lab.from);
    expect(clinic.to).toBe(lab.to);
    expect(clinic.countBy).toBe('received');
    expect(lab.countBy).toBe('shipped');
  });

  // ★ 거래처마다 기준일이 달라 '이번 정산기간' 이라는 게 하나로 안 나옵니다
  it('디자인센터는 기준일을 무시하고 달력 월을 쓴다', () => {
    expect(moneyRange('2026-08-11', 'design_center', 26)).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
      basis: 'calendar',
      countBy: 'shipped',
    });
  });

  it('기준일을 넘긴 날은 다음 정산기간으로 간다', () => {
    expect(moneyRange('2026-08-26', 'clinic', 26)).toMatchObject({
      from: '2026-08-26',
      to: '2026-09-25',
    });
  });

  it('1일 기준이면 정산기간이 달력 월과 같아진다', () => {
    expect(moneyRange('2026-08-11', 'clinic', 1)).toMatchObject({
      from: '2026-08-01',
      to: '2026-08-31',
    });
  });

  // 화면이 죽으면 안 됩니다 — 기준일이 비어 있는 거래처가 있을 수 있습니다
  it('잘못된 기준일이 와도 구간이 나온다', () => {
    expect(moneyRange('2026-08-11', 'lab', 0).from).toBe('2026-08-01');
  });
});

describe('금액 추이 구간', () => {
  it('오래된 것부터 여섯 개, 마지막이 이번 구간이다', () => {
    const ranges = moneyRanges('2026-08-11', 'clinic', 26, 6);

    expect(ranges).toHaveLength(6);
    expect(ranges[0]).toMatchObject({ from: '2026-02-26', to: '2026-03-25' });
    expect(ranges[5]).toMatchObject({ from: '2026-07-26', to: '2026-08-25' });
  });

  it('마지막은 moneyRange 와 같다', () => {
    const ranges = moneyRanges('2026-08-11', 'lab', 26, 6);

    expect(ranges[5]).toEqual(moneyRange('2026-08-11', 'lab', 26));
  });

  // ★ 겹치면 두 번 세어지고, 비면 통째로 빠집니다
  it('★ 구간끼리 겹치지도 비지도 않는다', () => {
    for (const day of [1, 15, 26, 28]) {
      const ranges = moneyRanges('2026-08-11', 'clinic', day, 6);

      for (let i = 1; i < ranges.length; i++) {
        const prevTo = new Date(`${ranges[i - 1].to}T00:00:00Z`).getTime();
        const from = new Date(`${ranges[i].from}T00:00:00Z`).getTime();

        expect(from - prevTo).toBe(86400000); // 딱 하루 뒤
      }
    }
  });

  it('해를 넘어간다', () => {
    expect(moneyRanges('2026-02-11', 'clinic', 1, 6)[0]).toMatchObject({
      from: '2025-09-01',
      to: '2025-09-30',
    });
  });

  it('디자인센터는 여섯 달 모두 달력 월이다', () => {
    const ranges = moneyRanges('2026-08-11', 'design_center', 26, 6);

    expect(ranges[0]).toMatchObject({ from: '2026-03-01', to: '2026-03-31' });
    expect(ranges[5]).toMatchObject({ from: '2026-08-01', to: '2026-08-31' });
  });

  it('0개를 달라고 해도 한 개는 준다', () => {
    expect(moneyRanges('2026-08-11', 'clinic', 26, 0)).toHaveLength(1);
  });
});

// ---------- 발행 규칙 (2026-08-13) ----------
//
// ★ 실제로 여기서 한 번 틀렸습니다.
//   발행 단추를 마감 규칙으로 막았더니 **이미 마감된 기간에서 발행이
//   잠겼습니다** — "이미 마감한 기간입니다" 라면서요. 일괄 마감으로
//   닫아 둔 것들이 통째로 못 나갈 뻔했습니다.

describe('발행할 수 있는가', () => {
  const range = { from: '2026-06-26', to: '2026-07-25' };
  const after = '2026-08-13';

  it('★ 이미 마감된 기간은 발행할 수 있습니다 — 발행만 남은 상태입니다', () => {
    expect(canIssueInvoice(range, after, true, false, 2)).toEqual({ ok: true });
  });

  it('아직 안 닫혔어도 기간이 끝났으면 발행합니다 — 발행이 마감까지 합니다', () => {
    expect(canIssueInvoice(range, after, false, false, 2)).toEqual({ ok: true });
  });

  it('★ 두 번 내지 않습니다', () => {
    const verdict = canIssueInvoice(range, after, true, true, 2);

    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('이미 발행한 기간입니다');
  });

  it('★ 빈 청구서는 안 냅니다 — 마감돼 있어도', () => {
    const verdict = canIssueInvoice(range, after, true, false, 0);

    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('이 기간에 청구할 건이 없습니다');
  });

  // ★ 안 닫힌 기간을 발행하면 닫기까지 하므로, 닫을 수 없는 날이면 발행도 못 합니다
  it('★ 기간이 안 끝났고 아직 안 닫혔으면 못 냅니다', () => {
    const verdict = canIssueInvoice(range, '2026-07-20', false, false, 2);

    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain('2026-07-25');
  });

  // ★ 이미 닫혀 있으면 그 판단은 닫을 때 끝났습니다 — 날짜를 다시 안 봅니다
  it('★ 이미 닫혀 있으면 날짜를 다시 안 봅니다', () => {
    expect(canIssueInvoice(range, '2026-07-20', true, false, 2)).toEqual({ ok: true });
  });
});

// ---------- 단가를 바꾸면 어디까지 흔들리나 (사용자 질문 2026-08-13) ----------
//
// ★ 지금 구조는 '주문 시점' 도 '변경 월부터' 도 아닙니다.
//   정산이 단가표를 볼 때마다 다시 읽으므로 **'마감 시점의 단가'** 입니다.
//   그래서 8월 20일에 올리면 8월 1일에 나간 건까지 소급됩니다.
//   마감된 달만 안전합니다 — 그 사실을 저장 전에 알려 주려는 규칙입니다.

describe('단가 변경 경고', () => {
  it('흔들릴 것이 없으면 아무 말도 안 합니다', () => {
    expect(repriceWarning({ months: [], orderCount: 0 })).toBeNull();
  });

  it('건수가 0이면 달이 있어도 안 띄웁니다', () => {
    expect(repriceWarning({ months: ['2026-08'], orderCount: 0 })).toBeNull();
  });

  // ★ "청구액이 바뀔 수 있습니다" 만으로는 아무도 손을 멈추지 않습니다.
  //   '8월 · 3건' 이라고 적혀야 그 3건을 확인하러 갑니다.
  it('★ 달과 건수를 같이 적습니다', () => {
    const msg = repriceWarning({ months: ['2026-08'], orderCount: 3 });

    expect(msg).toContain('2026-08');
    expect(msg).toContain('3건');
  });

  // ★ 지난 달을 안 닫아 뒀으면 그것도 함께 흔들립니다
  it('★ 안 닫힌 달이 여럿이면 다 적습니다', () => {
    const msg = repriceWarning({ months: ['2026-07', '2026-08'], orderCount: 5 });

    expect(msg).toContain('2026-07');
    expect(msg).toContain('2026-08');
  });

  // ★ 겁만 주면 안 됩니다. 안 바뀌는 것도 같이 말해야 손이 덜 떨립니다
  it('★ 마감한 달은 안 바뀐다고 밝힙니다', () => {
    const msg = repriceWarning({ months: ['2026-08'], orderCount: 1 });

    expect(msg).toContain('마감한 달은 안 바뀝니다');
  });
});

// =========================================================
// 정산 셀렉박스에 세울 거래처 (사용자 요청 2026-08-17)
// =========================================================

describe('정산 셀렉박스', () => {
  const 거래중 = { id: 'a', isActive: true };
  const 끊김 = { id: 'b', isActive: false };
  const 끊김2 = { id: 'c', isActive: false };

  it('거래중인 곳은 늘 나옵니다', () => {
    expect(settlementParties([거래중], new Set())).toEqual([거래중]);
  });

  it('거래중지된 곳은 빠집니다', () => {
    expect(settlementParties([거래중, 끊김], new Set())).toEqual([거래중]);
  });

  // ★ 목록이 깔끔해지는 대가로 받을 돈을 잃으면 안 됩니다
  it('★ 거래중지됐지만 정산이 남았으면 나옵니다', () => {
    expect(settlementParties([거래중, 끊김], new Set(['b']))).toEqual([거래중, 끊김]);
  });

  // ★ 화면에는 그 거래처 내역이 떠 있는데 셀렉박스만 비면 앞뒤가 안 맞습니다
  it('★ 지금 보고 있는 곳은 정산이 끝났어도 나옵니다', () => {
    expect(settlementParties([거래중, 끊김], new Set(), 'b')).toEqual([거래중, 끊김]);
  });

  it('보고 있는 곳만 남고 다른 끊긴 곳은 빠집니다', () => {
    expect(settlementParties([끊김, 끊김2], new Set(), 'c')).toEqual([끊김2]);
  });

  it('차례를 바꾸지 않습니다', () => {
    const rows = [끊김, 거래중, 끊김2];

    expect(settlementParties(rows, new Set(['c'])).map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('빈 목록은 빈 목록입니다', () => {
    expect(settlementParties([], new Set(['b']), 'b')).toEqual([]);
  });
});
