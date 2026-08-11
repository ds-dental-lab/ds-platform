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
