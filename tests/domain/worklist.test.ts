// =========================================================
// 놓을 위치: tests/domain/worklist.test.ts
// 기준: 사용자 결정 2026-08-12 — "디자인센터 사용자는 작업리스트에
//       디자이너 본인만"
// =========================================================

import { describe, it, expect } from 'vitest';
import { visibleWork, sortWork, type WorklistRow } from '@/server/domain/worklist';

interface Row extends WorklistRow {
  id: string;
}

const row = (over: Partial<Row>): Row => ({
  id: 'x',
  designerId: '나',
  dayCount: 1,
  dueDate: '2026-08-20',
  ...over,
});

describe('누구의 것이 보이는가', () => {
  const rows = [
    row({ id: 'a', designerId: '나' }),
    row({ id: 'b', designerId: '남' }),
    row({ id: 'c', designerId: null }),
  ];

  it('관리자는 전부 봅니다', () => {
    expect(visibleWork(rows, '나', true).map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  // ★ 남의 일까지 보이면 무엇이 내 몫인지 흐려집니다
  it('★ 사용자는 자기가 잡은 것만 봅니다', () => {
    expect(visibleWork(rows, '나', false).map((r) => r.id)).toEqual(['a']);
  });

  // ★ '내 것' 이라고 말할 근거가 없습니다
  it('★ 누가 잡았는지 모르는 줄은 사용자에게 안 보입니다', () => {
    expect(visibleWork([row({ id: 'c', designerId: null })], '나', false)).toEqual([]);
  });

  it('주인 없는 일은 관리자에게는 보입니다', () => {
    expect(visibleWork([row({ id: 'c', designerId: null })], '나', true)).toHaveLength(1);
  });

  // ★ 모를 때 다 보여 주는 쪽으로 기울면, 세션이 덜 읽힌 순간 남의 일이 보입니다
  it('★ 보는 사람을 모르면 아무것도 안 보여 줍니다', () => {
    expect(visibleWork(rows, null, false)).toEqual([]);
  });

  it('관리자면 보는 사람을 몰라도 봅니다 — 이미 관리자로 판정된 뒤입니다', () => {
    expect(visibleWork(rows, null, true)).toHaveLength(3);
  });
});

describe('차례', () => {
  // ★ '무엇이 급한가' 가 아니라 '무엇이 안 끝나고 있는가' 입니다
  it('★ 오래 잡고 있는 것이 맨 위', () => {
    const rows = [
      row({ id: '오늘', dayCount: 1, dueDate: '2026-08-13' }),
      row({ id: '나흘째', dayCount: 4, dueDate: '2026-08-30' }),
    ];

    expect(sortWork(rows).map((r) => r.id)).toEqual(['나흘째', '오늘']);
  });

  it('같은 날 잡은 것끼리는 요청시한이 이른 것부터', () => {
    const rows = [
      row({ id: '늦은시한', dayCount: 2, dueDate: '2026-08-30' }),
      row({ id: '이른시한', dayCount: 2, dueDate: '2026-08-14' }),
    ];

    expect(sortWork(rows).map((r) => r.id)).toEqual(['이른시한', '늦은시한']);
  });

  it('원래 배열을 안 건드립니다', () => {
    const rows = [row({ id: 'a', dayCount: 1 }), row({ id: 'b', dayCount: 5 })];
    sortWork(rows);

    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
  });
});
