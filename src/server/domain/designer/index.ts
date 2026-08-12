// =========================================================
// 놓을 위치: src/server/domain/designer/index.ts
//
// 담당 디자이너. (사용자 결정 2026-08-12 —
//   "배정된 주문서에 대해선 다른 디자이너가 디자인을 잡아서는 안되게 막아야해.
//    두명의 디자이너가 한 주문을 하면 안되잖아")
//
// ★ 전에는 담당자를 따로 두지 않고 order_status_history 에서 캐냈습니다.
//   '디자인 단계로 옮긴 사람' 이 곧 디자이너였습니다. 읽기에는 충분했지만
//   **막을 수는 없었습니다** — 이미 벌어진 일을 뒤에서 읽는 값이라,
//   두 사람이 같은 주문을 열고 나란히 눌러도 둘 다 통과했습니다.
//   이제 orders.designer_user_id 라는 **사실**이 따로 있고, 이 파일이
//   그 사실을 두고 누가 무엇을 할 수 있는지 정합니다.
//
// ★ 먼저 잡은 사람이 임자입니다.
//   배정 화면을 먼저 거치게 하면 주문마다 배정하는 일이 하나 더 생깁니다.
//   디자인을 잡는 순간이 곧 배정입니다 — 실제로 일하는 사람이 임자가
//   되는 것이 가장 덜 틀립니다.
// =========================================================

import type { OrderStatus } from '@/server/domain/order-status';

/** 지금 이 주문을 누가 맡고 있는가 */
export interface DesignSeat {
  /** 아직 아무도 안 잡았으면 null */
  designerId: string | null;
  /** 막을 때 이름을 불러 줍니다. 모르면 빈 문자열 */
  designerName?: string;
}

/** 지금 누르는 사람 */
export interface Viewer {
  userId: string;
  /** 관리자인가 (domain/member 의 canManageMembers) */
  isManager: boolean;
}

export type SeatVerdict =
  | { ok: true; claim: boolean }
  | { ok: false; reason: string };

/**
 * 이 전이가 '자리' 를 따지는 전이인가.
 *
 * ★ 둘뿐입니다.
 *   ① 디자인을 **잡는** 순간 (접수·재스캔 → 디자인)
 *   ② 디자인 중인 건을 **밖으로 내보내는** 것 (→ 제작대기, → 재스캔)
 *
 * ★ 되돌아오는 것은 안 막습니다.
 *   기공소가 수정을 요청해 디자인으로 되돌리는 일은 **남의 일을 뺏는 것이
 *   아니라 돌려주는 것**입니다. 여기까지 막으면, 담당자가 자리를 비운
 *   사이 기공소의 수정 요청이 갈 곳을 잃습니다.
 */
export function needsSeat(from: OrderStatus, to: OrderStatus): boolean {
  if (to === 'designing') return from === 'received' || from === 'rescan';
  return from === 'designing';
}

/**
 * 이 사람이 이 주문의 디자인을 만져도 되는가.
 *
 * ★ 관리자도 그냥은 못 만집니다.
 *   "금액만 더 본다" 가 관리자와 사용자의 차이인데, 여기서만 예외를 두면
 *   **두 명이 한 주문을 만지는 일이 결국 생깁니다.** 대신 관리자에게는
 *   배정을 바꾸는 길이 열려 있습니다 — 한 번 더 누르는 대신,
 *   누가 넘겨받았는지가 화면과 기록에 남습니다.
 */
export function checkSeat(seat: DesignSeat, viewer: Viewer): SeatVerdict {
  // 아무도 안 잡았습니다 — 지금 누르는 사람이 잡습니다
  if (!seat.designerId) return { ok: true, claim: true };

  if (seat.designerId === viewer.userId) return { ok: true, claim: false };

  const who = seat.designerName?.trim() || '다른 디자이너';

  return {
    ok: false,
    reason: viewer.isManager
      ? `${who} 님이 맡은 주문입니다. 담당을 바꾼 뒤에 진행해 주세요`
      : `${who} 님이 맡은 주문입니다`,
  };
}

/**
 * 담당을 이 값으로 바꿔도 되는가.
 *
 * ★ 관리자는 아무에게나 넘깁니다 (아프거나 그만두면 누군가는 이어받아야 합니다).
 * ★ 사용자는 **자기가 잡거나 자기가 내려놓는 것**만 합니다.
 *   내려놓기를 막으면, 관리자가 자리에 없는 동안 잘못 잡은 주문이
 *   아무도 못 건드리는 상태로 굳습니다.
 */
export function checkAssign(
  seat: DesignSeat,
  viewer: Viewer,
  next: string | null,
): SeatVerdict {
  if (seat.designerId === next) return { ok: true, claim: false };

  if (viewer.isManager) return { ok: true, claim: next === viewer.userId };

  // 남이 잡고 있는 것은 뺏지 못합니다
  if (seat.designerId && seat.designerId !== viewer.userId) {
    const who = seat.designerName?.trim() || '다른 디자이너';
    return { ok: false, reason: `${who} 님이 맡은 주문입니다. 관리자만 담당을 바꿉니다` };
  }

  // 빈자리거나 내 자리입니다 — 나에게 오거나 비우는 것만 됩니다
  if (next !== null && next !== viewer.userId) {
    return { ok: false, reason: '남에게 넘기는 것은 관리자만 할 수 있습니다' };
  }

  return { ok: true, claim: next === viewer.userId };
}

/** 담당을 고칠 수 있는 상태인가. 완료·취소된 건은 손대지 않습니다 */
const SETTLED: OrderStatus[] = ['completed', 'cancelled'];

export function assignable(status: OrderStatus): boolean {
  return !SETTLED.includes(status);
}

/** 화면에 쓰는 이름 */
export function seatLabel(seat: DesignSeat): string {
  if (!seat.designerId) return '미지정';
  return seat.designerName?.trim() || '이름 없음';
}
