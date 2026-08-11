// =========================================================
// 놓을 위치: src/server/domain/notification/index.ts
//
// "어떤 일이 생기면 누구에게 알리는가". (설계서 Q-7 확정)
//
// ★ 이 파일은 순수 함수입니다. DB 도 카카오도 모릅니다.
//   정책만 담고 있어, 알림 규칙이 바뀌면 여기만 고치면 됩니다.
//
// Q-7 확정 내용
//   ① 접수 발생   → 디자인센터   (알림톡)
//   ② 재스캔      → 치과         (알림톡)
//   ③ 제작대기    → 기공소       (알림톡)
//   그 외는 인앱 알림만
// =========================================================

import { STATUS_LABEL, type OrderStatus, type Sector } from '../order-status';

/** 알림을 받을 조직을 어느 자리에서 찾을지 */
export type RecipientSlot = 'clinic' | 'design' | 'lab';

export type NotificationChannel = 'in_app' | 'kakao';

export interface NotificationPlan {
  to: RecipientSlot;
  channel: NotificationChannel;
  title: string;
  body?: string;
}

/**
 * 상태가 바뀌었을 때 누구에게 무엇을 알릴지 정합니다.
 * 받을 사람이 없으면 빈 배열입니다.
 *
 * @param actor 상태를 바꾼 섹터. 자기가 한 일은 자기에게 알리지 않습니다.
 */
export function planStatusNotifications(
  from: OrderStatus,
  to: OrderStatus,
  actor: Sector,
  context: {
    orderNo: string;
    patientLabel: string;
    reason?: string | null;
  },
): NotificationPlan[] {
  const { orderNo, patientLabel, reason } = context;

  /**
   * ★ 기공소에게도 실명이 나갑니다 (사용자 결정 2026-08-11).
   *   배정 알림을 받고 그 이름으로 케이스를 찾아 배송합니다.
   *   가려 보내면 어느 건인지 알 수가 없어 쓸모가 없습니다.
   *
   *   알림은 '배정된 기공소 한 곳' 에만 갑니다 — 누구에게 보낼지는
   *   주문의 lab_org_id 가 정합니다. 남의 건이 섞일 자리가 없습니다.
   */
  const subject = `${orderNo} · ${patientLabel}`;

  // ① 접수 — 새 주문이 디자인센터로 들어옴
  //    (재스캔 → 접수 복귀도 디자인센터가 다시 봐야 합니다)
  if (to === 'received') {
    return [
      {
        to: 'design',
        channel: 'kakao',
        title: '새 주문이 접수되었습니다',
        body: subject,
      },
    ];
  }

  // ② 재스캔 — 치과가 다시 찍어 올려야 함
  if (to === 'rescan') {
    return [
      {
        to: 'clinic',
        channel: 'kakao',
        title: '재스캔이 요청되었습니다',
        body: reason ? `${subject}\n사유: ${reason}` : subject,
      },
    ];
  }

  // ③ 제작대기 — 기공소에 일감이 배정됨
  if (to === 'production_wait') {
    return [
      {
        to: 'lab',
        channel: 'kakao',
        title: '새 제작 건이 배정되었습니다',
        body: subject,
      },
    ];
  }

  // 그 외는 인앱만. 일을 넘겨받는 쪽에 알립니다.
  const inAppTarget = nextOwnerSlot(to);
  if (!inAppTarget || inAppTarget === slotOfSector(actor)) return [];

  return [
    {
      to: inAppTarget,
      channel: 'in_app',
      title: `${STATUS_LABEL[from]} → ${STATUS_LABEL[to]}`,
      body: subject,
    },
  ];
}

/** 그 상태에서 다음으로 움직여야 하는 쪽 */
function nextOwnerSlot(status: OrderStatus): RecipientSlot | null {
  const map: Record<OrderStatus, RecipientSlot | null> = {
    received: 'design',
    rescan: 'clinic',
    designing: 'design',
    production_wait: 'lab',
    production: 'lab',
    shipping: 'clinic',
    completed: 'design',   // 끝났다는 사실은 디자인센터가 알아야 정산이 섭니다
    cancelled: 'design',
  };
  return map[status];
}

function slotOfSector(sector: Sector): RecipientSlot {
  if (sector === 'clinic') return 'clinic';
  if (sector === 'lab') return 'lab';
  return 'design';
}
