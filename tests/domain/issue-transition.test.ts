// =========================================================
// 놓을 위치: tests/domain/issue-transition.test.ts
//
// 상태가 바뀔 때 이슈 딱지를 여닫는 규칙. (사용자 신고 2026-08-13 —
//   "재스캔 이슈 조회가 되질 않는다")
//
// ★ 이 규칙이 아무 데도 없어서 재스캔 딱지가 한 번도 안 열렸습니다.
//   닫는 코드만 있었고, 열린 적이 없으니 늘 헛돌았습니다.
//   같은 일이 조용히 다시 생기지 않게 여기서 못박습니다.
// =========================================================

import { describe, it, expect } from 'vitest';
import { issueOnTransition, STATUS_ORDER } from '@/server/domain/order-status';

describe('재스캔 딱지는 상태를 따라 여닫힌다', () => {
  it('★ 재스캔으로 넘기면 딱지를 연다 — 이것이 없어서 필터가 늘 0이었습니다', () => {
    expect(issueOnTransition('received', 'rescan')).toEqual({
      open: 'rescan',
      resolve: null,
    });
    expect(issueOnTransition('designing', 'rescan')).toEqual({
      open: 'rescan',
      resolve: null,
    });
  });

  it('재업로드로 접수에 돌아오면 닫는다', () => {
    expect(issueOnTransition('rescan', 'received')).toEqual({
      open: null,
      resolve: 'rescan',
    });
  });

  it('★ 재업로드가 아닌 길로 나가도 닫힌다 — 안 그러면 다음 재스캔이 두 번 세어집니다', () => {
    for (const to of STATUS_ORDER) {
      if (to === 'rescan') continue;
      expect(issueOnTransition('rescan', to).resolve).toBe('rescan');
    }
  });

  it('재스캔과 무관한 전이는 아무것도 안 건드린다', () => {
    expect(issueOnTransition('designing', 'production_wait')).toEqual({
      open: null,
      resolve: null,
    });
    expect(issueOnTransition('production', 'shipping')).toEqual({
      open: null,
      resolve: null,
    });
    expect(issueOnTransition('shipping', 'completed')).toEqual({
      open: null,
      resolve: null,
    });
  });

  it('여는 것과 닫는 것이 한 번에 일어나지는 않는다', () => {
    for (const from of STATUS_ORDER) {
      for (const to of STATUS_ORDER) {
        const change = issueOnTransition(from, to);
        expect(change.open === null || change.resolve === null).toBe(true);
      }
    }
  });
});
