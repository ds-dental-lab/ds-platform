export type OrderStatus =
  | 'received'
  | 'rescan'
  | 'designing'
  | 'production_wait'
  | 'production'
  | 'shipping'
  | 'completed'
  | 'cancelled';

export type Sector = 'clinic' | 'design_center' | 'lab';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  received: '접수',
  rescan: '재스캔',
  designing: '디자인',
  production_wait: '제작대기',
  production: '제작',
  shipping: '배송',
  completed: '완료',
  cancelled: '취소',
};

export const OWNER_SECTOR: Record<OrderStatus, Sector | null> = {
  received: 'design_center',
  rescan: 'clinic',
  designing: 'design_center',
  production_wait: 'lab',
  production: 'lab',
  shipping: 'clinic',
  completed: null,
  cancelled: null,
};

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  received: 'designing',
  rescan: 'received',
  designing: 'production_wait',
  production_wait: 'production',
  production: 'shipping',
  shipping: 'completed',
  completed: null,
  cancelled: null,
};

export function getNextStatus(status: OrderStatus): OrderStatus | null {
  return NEXT_STATUS[status];
}

export function isFinal(status: OrderStatus): boolean {
  return status === 'completed' || status === 'cancelled';
}

export function isFinished(status: OrderStatus): boolean {
  return status === 'completed';
}

const REVERSIBLE_FROM: OrderStatus[] = ['received', 'designing'];

export function canRequestRescan(status: OrderStatus, sector: Sector): boolean {
  return sector === 'design_center' && REVERSIBLE_FROM.includes(status);
}

const CANCELLABLE_FROM: OrderStatus[] = ['received', 'rescan'];

export function canCancel(status: OrderStatus, sector: Sector): boolean {
  return sector === 'clinic' && CANCELLABLE_FROM.includes(status);
}

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
}

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  sector: Sector,
): TransitionResult {
  if (from === to) {
    return { allowed: false, reason: '같은 상태입니다' };
  }

  if (isFinal(from)) {
    return { allowed: false, reason: STATUS_LABEL[from] + ' 된 주문은 변경할 수 없습니다' };
  }

  if (to === 'cancelled') {
    if (!canCancel(from, sector)) {
      return { allowed: false, reason: '취소는 치과가 접수·재스캔 상태에서만 할 수 있습니다' };
    }
    return { allowed: true };
  }

  if (to === 'rescan') {
    if (!canRequestRescan(from, sector)) {
      return { allowed: false, reason: '재스캔 요청은 디자인센터가 접수·디자인 상태에서만 할 수 있습니다' };
    }
    return { allowed: true };
  }

  const next = getNextStatus(from);
  if (next !== to) {
    return { allowed: false, reason: STATUS_LABEL[from] + ' 다음은 ' + (next ? STATUS_LABEL[next] : '없음') + ' 입니다' };
  }

  if (OWNER_SECTOR[from] !== sector) {
    return { allowed: false, reason: STATUS_LABEL[from] + ' 상태는 담당 섹터만 진행할 수 있습니다' };
  }

  return { allowed: true };
}

export function requiresDesignFile(from: OrderStatus, to: OrderStatus): boolean {
  return from === 'designing' && to === 'production_wait';
}

const EDITABLE_STATUSES: OrderStatus[] = ['received', 'rescan'];

export function canEditOrder(status: OrderStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

export function canDeleteOrder(status: OrderStatus): boolean {
  return canEditOrder(status);
}

const REMAKE_ALLOWED_FROM: OrderStatus[] = ['shipping', 'completed'];

export function canRequestRemake(status: OrderStatus, sector: Sector): boolean {
  return sector === 'clinic' && REMAKE_ALLOWED_FROM.includes(status);
}

export function canRequestRepair(status: OrderStatus, sector: Sector): boolean {
  return canRequestRemake(status, sector);
}

export function getNewOrderStatus(kind: 'remake' | 'repair'): OrderStatus {
  return kind === 'remake' ? 'received' : 'production_wait';
}

export function isActionRequired(status: OrderStatus, sector: Sector): boolean {
  return OWNER_SECTOR[status] === sector;
}

export const STATUS_ORDER: OrderStatus[] = [
  'received',
  'rescan',
  'designing',
  'production_wait',
  'production',
  'shipping',
  'completed',
  'cancelled',
];
