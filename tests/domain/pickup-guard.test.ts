// =========================================================
// 놓을 위치: tests/domain/pickup-guard.test.ts
//
// 수거가 끝나야 제작을 시작할 수 있다는 규칙.
// 실제 차단은 services/order-status 가 DB 를 보고 하지만,
// 여기서는 화면이 버튼을 어떻게 가려야 하는지를 못박습니다.
// =========================================================

import { describe, it, expect } from 'vitest';
import { getAvailableActions } from '@/server/domain/order-status';

/** 화면이 쓰는 것과 같은 규칙 — 앞으로 넘기는 것만 막고 되돌리기는 남깁니다 */
function visibleActions(status: 'production_wait', blocked: boolean) {
  const all = getAvailableActions(status, 'lab');
  return blocked ? all.filter((a) => a.danger) : all;
}

describe('수거 전에는 제작을 시작할 수 없다', () => {
  it('수거가 안 끝났으면 제작 시작 버튼이 없다', () => {
    expect(visibleActions('production_wait', true)).toHaveLength(0);
  });

  it('★ 수거가 끝나면 제작 시작이 열린다', () => {
    const actions = visibleActions('production_wait', false);

    expect(actions).toHaveLength(1);
    expect(actions[0].to).toBe('production');
    expect(actions[0].label).toBe('제작 시작');
  });

  it('제작 다음은 출고다 — 수거와 무관하게 기존 흐름을 탄다', () => {
    const actions = getAvailableActions('production', 'lab');

    expect(actions[0].to).toBe('shipping');
    expect(actions[0].label).toBe('출고');
  });
});
