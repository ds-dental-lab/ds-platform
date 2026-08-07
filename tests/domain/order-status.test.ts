// =========================================================
// 놓을 위치: tests/domain/order-status.test.ts
// 기준: 기능명세서 §7, §4.10, §4.11
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  STATUS_LABEL,
  OWNER_SECTOR,
  getNextStatus,
  canRequestRescan,
  canTransition,
  canEditOrder,
  canDeleteOrder,
  canRequestRemake,
  canRequestRepair,
  getNewOrderStatus,
  isActionRequired,
  isFinished,
} from '@/server/domain/order-status';

describe('상태 목록', () => {
  it('일곱 가지', () => {
    expect(Object.keys(STATUS_LABEL)).toHaveLength(7);
  });

  it('★ 디자인 컨펌은 없다 (보류)', () => {
    expect(Object.keys(STATUS_LABEL)).not.toContain('confirm');
  });

  it('담당 섹터가 맞다', () => {
    expect(OWNER_SECTOR.received).toBe('design_center');
    expect(OWNER_SECTOR.rescan).toBe('clinic');
    expect(OWNER_SECTOR.pending).toBe('lab');
    expect(OWNER_SECTOR.shipping).toBe('clinic');
    expect(OWNER_SECTOR.completed).toBeNull();
  });
});

describe('정상 흐름', () => {
  it('접수 → 디자인 → 제작대기 → 제작 → 배송 → 완료', () => {
    expect(getNextStatus('received')).toBe('design');
    expect(getNextStatus('design')).toBe('pending');
    expect(getNextStatus('pending')).toBe('production');
    expect(getNextStatus('production')).toBe('shipping');
    expect(getNextStatus('shipping')).toBe('completed');
  });

  it('재스캔 다음은 접수', () => {
    expect(getNextStatus('rescan')).toBe('received');
  });

  it('완료가 끝이다', () => {
    expect(getNextStatus('completed')).toBeNull();
    expect(isFinished('completed')).toBe(true);
  });
});

describe('전이 권한', () => {
  it('담당 섹터는 진행시킬 수 있다', () => {
    expect(canTransition('received', 'design', 'design_center').allowed).toBe(true);
    expect(canTransition('pending', 'production', 'lab').allowed).toBe(true);
    expect(canTransition('shipping', 'completed', 'clinic').allowed).toBe(true);
  });

  it('★ 담당이 아닌 섹터는 진행시킬 수 없다', () => {
    expect(canTransition('received', 'design', 'clinic').allowed).toBe(false);
    expect(canTransition('pending', 'production', 'clinic').allowed).toBe(false);
  });

  it('★ 단계를 건너뛸 수 없다', () => {
    expect(canTransition('received', 'production', 'design_center').allowed).toBe(false);
    expect(canTransition('design', 'shipping', 'design_center').allowed).toBe(false);
  });

  it('★ 완료된 주문은 못 바꾼다', () => {
    expect(canTransition('completed', 'shipping', 'clinic').allowed).toBe(false);
  });

  it('같은 상태로는 못 바꾼다', () => {
    expect(canTransition('design', 'design', 'design_center').allowed).toBe(false);
  });

  it('막힐 때는 이유를 알려준다', () => {
    const result = canTransition('received', 'design', 'clinic');
    expect(result.reason).toBeTruthy();
  });
});

describe('되돌리기', () => {
  it('디자인센터는 재스캔을 요청할 수 있다', () => {
    expect(canRequestRescan('received', 'design_center')).toBe(true);
    expect(canRequestRescan('design', 'design_center')).toBe(true);
  });

  it('★ 치과는 스스로 되돌릴 수 없다', () => {
    expect(canRequestRescan('design', 'clinic')).toBe(false);
  });

  it('★ 기공소는 되돌릴 수 없다', () => {
    expect(canRequestRescan('production', 'lab')).toBe(false);
    expect(canTransition('production', 'rescan', 'lab').allowed).toBe(false);
  });

  it('★ 제작 이후에는 되돌릴 수 없다', () => {
    expect(canRequestRescan('pending', 'design_center')).toBe(false);
    expect(canRequestRescan('shipping', 'design_center')).toBe(false);
  });

  it('되돌리기 전이가 통과한다', () => {
    expect(canTransition('design', 'rescan', 'design_center').allowed).toBe(true);
  });
});

describe('수정 가능 시점', () => {
  it('★ 접수와 재스캔에서만 수정된다', () => {
    expect(canEditOrder('received')).toBe(true);
    expect(canEditOrder('rescan')).toBe(true);
  });

  it('★ 디자인이 시작되면 잠긴다', () => {
    expect(canEditOrder('design')).toBe(false);
    expect(canEditOrder('pending')).toBe(false);
    expect(canEditOrder('production')).toBe(false);
    expect(canEditOrder('shipping')).toBe(false);
    expect(canEditOrder('completed')).toBe(false);
  });

  it('삭제도 같은 규칙', () => {
    expect(canDeleteOrder('received')).toBe(true);
    expect(canDeleteOrder('design')).toBe(false);
  });
});

describe('리메이크와 리페어', () => {
  it('★ 배송·완료에서만 신청된다', () => {
    expect(canRequestRemake('shipping', 'clinic')).toBe(true);
    expect(canRequestRemake('completed', 'clinic')).toBe(true);
    expect(canRequestRemake('design', 'clinic')).toBe(false);
    expect(canRequestRemake('received', 'clinic')).toBe(false);
  });

  it('★ 치과만 신청한다', () => {
    expect(canRequestRemake('completed', 'design_center')).toBe(false);
    expect(canRequestRepair('completed', 'lab')).toBe(false);
  });

  it('★ 리메이크는 접수부터, 리페어는 제작대기부터', () => {
    expect(getNewOrderStatus('remake')).toBe('received');
    expect(getNewOrderStatus('repair')).toBe('pending');
  });
});

describe('할 일 표시', () => {
  it('공을 쥔 섹터에만 표시된다', () => {
    expect(isActionRequired('received', 'design_center')).toBe(true);
    expect(isActionRequired('received', 'clinic')).toBe(false);
    expect(isActionRequired('shipping', 'clinic')).toBe(true);
  });

  it('완료는 아무에게도 표시되지 않는다', () => {
    expect(isActionRequired('completed', 'clinic')).toBe(false);
    expect(isActionRequired('completed', 'lab')).toBe(false);
  });
});
