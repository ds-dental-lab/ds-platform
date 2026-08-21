import { describe, it, expect } from 'vitest';
import {
  statusChangeMessage,
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
  isFinished,
  canReturnToDesign,
  canRequestRemake,
  canRequestRepair,
  getNewOrderStatus,
  isActionRequired,
  getAvailableActions,
  canEditDueDate,
  canDeleteFile,
  canRequestRemakeAsAny,
  REPAIR_REASONS,
  buildRepairNote,
  checkRepairReasons,
  repairReasonLabel,
  canEditFiles,
  deleteWarnings,
  canPrintWorkOrder,
} from '@/server/domain/order-status';

describe('상태 목록', () => {
  it('아홉 가지', () => {
    // 업로드중이 맨 앞에 늘었습니다 (작업지시서 §3-3, 2026-08-21)
    expect(STATUS_ORDER).toHaveLength(9);
    expect(STATUS_ORDER[0]).toBe('uploading');
    expect(STATUS_ORDER[3]).toBe('designing');
    expect(STATUS_ORDER[4]).toBe('production_wait');
    expect(STATUS_ORDER[8]).toBe('cancelled');
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

  it('★ 삭제는 접수와 재스캔까지 — 작업 시작 전이면 지웁니다', () => {
    expect(canDeleteOrder('received')).toBe(true);
    expect(canDeleteOrder('rescan')).toBe(true);
  });

  it('★ 디자인부터는 못 지웁니다 — 사람이 붙어 있습니다', () => {
    for (const status of ['designing', 'production_wait', 'production', 'shipping'] as const) {
      expect(canDeleteOrder(status)).toBe(false);
    }
  });

  it('★ 취소 버튼이 없으므로 이 길이 유일한 출구입니다', () => {
    // 접수·재스캔에서 막으면 그만둘 방법이 사라집니다
    for (const status of ['received', 'rescan'] as const) {
      const hasCancelButton = getAvailableActions(status, 'clinic').some(
        (a) => a.to === 'cancelled',
      );
      expect(hasCancelButton).toBe(false);
      expect(canDeleteOrder(status)).toBe(true);
    }
  });

  it('디자인에서 제작대기로 갈 때만 파일이 필요하다', () => {
    expect(requiresDesignFile('designing', 'production_wait')).toBe(true);
    expect(requiresDesignFile('received', 'designing')).toBe(false);
  });

  it('배송과 완료에서만 리메이크를 신청한다', () => {
    expect(canRequestRemake('shipping', 'clinic')).toBe(true);
    expect(canRequestRemake('completed', 'clinic')).toBe(true);
    expect(canRequestRemake('designing', 'clinic')).toBe(false);
  });

  // ★ 2026-08-12 에 열었습니다 — "치과가 할 줄 모른다며 전화가 오면
  //   우리가 대신 넣어야 한다"
  it('★ 디자인센터도 대신 신청한다', () => {
    expect(canRequestRemake('completed', 'design_center')).toBe(true);
    expect(canRequestRepair('shipping', 'design_center')).toBe(true);
    expect(canRequestRemake('designing', 'design_center')).toBe(false);
  });

  // ★ 만드는 쪽이 스스로 걸면 아무도 검수하지 않습니다
  it('★ 기공소는 못 신청한다', () => {
    expect(canRequestRepair('completed', 'lab')).toBe(false);
    expect(canRequestRemake('shipping', 'lab')).toBe(false);
  });

  it('자사 제작이면 디자인센터 자리로 신청된다', () => {
    expect(canRequestRemakeAsAny('completed', ['design_center', 'lab'])).toBe(true);
    expect(canRequestRemakeAsAny('completed', ['lab'])).toBe(false);
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

  it('★ 사양을 바꾸려면 지우고 새로 넣습니다 — 재스캔에서 바로 됩니다', () => {
    expect(canDeleteOrder('rescan')).toBe(true);
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

  it('★ 주문 취소 버튼은 어디에도 없다 — 삭제 하나로 모았습니다', () => {
    for (const status of ['received', 'rescan'] as const) {
      const actions = getAvailableActions(status, 'clinic');
      expect(actions.some((a) => a.to === 'cancelled')).toBe(false);
    }
  });

  it('규칙 자체는 남겨 둡니다 — 화면에서 내린 것뿐입니다', () => {
    expect(canCancel('received', 'clinic')).toBe(true);
    expect(canTransition('received', 'cancelled', 'clinic').allowed).toBe(true);
  });

  it('전이 규칙 자체는 열려 있다 — 막는 게 아니라 어느 화면이 맡는가의 문제', () => {
    expect(canTransition('rescan', 'received', 'clinic').allowed).toBe(true);
  });

  it('다른 상태의 전진 버튼은 그대로다', () => {
    const forward = getAvailableActions('received', 'design_center').filter((a) => !a.danger);
    expect(forward.map((a) => a.to)).toEqual(['designing']);
  });
});

// =========================================================
// 요청시한 변경 권한 (사용자 결정 2026-08-11)
//
// ★ 치과는 접수에서만. 디자인이 시작된 뒤에 시한을 당기면 상대는 이미
//   그 일정으로 기공소를 잡아 둔 뒤입니다.
// ★ 디자인센터는 끝나기 전까지 언제든. 일정을 실제로 쥔 쪽입니다.
// =========================================================

describe('요청시한 변경 권한', () => {
  it('★ 치과는 접수에서만 고친다', () => {
    expect(canEditDueDate('received', 'clinic')).toBe(true);

    for (const status of ['rescan', 'designing', 'production_wait', 'production', 'shipping'] as const) {
      expect(canEditDueDate(status, 'clinic')).toBe(false);
    }
  });

  it('★ 디자인센터는 진행 중이면 언제든 고친다', () => {
    for (const status of ['received', 'rescan', 'designing', 'production_wait', 'production', 'shipping'] as const) {
      expect(canEditDueDate(status, 'design_center')).toBe(true);
    }
  });

  it('기공소는 시한을 못 건드린다', () => {
    for (const status of ['production_wait', 'production', 'shipping'] as const) {
      expect(canEditDueDate(status, 'lab')).toBe(false);
    }
  });

  it('끝난 주문은 아무도 못 고친다', () => {
    for (const sector of ['clinic', 'design_center', 'lab'] as const) {
      expect(canEditDueDate('completed', sector)).toBe(false);
      expect(canEditDueDate('cancelled', sector)).toBe(false);
    }
  });
});

// =========================================================
// 파일 지우기 — 올린 쪽이 지웁니다 (2026-08-12)
// =========================================================

describe('파일 지우기', () => {
  it('스캔은 치과가 지운다', () => {
    expect(canDeleteFile('scan', 'received', ['clinic'])).toBe(true);
  });

  // 재스캔을 걸고 나면 못 쓰는 옛 파일이 남습니다
  it('스캔은 디자인센터도 지운다', () => {
    expect(canDeleteFile('scan', 'designing', ['design_center'])).toBe(true);
  });

  it('★ 치과는 디자인 파일을 못 지운다', () => {
    expect(canDeleteFile('design', 'designing', ['clinic'])).toBe(false);
    expect(canDeleteFile('design', 'designing', ['design_center'])).toBe(true);
  });

  it('★ 기공소는 아무것도 못 지운다', () => {
    expect(canDeleteFile('scan', 'designing', ['lab'])).toBe(false);
    expect(canDeleteFile('design', 'designing', ['lab'])).toBe(false);
  });

  it('★ 제작으로 넘어가면 아무도 못 지운다', () => {
    expect(canDeleteFile('scan', 'production_wait', ['clinic'])).toBe(false);
    expect(canDeleteFile('design', 'production', ['design_center'])).toBe(false);
    expect(canDeleteFile('scan', 'completed', ['design_center'])).toBe(false);
  });

  it('자사 제작이면 두 자리를 겸해도 규칙은 같다', () => {
    expect(canDeleteFile('design', 'designing', ['design_center', 'lab'])).toBe(true);
  });

  it('파일을 손댈 수 있는 상태', () => {
    expect(canEditFiles('received')).toBe(true);
    expect(canEditFiles('rescan')).toBe(true);
    expect(canEditFiles('designing')).toBe(true);
    expect(canEditFiles('production_wait')).toBe(false);
  });
});

// =========================================================
// 리페어 사유 — 다섯 가지가 거의 전부입니다 (사용자 경험 2026-08-12)
// =========================================================

describe('리페어 사유', () => {
  it('다섯 가지가 있고 기타만 손으로 적는다', () => {
    expect(REPAIR_REASONS).toHaveLength(5);
    expect(REPAIR_REASONS.filter((r) => r.freeText)).toHaveLength(1);
    expect(REPAIR_REASONS[0].label).toBe('근심(Mesial) 컨텍 에딩');
  });

  // ★ 코드가 아니라 사람 말로 저장합니다 — 기공작업지시서에 그대로 실립니다
  it('★ 고른 것을 기공소가 읽을 한 줄로 만든다', () => {
    expect(buildRepairNote(['contact_mesial', 'occlusion_high'], '')).toBe(
      '근심(Mesial) 컨텍 에딩 · 교합 높음',
    );
  });

  it('기타를 고르면 적은 내용이 뒤에 붙는다', () => {
    expect(buildRepairNote(['occlusion_low', 'etc'], '변연부 들뜸')).toBe(
      '교합 낮음 · 변연부 들뜸',
    );
  });

  it('기타만 골랐으면 적은 내용만 남는다', () => {
    expect(buildRepairNote(['etc'], '색이 다릅니다')).toBe('색이 다릅니다');
  });

  it('아무것도 안 고르면 막는다', () => {
    expect(checkRepairReasons([], '').ok).toBe(false);
  });

  // ★ 기공소가 물어보러 전화하게 두면 안 됩니다
  it('★ 기타를 골랐는데 안 적으면 막는다', () => {
    expect(checkRepairReasons(['etc'], '   ').ok).toBe(false);
    expect(checkRepairReasons(['etc'], '변연부 들뜸').ok).toBe(true);
  });

  it('버튼만 골랐으면 적지 않아도 된다', () => {
    expect(checkRepairReasons(['contact_distal'], '').ok).toBe(true);
  });

  it('이름을 코드로 되찾는다', () => {
    expect(repairReasonLabel('occlusion_high')).toBe('교합 높음');
    expect(repairReasonLabel('없는코드')).toBe('없는코드');
  });
});

// =========================================================
// 지우기 전 경고 — 사용자 결정 2026-08-12
//   "완료된것도 삭제할수 있게 해줘 / 문제가 될부분있을까?"
//   → 막지 않고 **알려 주기로** 했습니다.
// =========================================================

describe('지우기 전에 알려야 할 것', () => {
  // ★ 원래 지울 수 있던 자리입니다. 새삼 겁줄 이유가 없습니다
  it('★ 접수·재스캔은 경고가 없습니다', () => {
    expect(deleteWarnings('received')).toEqual([]);
    expect(deleteWarnings('rescan')).toEqual([]);
  });

  // ★ 접수 건을 지우는 것과 완료 건을 지우는 것은 결과가 전혀 다릅니다
  it('★ 완료 건은 통계와 청구를 짚어 줍니다', () => {
    const w = deleteWarnings('completed').join(' ');

    expect(w).toContain('완료');
    expect(w).toContain('통계');
    expect(w).toContain('청구');
  });

  it('취소된 건도 같습니다', () => {
    expect(deleteWarnings('cancelled').join(' ')).toContain('통계');
  });

  it('작업 중인 건은 어느 단계인지 말해 줍니다', () => {
    expect(deleteWarnings('designing').join(' ')).toContain('디자인');
    expect(deleteWarnings('production').join(' ')).toContain('제작');
  });

  // ★ 지운 사람은 자기 화면만 보지만, 사라지는 것은 치과 화면에서도입니다
  it('★ 치과에서도 사라진다는 것을 늘 말합니다', () => {
    for (const s of ['designing', 'production', 'shipping', 'completed'] as const) {
      expect(deleteWarnings(s).join(' ')).toContain('치과');
    }
  });
});

describe('기공의뢰서를 뽑을 수 있는 자리', () => {
  it('★ 만드는 쪽 둘 — 기공소와 디자인센터', () => {
    expect(canPrintWorkOrder(['lab'])).toBe(true);
    expect(canPrintWorkOrder(['design_center'])).toBe(true);
  });

  it('★ 치과는 못 뽑습니다 — 작업대에 붙는 지시서입니다', () => {
    expect(canPrintWorkOrder(['clinic'])).toBe(false);
  });

  it('자사 제작이면 한 조직이 둘을 겸합니다', () => {
    expect(canPrintWorkOrder(['design_center', 'lab'])).toBe(true);
    // 치과가 섞여 있어도 만드는 자리가 있으면 됩니다
    expect(canPrintWorkOrder(['clinic', 'lab'])).toBe(true);
  });

  it('자리가 없으면 못 뽑습니다', () => {
    expect(canPrintWorkOrder([])).toBe(false);
  });
});


/*
  ★ 상태가 바뀌었다는 말. (사용자 요청 2026-08-21)
    배지 글자만 바뀌면 누른 사람이 못 알아채고 한 번 더 누릅니다.
*/
describe('상태 변경 알림 문구', () => {
  it('접수 → 디자인 이면 "디자인 상태로 변경되었습니다"', () => {
    expect(statusChangeMessage('designing')).toBe('디자인 상태로 변경되었습니다');
  });

  it('제작대기·배송도 같은 모양입니다', () => {
    expect(statusChangeMessage('production_wait')).toBe('제작대기 상태로 변경되었습니다');
    expect(statusChangeMessage('shipping')).toBe('배송 상태로 변경되었습니다');
  });

  // ★ 이 둘은 '상태로 변경' 이 기계 말투로 들립니다
  it('취소·완료는 따로 적습니다', () => {
    expect(statusChangeMessage('cancelled')).toBe('주문이 취소되었습니다');
    expect(statusChangeMessage('completed')).toBe('주문이 완료되었습니다');
  });

  it('모든 상태가 빈 말 없이 한 줄을 냅니다', () => {
    for (const status of STATUS_ORDER) {
      expect(statusChangeMessage(status).trim().length).toBeGreaterThan(0);
      expect(statusChangeMessage(status)).not.toContain('undefined');
    }
  });
});


/*
  ★★ 업로드중 (작업지시서 §3-3, 2026-08-21).
    파일 개수가 주문마다 다릅니다. 10개 중 8개만 올라간 주문이
    '접수' 로 서면 디자인센터는 정상으로 보고 작업을 시작합니다 —
    빠진 둘이 무엇이었는지는 아무도 모릅니다.
*/
describe('업로드중', () => {
  it('제일 앞 단계입니다', () => {
    expect(STATUS_LABEL.uploading).toBe('업로드중');
    expect(getNextStatus('uploading')).toBe('received');
  });

  // ★★ 이것이 이 상태의 전부입니다
  it('사람이 앞으로 못 밉니다 — 세 섹터 모두', () => {
    for (const sector of ['clinic', 'design_center', 'lab'] as const) {
      const verdict = canTransition('uploading', 'received', sector);
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toContain('저절로');
    }
  });

  it('버튼이 하나도 없습니다', () => {
    for (const sector of ['clinic', 'design_center', 'lab'] as const) {
      expect(getAvailableActions('uploading', sector)).toEqual([]);
    }
  });

  it('어디로도 손으로 못 옮깁니다', () => {
    for (const to of STATUS_ORDER) {
      if (to === 'uploading') continue;
      for (const sector of ['clinic', 'design_center', 'lab'] as const) {
        expect(canTransition('uploading', to, sector).allowed).toBe(false);
      }
    }
  });

  // ★ 공은 치과에 있습니다 — 파일을 마저 올려야 넘어갑니다
  it('디자인센터의 할 일로 뜨지 않습니다', () => {
    expect(isActionRequired('uploading', 'clinic')).toBe(true);
    expect(isActionRequired('uploading', 'design_center')).toBe(false);
    expect(isActionRequired('uploading', 'lab')).toBe(false);
  });

  /*
    ★★ 여기가 막히면 **영영 못 빠져나옵니다.**
      파일이 덜 올라가서 만든 상태인데 파일을 못 만지면,
      다시 시도할 길도 그만둘 길도 없습니다.
  */
  it('파일을 다시 올리고 지울 수 있습니다', () => {
    expect(canEditFiles('uploading')).toBe(true);
    expect(canDeleteFile('scan', 'uploading', ['clinic'])).toBe(true);
    expect(canDeleteFile('scan', 'uploading', ['design_center'])).toBe(true);
  });

  it('주문 자체를 지울 수 있습니다 — 그만둘 길', () => {
    expect(canDeleteOrder('uploading', 'clinic')).toBe(true);
  });

  it('사양도 고칠 수 있습니다 — 아직 아무도 시작 안 했습니다', () => {
    expect(editScopeOf('uploading', 'clinic')).toBe('full');
    expect(canEditSpec('uploading', 'clinic')).toBe(true);
  });

  it('끝난 상태가 아닙니다', () => {
    expect(isFinal('uploading')).toBe(false);
    expect(isFinished('uploading')).toBe(false);
  });

  // ★ 아직 자료도 안 온 주문으로 되돌릴 것이 없습니다
  it('재스캔·디자인수정 대상이 아닙니다', () => {
    expect(canRequestRescan('uploading', 'design_center')).toBe(false);
    expect(canReturnToDesign('uploading', 'design_center')).toBe(false);
  });
});
