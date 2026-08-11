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

/**
 * 기공소를 지정해야 넘어갈 수 있는가. (설계서 Q-2 확정)
 * 배정 시점은 제작대기 진입입니다. 자동 배정 규칙은 두지 않습니다.
 */
export function requiresLabAssignment(from: OrderStatus, to: OrderStatus): boolean {
  return to === 'production_wait' && from === 'designing';
}

const DESIGN_UPLOAD_FROM: OrderStatus[] = ['received', 'designing'];

/**
 * 디자인 파일을 올릴 수 있는가. (설계서 §8.3)
 * 디자인센터가 작업 중일 때만입니다. 넘긴 뒤에는 올릴 수 없습니다.
 */
export function canUploadDesignFile(status: OrderStatus, sector: Sector): boolean {
  return sector === 'design_center' && DESIGN_UPLOAD_FROM.includes(status);
}

/**
 * 이 상태에서 무엇을 고칠 수 있는가. (설계서 §2.1 C-4 — 2026-08-11 확정 A안)
 *
 *   full   보철 사양 · 요청시한 · 파일 전부
 *   files  파일만
 *   none   못 고칩니다
 *
 * ★ 재스캔에서는 파일만 바꿉니다.
 *   재스캔은 디자인센터가 "스캔이 이상하니 다시 찍어 달라" 고 부른 상태입니다.
 *   문제가 된 것은 파일이지 사양이 아닙니다.
 *
 *   여기서 사양까지 열어 두면 이런 일이 생깁니다 —
 *     치과: 16번 지르코니아 + 스캔 업로드
 *     디자인센터: 스캔이 흐리네요 → 재스캔 요청
 *     치과: 스캔 다시 올리면서 17번 추가, 재료도 PMMA 로 변경
 *     디자인센터: 자기가 요청한 것(파일)만 바뀐 줄 알고 그대로 제작
 *
 *   사양을 바꾸려면 스캔을 다시 올려 접수로 돌아간 뒤, 지우고 새로 넣습니다.
 */
export type EditScope = 'full' | 'files' | 'none';

export function editScopeOf(status: OrderStatus): EditScope {
  if (status === 'received') return 'full';
  if (status === 'rescan') return 'files';
  return 'none';
}

/** 무엇이든 고칠 수 있는가 */
export function canEditOrder(status: OrderStatus): boolean {
  return editScopeOf(status) !== 'none';
}

/** 보철 사양까지 고칠 수 있는가 — 접수 상태에서만 */
export function canEditSpec(status: OrderStatus): boolean {
  return editScopeOf(status) === 'full';
}

/**
 * 요청시한을 고칠 수 있는가. (사용자 결정 2026-08-11)
 *
 *   치과       접수에서만. 주문수정으로 함께 고칩니다
 *   디자인센터  끝나기 전까지 언제든
 *   기공소     없음
 *
 * ★ 디자인센터에 넓게 열어 두는 이유.
 *   일정을 실제로 쥐고 있는 쪽입니다. 기공소가 밀리거나 물량이 몰리면
 *   시한을 다시 잡아 치과에 알려야 하는데, 그때마다 주문을 취소하고
 *   새로 넣게 할 수는 없습니다.
 *
 * ★ 치과를 접수로 묶는 이유.
 *   디자인이 시작된 뒤에 치과가 시한을 당기면, 상대는 이미 그 일정으로
 *   기공소를 잡아 둔 뒤입니다. 당길 일이 있으면 말로 하고 디자인센터가
 *   고치는 것이 순서입니다.
 *
 * ★ 정산 기간은 이 값과 무관합니다.
 *   기간 귀속은 실제 배송일(shipped_at)로 가릅니다. 시한이 움직여도
 *   청구가 이 달 저 달로 옮겨 다니지 않습니다.
 */
export function canEditDueDate(status: OrderStatus, sector: Sector): boolean {
  if (isFinal(status)) return false;
  if (sector === 'design_center') return true;
  if (sector === 'clinic') return status === 'received';
  return false;
}

/**
 * 지울 수 있는가. (사용자 결정 2026-08-11, A 안)
 *
 * ★ 접수와 재스캔까지입니다.
 *   둘 다 아직 디자인센터가 '작업을 시작하지 않은' 자리입니다.
 *   재스캔은 열어 보고 "다시 올려 달라" 며 기다리는 상태이지,
 *   무언가를 만들고 있는 상태가 아닙니다.
 *
 * ★ 디자인부터는 안 됩니다.
 *   그때는 사람이 붙어 작업이 돌아갑니다. 소리 없이 사라지면
 *   그 시간이 통째로 날아갑니다.
 *
 * ★ 주문 취소 버튼을 없앴으므로 이 길이 유일한 출구입니다.
 *   접수·재스캔에서 막으면 그만둘 방법이 사라집니다.
 */
const DELETABLE_STATUSES: OrderStatus[] = ['received', 'rescan'];

export function canDeleteOrder(status: OrderStatus): boolean {
  return DELETABLE_STATUSES.includes(status);
}

