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
    expect(basePeriodOf({ shippedAt: '2026-09-05T02:00:00Z', isBillable: true })).toBe('2026-09');
  });

  it('안 나간 건은 아직 어느 달에도 안 든다', () => {
    expect(basePeriodOf({ shippedAt: null, isBillable: true })).toBeNull();
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
