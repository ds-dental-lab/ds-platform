import { describe, it, expect } from 'vitest';
import {
  STATUS_LABEL,
  STATUS_ORDER,
  OWNER_SECTOR,
  getNextStatus,
  isFinal,
  canRequestRescan,
  canCancel,
  canTransition,
  requiresDesignFile,
  canEditOrder,
  canEditSpec,
  editScopeOf,
  canDeleteOrder,
  canRequestRemake,
  canRequestRepair,
  getNewOrderStatus,
  isActionRequired,
  getAvailableActions,
} from '@/server/domain/order-status';

describe('상태 목록', () => {
  it('여덟 가지', () => {
    expect(STATUS_ORDER).toHaveLength(8);
    expect(STATUS_ORDER[2]).toBe('designing');
    expect(STATUS_ORDER[3]).toBe('production_wait');
    expect(STATUS_ORDER[7]).toBe('cancelled');
  });

  it('DB enum 이름과 같다', () => {
    expect(STATUS_LABEL).toHaveProperty('designing');
    expect(STATUS_LABEL).not.toHaveProperty('design');
    expect(STATUS_LABEL).not.toHaveProperty('pending');
  });

  it('담당 섹터가 맞다', () => {
    expect(OWNER_SECTOR.received).toBe('design_center');
    expect(OWNER_SECTOR.production_wait).toBe('lab');
    expect(OWNER_SECTOR.cancelled).toBeNull();
  });
});

describe('정상 흐름', () => {
  it('접수에서 완료까지', () => {
    expect(getNextStatus('received')).toBe('designing');
    expect(getNextStatus('designing')).toBe('production_wait');
    expect(getNextStatus('production_wait')).toBe('production');
    expect(getNextStatus('production')).toBe('shipping');
    expect(getNextStatus('shipping')).toBe('completed');
    expect(getNextStatus('rescan')).toBe('received');
  });

  it('완료와 취소가 끝이다', () => {
    expect(getNextStatus('completed')).toBeNull();
    expect(getNextStatus('cancelled')).toBeNull();
    expect(isFinal('completed')).toBe(true);
    expect(isFinal('cancelled')).toBe(true);
    expect(isFinal('shipping')).toBe(false);
  });
});

describe('전이 권한', () => {
  it('담당 섹터는 진행시킬 수 있다', () => {
    expect(canTransition('received', 'designing', 'design_center').allowed).toBe(true);
    expect(canTransition('production_wait', 'production', 'lab').allowed).toBe(true);
    expect(canTransition('shipping', 'completed', 'clinic').allowed).toBe(true);
  });

  it('담당이 아니면 못 한다', () => {
    expect(canTransition('received', 'designing', 'clinic').allowed).toBe(false);
    expect(canTransition('production_wait', 'production', 'clinic').allowed).toBe(false);
  });

  it('단계를 건너뛸 수 없다', () => {
    expect(canTransition('received', 'production', 'design_center').allowed).toBe(false);
    expect(canTransition('designing', 'shipping', 'design_center').allowed).toBe(false);
  });

  it('끝난 주문은 못 바꾼다', () => {
    expect(canTransition('completed', 'shipping', 'clinic').allowed).toBe(false);
    expect(canTransition('cancelled', 'received', 'clinic').allowed).toBe(false);
  });

  it('막힐 때는 이유를 알려준다', () => {
    expect(canTransition('received', 'designing', 'clinic').reason).toBeTruthy();
  });
});

describe('되돌리기와 취소', () => {
  it('디자인센터만 재스캔을 요청한다', () => {
    expect(canRequestRescan('received', 'design_center')).toBe(true);
    expect(canRequestRescan('designing', 'design_center')).toBe(true);
    expect(canRequestRescan('designing', 'clinic')).toBe(false);
  });

  it('기공소는 되돌릴 수 없다', () => {
    expect(canRequestRescan('production', 'lab')).toBe(false);
    expect(canTransition('production', 'rescan', 'lab').allowed).toBe(false);
  });

  it('제작 이후에는 되돌릴 수 없다', () => {
    expect(canRequestRescan('production_wait', 'design_center')).toBe(false);
    expect(canRequestRescan('shipping', 'design_center')).toBe(false);
  });

  it('치과가 접수와 재스캔에서만 취소한다', () => {
    expect(canCancel('received', 'clinic')).toBe(true);
    expect(canCancel('rescan', 'clinic')).toBe(true);
    expect(canCancel('designing', 'clinic')).toBe(false);
    expect(canCancel('received', 'design_center')).toBe(false);
  });

  it('취소 전이가 통과한다', () => {
    expect(canTransition('received', 'cancelled', 'clinic').allowed).toBe(true);
    expect(canTransition('designing', 'cancelled', 'clinic').allowed).toBe(false);
  });
});