/**
 * 주문 자체를 고치거나 지울 수 있는 자리인가.
 *
 * ★ 기공소는 못 합니다.
 *   기공소가 하는 일은 배정받은 파일을 실물로 만들어 치과로 보내는 것뿐입니다.
 *   내용이 틀렸으면 대화로 알리고, 고치는 것은 치과나 디자인센터가 합니다.
 *   남의 주문서를 만드는 쪽에서 지울 수 있으면 사고가 됩니다.
 *
 * ★ 상태 조건(canEditOrder)과 따로 봅니다.
 *   '누가' 와 '언제' 는 다른 질문이라 섞으면 나중에 못 풉니다.
 */
export function canManageOrder(roles: Sector[]): boolean {
  return roles.some((role) => role === 'clinic' || role === 'design_center');
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

// ---------- 화면에 보여줄 버튼 ----------

/**
 * 앞으로 넘기는 버튼의 이름. 어느 상태에서 누르는지로 정합니다.
 * "다음 상태 이름"을 그대로 쓰면 어색해집니다 — 재스캔 상태에서
 * 누르는 버튼은 '접수'가 아니라 '재업로드 완료'입니다.
 */
// ★ 버튼 이름은 '지금 무엇을 하는가' 로 씁니다.
//   디자인 단계의 버튼은 '디자인 완료' 가 아니라 **제작주문** 입니다 —
//   누르는 순간 기공소에 일이 넘어가기 때문입니다. 무엇이 끝났는지가
//   아니라 무엇이 시작되는지를 알아야 손이 멈춥니다.
const FORWARD_LABEL: Record<OrderStatus, string> = {
  received: '디자인 시작',
  rescan: '재업로드 완료',
  designing: '제작주문',
  production_wait: '제작 시작',
  production: '출고',
  shipping: '수령 완료',
  completed: '',
  cancelled: '',
};

export interface StatusAction {
  to: OrderStatus;
  label: string;
  /** 사유를 받아야 하는가 */
  requiresReason: boolean;
  /** 기공소를 골라야 하는가 */
  requiresLab: boolean;
  /** 되돌리거나 끝내는 동작인가. 화면에서 빨갛게 그립니다 */
  danger: boolean;
}

/**
 * 이 상태에서 이 섹터가 지금 누를 수 있는 것 전부.
 *
 * ★ 판정은 전부 canTransition 을 거칩니다.
 *   버튼 목록과 실제 허용 규칙이 따로 놀 수 없게 하려는 것입니다.
 */
export function getAvailableActions(status: OrderStatus, sector: Sector): StatusAction[] {
  const actions: StatusAction[] = [];

  // 앞으로 한 칸
  //
  // ★ 재스캔에서 앞으로 가는 길은 버튼으로 두지 않습니다.
  //   스캔 재등록 화면(RescanBar)이 파일과 상태를 함께 처리합니다.
  //   버튼을 따로 두면 파일 없이 '재업로드 완료' 만 눌러 넘길 수 있고,
  //   그러면 디자인센터가 다시 열어 보고 또 재스캔을 겁니다.
  //   전이 규칙(canTransition)은 그대로 열어 둡니다 — 막는 게 아니라
  //   '어느 화면이 맡는가' 의 문제입니다.
  const next = status === 'rescan' ? null : getNextStatus(status);
  if (next && canTransition(status, next, sector).allowed) {
    actions.push({
      to: next,
      label: FORWARD_LABEL[status],
      requiresReason: false,
      requiresLab: requiresLabAssignment(status, next),
      danger: false,
    });
  }

  // 되돌리기 — 디자인센터만 (C-7)
  if (canRequestRescan(status, sector)) {
    actions.push({
      to: 'rescan',
      label: '재스캔 요청',
      requiresReason: true,
      requiresLab: false,
      danger: true,
    });
  }

  // ★ 주문 취소 버튼은 두지 않습니다 (사용자 결정 2026-08-11).
  //   치과가 그만두는 길은 '주문 삭제' 하나로 모읍니다. 같은 자리에서
  //   같은 사람이 누르는 버튼이 둘이면 무엇이 다른지 알 수 없습니다.
  //
  //   canCancel 과 cancelled 상태는 그대로 둡니다 — 규칙을 지우는 게
  //   아니라 화면에서 내리는 것입니다. 지난 주문에도 남아 있습니다.

  return actions;
}

/**
 * 여러 자리를 맡았을 때 누를 수 있는 것 전부.
 *
 * ★ 자사 제작이면 디자인센터가 기공소 자리도 함께 맡습니다.
 *   그때는 '제작주문'과 '제작 시작'이 상태에 따라 번갈아 나옵니다.
 */
export function getActionsForRoles(status: OrderStatus, roles: Sector[]): StatusAction[] {
  const seen = new Set<OrderStatus>();
  const merged: StatusAction[] = [];

  for (const role of roles) {
    for (const action of getAvailableActions(status, role)) {
      if (seen.has(action.to)) continue;
      seen.add(action.to);
      merged.push(action);
    }
  }

  return merged;
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
