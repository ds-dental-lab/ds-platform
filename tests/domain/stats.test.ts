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
  sortDesignersByTeeth,
  sortClinicsByTeeth,
} from '@/server/domain/stats';

const designer = (over: Partial<DesignerTally>): DesignerTally => ({
  userId: 'u',
  name: '아무개',
  picked: 0,
  pickedTeeth: 0,
  handed: 0,
  handedTeeth: 0,
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
    teeth: 0,
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

// =========================================================
// 치아 개수로도 줄 세우기 (사용자 요청 2026-10-12)
//
// ★★ 건수만으로는 일량이 안 보입니다. 한 건이 치아 하나일 때도 있고
//   스물셋일 때도 있습니다 — 건수로만 세우면 작은 건을 많이 한 사람이
//   위로 올라갑니다. 둘 다 일량이고 어느 쪽도 혼자서는 전부를 말하지
//   못해서, 두 가지 차례를 다 둡니다.
// =========================================================

describe('치아 개수 차례', () => {
  // ★ 치과 helper 는 다른 describe 안에 있어 여기서 하나 더 둡니다
  const clinicRow = (over: Partial<ClinicTally>): ClinicTally => ({
    orgId: 'o',
    name: '치과',
    orders: 0,
    teeth: 0,
    remakes: 0,
    repairs: 0,
    ...over,
  });

  it('★ 건수가 적어도 치아가 많으면 위로 옵니다', () => {
    const 큰건 = designer({ userId: 'a', name: '가', handed: 2, handedTeeth: 30 });
    const 잔건 = designer({ userId: 'b', name: '나', handed: 9, handedTeeth: 9 });

    expect(sortDesignersByTeeth([잔건, 큰건])[0].userId).toBe('a');
    // ★ 건수로 세우면 차례가 뒤집힙니다 — 그래서 둘 다 둡니다
    expect(sortDesigners([잔건, 큰건])[0].userId).toBe('b');
  });

  it('치아 수가 같으면 잡은 개수로, 그다음 이름순', () => {
    const a = designer({ userId: 'a', name: '나', handedTeeth: 5, pickedTeeth: 5 });
    const b = designer({ userId: 'b', name: '가', handedTeeth: 5, pickedTeeth: 9 });

    expect(sortDesignersByTeeth([a, b])[0].userId).toBe('b');
  });

  it('치과도 치아 개수로 세웁니다', () => {
    const 많이 = clinicRow({ orgId: 'x', name: '가', orders: 1, teeth: 20 });
    const 자주 = clinicRow({ orgId: 'y', name: '나', orders: 8, teeth: 8 });

    expect(sortClinicsByTeeth([자주, 많이])[0].orgId).toBe('x');
    expect(sortClinics([자주, 많이])[0].orgId).toBe('y');
  });

  it('빈 목록도 됩니다', () => {
    expect(sortDesignersByTeeth([])).toEqual([]);
    expect(sortClinicsByTeeth([])).toEqual([]);
  });
});