describe('수정과 리메이크', () => {
  it('접수와 재스캔에서만 수정된다', () => {
    expect(canEditOrder('received')).toBe(true);
    expect(canEditOrder('rescan')).toBe(true);
    expect(canEditOrder('designing')).toBe(false);
    expect(canEditOrder('completed')).toBe(false);
    expect(canEditOrder('cancelled')).toBe(false);
  });

  it('★ 삭제는 접수에서만 — 수정보다 좁습니다', () => {
    expect(canDeleteOrder('received')).toBe(true);

    // 재스캔은 디자인센터가 기다리는 상태라 소리 없이 없애면 안 됩니다
    expect(canDeleteOrder('rescan')).toBe(false);
    expect(canEditOrder('rescan')).toBe(true);   // 파일 수정은 됩니다

    // 작업이 돌아가는 중에는 말할 것도 없습니다
    expect(canDeleteOrder('designing')).toBe(false);
    expect(canDeleteOrder('production')).toBe(false);
  });

  it('재스캔에서 그만두려면 취소를 씁니다 — 사유가 남습니다', () => {
    expect(canCancel('rescan', 'clinic')).toBe(true);
  });

  it('디자인에서 제작대기로 갈 때만 파일이 필요하다', () => {
    expect(requiresDesignFile('designing', 'production_wait')).toBe(true);
    expect(requiresDesignFile('received', 'designing')).toBe(false);
  });

  it('배송과 완료에서만 리메이크를 신청한다', () => {
    expect(canRequestRemake('shipping', 'clinic')).toBe(true);
    expect(canRequestRemake('completed', 'clinic')).toBe(true);
    expect(canRequestRemake('designing', 'clinic')).toBe(false);
    expect(canRequestRemake('completed', 'design_center')).toBe(false);
    expect(canRequestRepair('completed', 'lab')).toBe(false);
  });

  it('리메이크는 접수부터, 리페어는 제작대기부터', () => {
    expect(getNewOrderStatus('remake')).toBe('received');
    expect(getNewOrderStatus('repair')).toBe('production_wait');
  });

  it('공을 쥔 섹터에만 할 일이 표시된다', () => {
    expect(isActionRequired('received', 'design_center')).toBe(true);
    expect(isActionRequired('received', 'clinic')).toBe(false);
    expect(isActionRequired('completed', 'clinic')).toBe(false);
  });
});

// =========================================================
// 무엇을 고칠 수 있는가 (설계서 §2.1 C-4 — 2026-08-11 확정 A안)
//
// ★ 재스캔에서 사양까지 열어 두면, 디자인센터는 자기가 요청한 것(파일)만
//   바뀐 줄 알고 작업을 시작하는데 사양이 달라져 있어 잘못 만듭니다.
//   그래서 재스캔은 파일만 바꿉니다.
// =========================================================

describe('수정 범위', () => {
  it('★ 접수는 전부 고칠 수 있다', () => {
    expect(editScopeOf('received')).toBe('full');
    expect(canEditSpec('received')).toBe(true);
  });

  it('★ 재스캔은 파일만 — 보철 사양은 못 바꾼다', () => {
    expect(editScopeOf('rescan')).toBe('files');
    expect(canEditOrder('rescan')).toBe(true);
    expect(canEditSpec('rescan')).toBe(false);
  });

  it('작업이 시작된 뒤로는 아무것도 못 고친다', () => {
    for (const status of ['designing', 'production_wait', 'production', 'shipping'] as const) {
      expect(editScopeOf(status)).toBe('none');
      expect(canEditOrder(status)).toBe(false);
      expect(canEditSpec(status)).toBe(false);
    }
  });

  it('끝난 주문도 못 고친다', () => {
    expect(editScopeOf('completed')).toBe('none');
    expect(editScopeOf('cancelled')).toBe('none');
  });

  it('★ 사양을 바꾸려면 취소하고 새로 넣는 길이 열려 있다', () => {
    // 재스캔에서 사양을 막아도 막다른 길이 아니어야 합니다
    expect(canCancel('rescan', 'clinic')).toBe(true);
    expect(canCancel('received', 'clinic')).toBe(true);
  });
});

// =========================================================
// 재스캔의 전진은 버튼이 아니라 스캔 재등록 화면이 맡습니다
//
// ★ 버튼을 두면 파일 없이 '재업로드 완료' 만 눌러 넘길 수 있습니다.
//   디자인센터는 다시 열어 보고 또 재스캔을 겁니다.
// =========================================================

describe('재스캔 전진', () => {
  it('★ 재스캔에는 앞으로 가는 버튼이 없다', () => {
    const forward = getAvailableActions('rescan', 'clinic').filter((a) => !a.danger);
    expect(forward).toHaveLength(0);
  });

  it('취소는 그대로 남는다 — 막다른 길이 아니어야 합니다', () => {
    const actions = getAvailableActions('rescan', 'clinic');
    expect(actions.some((a) => a.to === 'cancelled')).toBe(true);
  });

  it('전이 규칙 자체는 열려 있다 — 막는 게 아니라 어느 화면이 맡는가의 문제', () => {
    expect(canTransition('rescan', 'received', 'clinic').allowed).toBe(true);
  });

  it('다른 상태의 전진 버튼은 그대로다', () => {
    const forward = getAvailableActions('received', 'design_center').filter((a) => !a.danger);
    expect(forward.map((a) => a.to)).toEqual(['designing']);
  });
});
