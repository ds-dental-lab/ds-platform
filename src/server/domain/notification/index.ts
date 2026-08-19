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

  /*
    ★ 배송으로 넘어간 것은 알리지 않습니다 (사용자 결정 2026-08-19 —
      "제작 → 배송 이런건 알림은 없어도 된다").
      치과가 받아서 할 일이 생기는 것은 맞지만, 물건은 어차피 그날
      옵니다 — 종에 건마다 쌓이면 정작 봐야 할 대화가 묻힙니다.
      오늘 올 것은 HOME 의 '오늘 배송 예정' 카드가 이미 보여 줍니다.
  */
  if (to === 'shipping') return [];

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

// ---------- 주문 대화 (사용자 결정 2026-08-13) ----------

/** 대화 알림 본문에 실을 글의 최대 길이 */
export const MESSAGE_PREVIEW = 60;

/**
 * 주문 대화에 글이 올라왔을 때 누구에게 알릴지.
 *
 * ★ 왜 필요했나.
 *   대화만 알림을 하나도 안 만들고 있었습니다. 상태가 바뀌면 종에
 *   숫자가 붙는데, 글은 아무 소리 없이 쌓였습니다. 치과가 급한 것을
 *   적어 놓아도 상대가 그 주문을 다시 열 때까지 아무도 모릅니다.
 *   **대화창이 실시간인지보다 이것이 먼저입니다** — 아무도 그 화면을
 *   보고 있지 않기 때문입니다.
 *
 * ★ 나머지 둘에게 갑니다.
 *   한 주문에는 세 자리가 있고, 쓴 사람 말고 둘이 읽습니다.
 *   '다음 차례' 만 고르지 않습니다 — 대화는 일을 넘기는 것이 아니라
 *   물어보는 것이라, 누가 답할지 미리 알 수 없습니다.
 *
 * ★ 자기 자신에게는 안 갑니다.
 *   자사 제작이면 디자인센터가 기공소 자리를 겸합니다. 슬롯으로만
 *   가르면 자기가 쓴 글이 자기 종에 붙습니다. 실제로 걸러내는 것은
 *   조직 id 이므로 부르는 쪽(events)이 한 번 더 봅니다.
 *
 * ★ 인앱만입니다. 알림톡은 안 씁니다.
 *   대화는 하루에도 여러 번 오갑니다. 그때마다 문자가 나가면 요금도
 *   요금이지만 사람이 알림을 꺼 버립니다. 종에만 붙입니다.
 */
export function planMessageNotifications(
  author: Sector,
  context: {
    orderNo: string;
    patientLabel: string;
    body: string;
    /** 쓴 사람의 조직 이름 — '어디가 말했나' 가 제목입니다 */
    authorName: string;
  },
): NotificationPlan[] {
  const mine = slotOfSector(author);
  const others: RecipientSlot[] = (['clinic', 'design', 'lab'] as RecipientSlot[]).filter(
    (slot) => slot !== mine,
  );

  const preview =
    context.body.length > MESSAGE_PREVIEW
      ? `${context.body.slice(0, MESSAGE_PREVIEW)}…`
      : context.body;

  return others.map((to) => ({
    to,
    channel: 'in_app' as const,
    title: `${context.authorName || SECTOR_NAME[author]} 님이 대화를 남겼습니다`,
    body: `${context.orderNo} · ${context.patientLabel}\n${preview}`,
  }));
}

const SECTOR_NAME: Record<Sector, string> = {
  clinic: '치과',
  design_center: '디자인센터',
  lab: '기공소',
};

/**
 * 계획을 실제로 받을 조직에 맞춰 봅니다.
 *
 * ★ 슬롯만 보고 보내면 안 됩니다. 세 가지가 걸립니다.
 *   ① 기공소가 아직 안 정해졌으면 보낼 곳이 없습니다
 *   ② **자사 제작이면 디자인센터가 기공소 자리를 겸합니다** —
 *     슬롯으로만 가르면 자기가 쓴 글이 자기 종에 붙습니다
 *   ③ 한 조직이 두 자리를 맡으면 같은 알림이 두 번 갑니다
 *
 * ★ 순수 함수로 빼 둔 이유.
 *   ②는 조직 구조가 통합 모델이라 늘 도사리고 있는 함정입니다
 *   (설계서 Q-6). 눈으로 읽어서는 안 틀렸다고 장담할 수 없습니다.
 */
/**
 * 안 읽은 대화 알림들을 주문별로 셉니다. (사용자 요청 2026-08-19 —
 *   "모든 알림이 종으로 오니깐 종알림으로 많이 안 볼 거야")
 *
 * ★ 종에서 대화만 따로 꺼내 눈에 박는 데 씁니다 — 주문목록의 💬 뱃지와
 *   HOME 의 안 읽은 대화 띠가 이 수를 그립니다.
 *
 * ★ payload 를 믿지 않습니다.
 *   알림은 여러 곳에서 만듭니다. orderId 가 없거나 글자가 아니면
 *   조용히 빼지, 화면을 죽이지 않습니다.
 */
export function countUnreadChatByOrder(payloads: unknown[]): Record<string, number> {
  const out: Record<string, number> = {};

  for (const payload of payloads) {
    const orderId = (payload as { orderId?: unknown } | null)?.orderId;
    if (typeof orderId !== 'string' || !orderId) continue;

    out[orderId] = (out[orderId] ?? 0) + 1;
  }

  return out;
}

export function resolveRecipients(
  plans: NotificationPlan[],
  orgOf: Record<RecipientSlot, string | null>,
  authorOrgId: string,
): { plan: NotificationPlan; orgId: string }[] {
  const seen = new Set<string>([authorOrgId]);
  const out: { plan: NotificationPlan; orgId: string }[] = [];

  for (const plan of plans) {
    const orgId = orgOf[plan.to];
    if (!orgId || seen.has(orgId)) continue;

    seen.add(orgId);
    out.push({ plan, orgId });
  }

  return out;
}
