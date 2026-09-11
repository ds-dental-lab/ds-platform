// 정산 기준일을 바꾼 뒤에도 어떤 날짜든 정확히 한 달에만 드는가 (2026-09-11 — 치과가 기준일을 고름)
import { describe, it, expect } from 'vitest';
import {
  effectivePeriodRange,
  effectivePeriodOfDate,
  periodRange,
  moneyRanges,
  type StoredPeriod,
} from '@/server/domain/billing';

function days(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  while (d.toISOString().slice(0, 10) <= to) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** 모든 날짜가 자기 달의 범위 안에 있고, 이웃 달끼리 빈틈·겹침이 없는가 */
function assertSeamless(stored: StoredPeriod[], day: number, months: string[]) {
  const ranges = months.map((m) => ({ m, ...effectivePeriodRange(m, day, stored) }));
  for (let i = 1; i < ranges.length; i++) {
    const prevEnd = new Date(`${ranges[i - 1].to}T00:00:00Z`);
    prevEnd.setUTCDate(prevEnd.getUTCDate() + 1);
    expect(ranges[i].from, `${ranges[i].m} 시작`).toBe(prevEnd.toISOString().slice(0, 10));
  }
  for (const r of ranges) {
    for (const d of days(r.from, r.to)) expect(effectivePeriodOfDate(d, day, stored), d).toBe(r.m);
  }
}

const MONTHS = ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];

describe('effectivePeriodRange — 기준일을 바꾼 직후', () => {
  it('26일 → 1일: 8월을 닫은 뒤 9월은 08-26 ~ 09-30 (빈 6일을 9월이 안음)', () => {
    const stored: StoredPeriod[] = [
      { yearMonth: '2026-07', ...periodRange('2026-07', 26) },
      { yearMonth: '2026-08', ...periodRange('2026-08', 26) },
    ];
    expect(effectivePeriodRange('2026-09', 1, stored)).toEqual({ from: '2026-08-26', to: '2026-09-30' });
    expect(effectivePeriodRange('2026-10', 1, stored)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(effectivePeriodOfDate('2026-08-28T10:00:00Z', 1, stored)).toBe('2026-09');
    assertSeamless(stored, 1, MONTHS);
  });

  it('1일 → 26일: 8월을 닫은 뒤 9월은 09-01 ~ 09-25 (겹치는 6일을 두 번 안 받음)', () => {
    const stored: StoredPeriod[] = [{ yearMonth: '2026-08', ...periodRange('2026-08', 1) }];
    expect(effectivePeriodRange('2026-09', 26, stored)).toEqual({ from: '2026-09-01', to: '2026-09-25' });
    expect(effectivePeriodRange('2026-10', 26, stored)).toEqual({ from: '2026-09-26', to: '2026-10-25' });
    expect(effectivePeriodOfDate('2026-08-28', 26, stored)).toBe('2026-08');
    assertSeamless(stored, 26, MONTHS);
  });

  it('닫은 기간은 지금 기준일과 상관없이 저장된 날짜 그대로', () => {
    const stored: StoredPeriod[] = [{ yearMonth: '2026-08', ...periodRange('2026-08', 26) }];
    expect(effectivePeriodRange('2026-08', 1, stored)).toEqual({ from: '2026-07-26', to: '2026-08-25' });
  });

  it('바꾼 적 없으면 periodRange 와 같음', () => {
    const stored: StoredPeriod[] = [{ yearMonth: '2026-08', ...periodRange('2026-08', 26) }];
    for (const m of MONTHS) expect(effectivePeriodRange(m, 26, stored)).toEqual(periodRange(m, 26));
    expect(effectivePeriodRange('2026-09', 26, [])).toEqual(periodRange('2026-09', 26));
    assertSeamless(stored, 26, MONTHS);
  });

  it('건너뛴 달(빈 달)이 있어도 틈 없음', () => {
    const stored: StoredPeriod[] = [
      { yearMonth: '2026-07', ...periodRange('2026-07', 26) },
      { yearMonth: '2026-09', ...periodRange('2026-09', 26) },
    ];
    assertSeamless(stored, 1, ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    assertSeamless(stored, 26, ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
  });
});

describe('moneyRanges — HOME 구간도 바꾼 직후 정산과 같게', () => {
  it('26일 → 1일, 08-28 오늘: 이번 구간은 08-26 ~ 09-30 (닫힌 8월이 아님)', () => {
    const stored: StoredPeriod[] = [{ yearMonth: '2026-08', ...periodRange('2026-08', 26) }];
    const ranges = moneyRanges('2026-08-28', 'clinic', 1, 3, stored);
    expect(ranges.map((r) => [r.from, r.to])).toEqual([
      ['2026-07-01', '2026-07-25'], // 기록 없는 달은 지금 기준일로, 닫힌 8월 앞에서 끊김
      ['2026-07-26', '2026-08-25'],
      ['2026-08-26', '2026-09-30'],
    ]);
  });
  it('디자인센터는 저장 기간과 무관하게 달력 월', () => {
    const stored: StoredPeriod[] = [{ yearMonth: '2026-08', ...periodRange('2026-08', 26) }];
    expect(moneyRanges('2026-08-28', 'design_center', 26, 1, stored)[0]).toMatchObject({ from: '2026-08-01', to: '2026-08-31' });
  });
});
