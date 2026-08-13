// =========================================================
// 놓을 위치: tests/domain/worklist.test.ts
// 기준: 사용자 결정 2026-08-12 — "디자인센터 사용자는 작업리스트에
//       디자이너 본인만"
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  visibleWork,
  sortWork,
  ownerOf,
  WORK_STATUSES,
  type WorklistRow,
} from '@/server/domain/worklist';

interface Row extends WorklistRow {
  id: string;
}

const row = (over: Partial<Row>): Row => ({
  id: 'x',
  ownerId: '나',
  dayCount: 1,
  dueDate: '2026-08-20',
  ...over,
});

describe('누구의 것이 보이는가', () => {
  const rows = [
    row({ id: 'a', ownerId: '나' }),
    row({ id: 'b', ownerId: '남' }),
    row({ id: 'c', ownerId: null }),
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
    expect(visibleWork([row({ id: 'c', ownerId: null })], '나', false)).toEqual([]);
  });

  it('주인 없는 일은 관리자에게는 보입니다', () => {
    expect(visibleWork([row({ id: 'c', ownerId: null })], '나', true)).toHaveLength(1);
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

// ---------- 세 섹터가 다 씁니다 (2026-08-13) ----------
//
// 계정마다 HOME 이 제각각이라는 지적에서 나왔습니다. 전에는 이 목록이
// 디자인센터에만 있어서, 사용자 계정은 왼쪽 칸에 카드가 하나뿐이었습니다.

describe('섹터마다 임자가 다릅니다', () => {
  const both = { designerId: '디자이너', createdBy: '접수한사람' };

  it('디자인센터의 임자는 디자인을 잡은 사람', () => {
    expect(ownerOf('design_center', both)).toBe('디자이너');
  });

  it('치과의 임자는 주문을 넣은 사람', () => {
    expect(ownerOf('clinic', both)).toBe('접수한사람');
  });

  // ★ 기공소는 사람이 아니라 조직 단위로 받습니다 (lab_org_id).
  //   없는 주인을 지어내면 사용자 계정에서 목록이 늘 비어 보입니다.
  it('★ 기공소는 임자가 없습니다', () => {
    expect(ownerOf('lab', both)).toBeNull();
  });
});

describe('임자를 안 두는 섹터', () => {
  const rows = [
    row({ id: 'a', ownerId: null }),
    row({ id: 'b', ownerId: null }),
  ];

  // ★ 이걸 안 넘기면 기공소 사용자에게 목록이 통째로 안 보입니다
  it('★ 기공소 사용자도 전부 봅니다', () => {
    expect(visibleWork(rows, '나', false, true).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('임자를 두는 섹터에서는 여전히 안 보입니다', () => {
    expect(visibleWork(rows, '나', false, false)).toEqual([]);
  });
});

describe('어떤 상태가 내 손에 있는 일인가', () => {
  // ★ 치과는 물건을 기다리는 쪽이라 어느 단계든 궁금합니다
  it('★ 치과는 끝날 때까지 자기 일입니다', () => {
    expect(WORK_STATUSES.clinic).toContain('received');
    expect(WORK_STATUSES.clinic).toContain('shipping');
  });

  // ★ 제작주문으로 넘기면 그때부터 기공소의 일입니다
  it('★ 디자인센터는 디자인을 잡은 동안만', () => {
    expect(WORK_STATUSES.design_center).toEqual(['designing']);
  });

  it('★ 기공소는 제작대기·제작. 배송으로 넘어가면 손을 뗍니다', () => {
    expect(WORK_STATUSES.lab).toEqual(['production_wait', 'production']);
    expect(WORK_STATUSES.lab).not.toContain('shipping');
  });

  it('완료·취소는 어느 섹터에도 안 들어갑니다', () => {
    for (const list of Object.values(WORK_STATUSES)) {
      expect(list).not.toContain('completed');
      expect(list).not.toContain('cancelled');
    }
  });
});
