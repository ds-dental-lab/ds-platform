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

/**
 * 디자인으로 되돌릴 수 있는가. (사용자 결정 2026-08-12)
 *
 * ★ 기공소가 "이 디자인으로는 못 만든다" 고 할 때가 있습니다.
 *   마진이 안 맞거나 두께가 모자라면 고쳐서 다시 올려야 합니다.
 *   그때 주문을 새로 넣게 하면 치식·쉐이드·파일이 통째로 다시 갑니다.
 *
 * ★ 제작까지도 되돌립니다.
 *   기공소가 파일을 열어 본 뒤에야 아는 문제가 대부분입니다 —
 *   그때는 이미 '제작' 으로 넘어가 있습니다.
 *
 * ★ 되돌리는 것은 디자인센터입니다.
 *   기공소는 대화로 알리고, 실제로 손대는 쪽이 상태를 옮깁니다.
 *   양쪽이 다 옮길 수 있으면 지금 누구 손에 있는지 알 수 없어집니다.
 */
const RETURNABLE_FROM: OrderStatus[] = ['production_wait', 'production'];

export function canReturnToDesign(status: OrderStatus, sector: Sector): boolean {
  return sector === 'design_center' && RETURNABLE_FROM.includes(status);
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

  // 뒤로 한 칸 — 기공소가 디자인 수정을 요청한 경우
  if (to === 'designing' && RETURNABLE_FROM.includes(from)) {
    if (!canReturnToDesign(from, sector)) {
      return { allowed: false, reason: '디자인으로 되돌리는 것은 디자인센터만 할 수 있습니다' };
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

/**
 * ★ 디자인센터는 **단계를 안 가립니다** (사용자 결정 2026-08-12).
 *   치과에게 좁게 열어 둔 이유는 "이미 남이 그 사양으로 일을 시작했기
 *   때문" 이었습니다. 그런데 그 일을 하는 쪽이 바로 디자인센터입니다.
 *   자기가 만들고 있는 것을 자기가 고치는 것은 남을 놀라게 하지 않습니다.
 *   전화로 "이거 바꿔 주세요" 를 받아 처리하는 곳이기도 합니다.
 */
export function editScopeOf(status: OrderStatus, sector?: Sector): EditScope {
  if (sector === 'design_center') return 'full';
  if (status === 'received') return 'full';
  if (status === 'rescan') return 'files';
  return 'none';
}

/** 무엇이든 고칠 수 있는가 */
export function canEditOrder(status: OrderStatus, sector?: Sector): boolean {
  return editScopeOf(status, sector) !== 'none';
}

/** 보철 사양까지 고칠 수 있는가 — 접수 상태에서만 (디자인센터는 언제나) */
export function canEditSpec(status: OrderStatus, sector?: Sector): boolean {
  return editScopeOf(status, sector) === 'full';
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

/**
 * ★ 디자인센터는 **단계를 안 가립니다** (사용자 결정 2026-08-12).
 *   위 설명은 '남의 작업 시간이 날아간다' 는 걱정이었는데, 그 작업을
 *   하는 쪽이 디자인센터 자신입니다. 잘못 들어온 주문을 정리하는 것도
 *   그쪽 일입니다.
 *
 * ★ 지워도 기록은 남습니다 (deleted_at).
 *   이미 마감된 정산의 금액은 billing_lines 에 굳어 있어 흔들리지
 *   않습니다 — 지난 청구서의 숫자는 그대로입니다.
 */
export function canDeleteOrder(status: OrderStatus, sector?: Sector): boolean {
  if (sector === 'design_center') return true;
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

/**
 * 리메이크·리페어를 넣을 수 있는가.
 *
 * ★ 디자인센터도 넣습니다 (사용자 결정 2026-08-12).
 *   "치과에서 할 줄 모른다며 문의 전화가 오면 우리가 대신 넣어야 한다."
 *   주문은 그대로 그 치과의 것이고, 넣은 사람만 created_by 에 남습니다.
 *
 * ★ 기공소는 못 넣습니다.
 *   만드는 쪽이 "다시 만들겠다" 를 스스로 걸면 아무도 검수하지 않습니다.
 *   문제를 발견하면 대화로 알리고, 요청은 의뢰한 쪽이 넣습니다.
 */
export function canRequestRemake(status: OrderStatus, sector: Sector): boolean {
  return (
    (sector === 'clinic' || sector === 'design_center') &&
    REMAKE_ALLOWED_FROM.includes(status)
  );
}

export function canRequestRepair(status: OrderStatus, sector: Sector): boolean {
  return canRequestRemake(status, sector);
}

/** 여러 자리를 겸할 때 — 하나라도 되면 됩니다 (자사 제작) */
export function canRequestRemakeAsAny(status: OrderStatus, roles: Sector[]): boolean {
  return roles.some((role) => canRequestRemake(status, role));
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

  // 디자인으로 되돌리기 — 기공소가 수정을 요청했을 때
  if (canReturnToDesign(status, sector)) {
    /*
      ★ 사유를 묻지 않습니다 (사용자 결정 2026-08-12).
        기공소가 전화나 대화로 이미 말한 뒤에 누르는 버튼입니다.
        같은 말을 창에 또 적게 하면 손만 늘어납니다.

        누가 언제 되돌렸는지는 order_status_history 에 그대로 남습니다 —
        기록이 없어지는 것이 아니라 한 번 덜 묻는 것입니다.
    */
    actions.push({
      to: 'designing',
      label: '디자인 수정',
      requiresReason: false,
      requiresLab: false,
      danger: true,
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

// ---------- 파일 지우기 ----------

/**
 * 올린 파일을 지울 수 있는가.
 *
 * ★ 올린 쪽이 지웁니다 (설계서 §8.3).
 *   스캔은 치과가, 디자인은 디자인센터가 올립니다.
 *   디자인센터도 스캔을 지울 수 있게 열어 둡니다 — 재스캔을 걸고 나면
 *   못 쓰는 옛 파일이 목록에 남아 어느 것이 최신인지 헷갈립니다.
 *   반대로 치과가 디자인 파일을 지우는 길은 없습니다.
 *
 * ★ 기공소는 못 지웁니다.
 *   받은 파일로 만들기만 합니다. 남의 자료를 지울 자리가 아닙니다.
 *
 * ★ 넘어간 뒤에는 아무도 못 지웁니다.
 *   제작이 시작되면 그 파일이 무엇으로 만들었는지의 근거가 됩니다.
 */
export function canDeleteFile(
  kind: string,
  status: OrderStatus,
  roles: Sector[],
): boolean {
  if (!FILE_EDITABLE_STATUSES.includes(status)) return false;

  if (kind === 'design') return roles.includes('design_center');

  return roles.includes('clinic') || roles.includes('design_center');
}

/** 파일을 더 올리거나 지울 수 있는 상태 */
const FILE_EDITABLE_STATUSES: OrderStatus[] = ['received', 'rescan', 'designing'];

export function canEditFiles(status: OrderStatus): boolean {
  return FILE_EDITABLE_STATUSES.includes(status);
}

// ---------- 리페어 사유 ----------
//
// ★ 다섯 가지가 거의 전부입니다 (사용자 경험 2026-08-12).
//   자유 입력만 두면 같은 문제를 사람마다 다르게 적습니다 —
//   '컨택 타이트', '인접면 조정', '옆 이랑 껴요' 가 다 같은 말입니다.
//   버튼으로 두면 기공소가 바로 알아보고, 나중에 세어 볼 수도 있습니다.
//
// ★ '기타' 는 남깁니다. 다섯 가지로 다 담기지 않습니다.
//   그때는 손으로 적게 하되, 적어야 넘어가게 막습니다.

export interface RepairReason {
  code: string;
  label: string;
  /** 고르면 손으로 적어야 하는가 */
  freeText?: boolean;
}

export const REPAIR_REASONS: RepairReason[] = [
  { code: 'contact_mesial', label: '근심(Mesial) 컨텍 에딩' },
  { code: 'contact_distal', label: '원심(Distal) 컨텍 에딩' },
  { code: 'occlusion_high', label: '교합 높음' },
  { code: 'occlusion_low', label: '교합 낮음' },
  { code: 'etc', label: '기타', freeText: true },
];

export function repairReasonLabel(code: string): string {
  return REPAIR_REASONS.find((r) => r.code === code)?.label ?? code;
}

/**
 * 고른 사유를 기공소가 읽을 한 줄로 만듭니다.
 *
 * ★ 코드가 아니라 사람 말로 저장합니다.
 *   기공작업지시서와 대화창에 그대로 실립니다. 코드로 두면 읽는 쪽이
 *   목록을 따로 봐야 하고, 목록이 바뀌면 지난 주문의 뜻이 흔들립니다.
 */
export function buildRepairNote(codes: string[], freeText: string): string {
  const picked = REPAIR_REASONS.filter((r) => codes.includes(r.code) && !r.freeText).map(
    (r) => r.label,
  );

  const extra = codes.includes('etc') ? freeText.trim() : '';

  return [...picked, extra].filter(Boolean).join(' · ');
}

/** 넣어도 되는 사유인가 */
export function checkRepairReasons(
  codes: string[],
  freeText: string,
): { ok: true } | { ok: false; reason: string } {
  if (codes.length === 0) return { ok: false, reason: '증상을 하나 이상 골라 주세요' };

  if (codes.includes('etc') && !freeText.trim()) {
    return { ok: false, reason: '기타를 고르셨으면 내용을 적어 주세요' };
  }

  return { ok: true };
}
