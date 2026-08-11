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
    /** 기공소에 나가는 본문에 쓸 마스킹 이름 (설계서 §8.5) */
    patientLabelMasked: string;
    reason?: string | null;
  },
): NotificationPlan[] {
  const { orderNo, patientLabel, patientLabelMasked, reason } = context;

  /**
   * ★ 알림 본문에도 §8.5 가 적용됩니다.
   *   조회 화면에서 실명을 가려 놓고 알림으로 흘려보내면 아무 의미가 없습니다.
   *   받는 쪽이 기공소면 마스킹 이름을 씁니다.
   */
  const subjectFor = (slot: RecipientSlot) =>
    `${orderNo} · ${slot === 'lab' ? patientLabelMasked : patientLabel}`;

  // ① 접수 — 새 주문이 디자인센터로 들어옴
  //    (재스캔 → 접수 복귀도 디자인센터가 다시 봐야 합니다)
  if (to === 'received') {
    return [
      {
        to: 'design',
        channel: 'kakao',
        title: '새 주문이 접수되었습니다',
        body: subjectFor('design'),
      },
    ];
  }

  // ② 재스캔 — 치과가 다시 찍어 올려야 함
  if (to === 'rescan') {
    const subject = subjectFor('clinic');
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
        body: subjectFor('lab'),   // 마스킹된 이름이 나갑니다
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
      body: subjectFor(inAppTarget),
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
