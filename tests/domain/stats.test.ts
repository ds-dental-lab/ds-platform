// =========================================================
// 놓을 위치: tests/domain/stats.test.ts
// 기준: 사용자 요청 2026-08-12 — 디자이너 일량 / 리메이크율 / 치과별 주문
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  ratePercent,
  formatPercent,
  isSmallSample,
  sortDesigners,
  sortClinics,
  average,
  SMALL_SAMPLE,
  type DesignerTally,
  type ClinicTally,
} from '@/server/domain/stats';

const designer = (over: Partial<DesignerTally>): DesignerTally => ({
  userId: 'u',
  name: '아무개',
  picked: 0,
  handed: 0,
  remade: 0,
  avgDays: null,
  amount: 0,
  amountUnpriced: false,
  ...over,
});

describe('비율', () => {
  it('소수 한 자리까지', () => {
    expect(ratePercent(1, 3)).toBe(33.3);
    expect(ratePercent(1, 8)).toBe(12.5);
    expect(ratePercent(2, 2)).toBe(100);
  });

  // ★ 0% 로 적으면, 한 건도 안 한 사람이 제일 잘한 사람이 됩니다
  it('★ 모수가 없으면 0%가 아니라 없음입니다', () => {
    expect(ratePercent(0, 0)).toBeNull();
    expect(formatPercent(ratePercent(0, 0))).toBe('—');
  });

  it('실제로 0건이면 0% 입니다', () => {
    expect(ratePercent(0, 10)).toBe(0);
    expect(formatPercent(0)).toBe('0%');
  });

  it('모수가 적으면 표를 답니다', () => {
    expect(isSmallSample(SMALL_SAMPLE - 1)).toBe(true);
    expect(isSmallSample(SMALL_SAMPLE)).toBe(false);
    expect(isSmallSample(0)).toBe(false); // 0건은 '적다' 가 아니라 '없다' 입니다
  });
});

describe('디자이너 차례', () => {
  // ★ 리메이크율로 줄 세우면 이 표가 사람을 세우는 자리가 됩니다
  it('★ 일한 양으로 세웁니다 — 리메이크율이 아닙니다', () => {
    const rows = sortDesigners([
      designer({ userId: 'a', name: '김', handed: 3, remade: 0 }),
      designer({ userId: 'b', name: '이', handed: 9, remade: 4 }),
    ]);

    expect(rows.map((r) => r.userId)).toEqual(['b', 'a']);
  });

  it('넘긴 수가 같으면 잡은 수로', () => {
    const rows = sortDesigners([
      designer({ userId: 'a', name: '김', handed: 2, picked: 2 }),
      designer({ userId: 'b', name: '이', handed: 2, picked: 7 }),
    ]);

    expect(rows.map((r) => r.userId)).toEqual(['b', 'a']);
  });

  it('그것도 같으면 이름순', () => {
    const rows = sortDesigners([
      designer({ userId: 'b', name: '이영희' }),
      designer({ userId: 'a', name: '강민수' }),
    ]);

    expect(rows.map((r) => r.name)).toEqual(['강민수', '이영희']);
  });

  it('원래 배열을 안 건드립니다', () => {
    const rows = [designer({ userId: 'a', handed: 1 }), designer({ userId: 'b', handed: 5 })];
    sortDesigners(rows);

    expect(rows.map((r) => r.userId)).toEqual(['a', 'b']);
  });
});

describe('치과 차례', () => {
  const clinic = (over: Partial<ClinicTally>): ClinicTally => ({
    orgId: 'o',
    name: '치과',
    orders: 0,
    remakes: 0,
    repairs: 0,
    ...over,
  });

  it('많이 넣은 곳부터', () => {
    const rows = sortClinics([
      clinic({ orgId: 'a', name: '가치과', orders: 3 }),
      clinic({ orgId: 'b', name: '나치과', orders: 11 }),
    ]);

    expect(rows.map((r) => r.orgId)).toEqual(['b', 'a']);
  });
});

describe('평균', () => {
  it('소수 한 자리', () => {
    expect(average([1, 2, 2])).toBe(1.7);
  });

  it('잰 것이 없으면 없음', () => {
    expect(average([])).toBeNull();
  });
});
