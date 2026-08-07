// =========================================================
// 놓을 위치: src/server/domain/order-status/index.ts
//
// 주문 상태 전이. (기능명세서 §7)
// 모든 상태 변경은 이 규칙을 통과합니다. (설계서 §5.3 결정 5)
// =========================================================

export type OrderStatus =
  | 'received'      // 접수
  | 'rescan'        // 재스캔
  | 'design'        // 디자인
  | 'pending'       // 제작대기
  | 'production'    // 제작
  | 'shipping'      // 배송
  | 'completed';    // 완료

export type Sector = 'clinic' | 'design_center' | 'lab';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  received: '접수',
  rescan: '재스캔',
  design: '디자인',
  pending: '제작대기',
  production: '제작',
  shipping: '배송',
  completed: '완료',
};

/** 각 상태에서 지금 공을 쥐고 있는 섹터 */
export const OWNER_SECTOR: Record<OrderStatus, Sector | null> = {
  received: 'design_center',
  rescan: 'clinic',
  design: 'design_center',
  pending: 'lab',
  production: 'lab',
  shipping: 'clinic',
  completed: null,
};

// ---------- 앞으로 진행 ----------

/** 정상 흐름에서 다음 상태. 완료는 끝입니다 */
const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  received: 'design',
  rescan: 'received',
  design: 'pending',
  pending: 'production',
  production: 'shipping',
  shipping: 'completed',
  completed: null,
};

export function getNextStatus(status: OrderStatus): OrderStatus | null {
  return NEXT_STATUS[status];
}

// ---------- 되돌리기 ----------

/**
 * 되돌리기는 디자인센터 → 치과 경로 하나뿐입니다. (명세서 §7.2)
 * 재스캔 요청과 수정 요청 둘 다 상태를 `재스캔` 으로 보냅니다.
 * ★ 기공소는 되돌릴 수 없습니다.
 */
const REVERSIBLE_FROM: OrderStatus[] = ['received', 'design'];

export function canRequestRescan(status: OrderStatus, sector: Sector): boolean {
  return sector === 'design_center' && REVERSIBLE_FROM.includes(status);
}

// ---------- 전이 판정 ----------

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * 이 섹터가 이 상태를 저 상태로 바꿀 수 있는가.
 *
 * 규칙 셋
 *  1. 지금 공을 쥔 섹터만 움직일 수 있습니다
 *  2. 앞으로는 정해진 다음 단계로만
 *  3. 뒤로는 디자인센터가 재스캔으로 보내는 것만
 */
export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  sector: Sector,
): TransitionResult {
  if (from === to) {
    return { allowed: false, reason: '같은 상태입니다' };
  }

  if (from === 'completed') {
    return { allowed: false, reason: '완료된 주문은 변경할 수 없습니다' };
  }

  // 되돌리기 — 재스캔으로 보내기
  if (to === 'rescan') {
    if (!canRequestRescan(from, sector)) {
      return {
        allowed: false,
        reason: '재스캔 요청은 디자인센터가 접수·디자인 상태에서만 할 수 있습니다',
      };
    }
    return { allowed: true };
  }

  // 앞으로 진행
  if (getNextStatus(from) !== to) {
    return {
      allowed: false,
      reason: `${STATUS_LABEL[from]} 다음은 ${
        getNextStatus(from) ? STATUS_LABEL[getNextStatus(from)!] : '없음'
      } 입니다`,
    };
  }

  if (OWNER_SECTOR[from] !== sector) {
    return {
      allowed: false,
      reason: `${STATUS_LABEL[from]} 상태는 담당 섹터만 진행할 수 있습니다`,
    };
  }

  return { allowed: true };
}

// ---------- 수정 · 삭제 ----------

/**
 * 주문 수정·삭제는 접수와 재스캔에서만 가능합니다. (명세서 §7.3)
 * 디자인이 시작되면 잠깁니다.
 */
const EDITABLE_STATUSES: OrderStatus[] = ['received', 'rescan'];

export function canEditOrder(status: OrderStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

export function canDeleteOrder(status: OrderStatus): boolean {
  return canEditOrder(status);
}

// ---------- 리메이크 · 리페어 ----------

/** 배송·완료 상태에서만 신청할 수 있습니다. (명세서 §4.10, §4.11) */
const REMAKE_ALLOWED_FROM: OrderStatus[] = ['shipping', 'completed'];

export function canRequestRemake(status: OrderStatus, sector: Sector): boolean {
  return sector === 'clinic' && REMAKE_ALLOWED_FROM.includes(status);
}

export function canRequestRepair(status: OrderStatus, sector: Sector): boolean {
  return canRequestRemake(status, sector);
}

/**
 * 리메이크·리페어로 새로 만들어지는 주문이 어느 상태로 진입하는가.
 * ★ 리메이크는 접수부터, 리페어는 제작대기부터 시작합니다.
 */
export function getNewOrderStatus(kind: 'remake' | 'repair'): OrderStatus {
  return kind === 'remake' ? 'received' : 'pending';
}

// ---------- 표시 ----------

/** 이 섹터가 지금 무언가 해야 하는 상태인가 */
export function isActionRequired(status: OrderStatus, sector: Sector): boolean {
  return OWNER_SECTOR[status] === sector;
}

export function isFinished(status: OrderStatus): boolean {
  return status === 'completed';
}
