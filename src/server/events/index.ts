// =========================================================
// 놓을 위치: src/server/events/index.ts
//
// 이벤트를 남기고, 그것을 구독해 알림을 만듭니다. (설계서 §3.4, §6)
//
// ★ 여기서 실패해도 업무는 되돌리지 않습니다.
//   알림이 안 갔다고 이미 넘어간 주문 상태를 되돌리면 더 큰 사고입니다.
//   대신 실패를 서버 로그에 남깁니다.
//
// ★ 카카오 알림톡(Q-7)은 유료 발송대행사 계약이 필요해 아직 붙이지 않았습니다.
//   'kakao' 로 계획된 알림도 지금은 인앱으로만 저장하고, 나중에
//   sendKakao() 자리에 어댑터를 끼우면 됩니다. 이 파일 밖은 손댈 일이 없습니다.
// =========================================================

import { createClient } from '@/lib/supabase/server';
import {
  planStatusNotifications,
  planMessageNotifications,
  resolveRecipients,
  MESSAGE_PREVIEW,
  type RecipientSlot,
} from '@/server/domain/notification';
import type { OrderStatus, Sector } from '@/server/domain/order-status';
import { eventFor } from '@/server/domain/alimtalk';
import { queueAlimtalk } from '@/server/events/alimtalk';

export interface OrderStatusChangedEvent {
  orderId: string;
  from: OrderStatus;
  to: OrderStatus;
  actorSector: Sector;
  actorOrgId: string;
  actorUserId: string;
  reason?: string | null;
}

/**
 * 상태 변경을 기록하고 알림을 만듭니다.
 * changeOrderStatus 가 상태를 바꾼 직후에 부릅니다.
 */
export async function publishOrderStatusChanged(
  event: OrderStatusChangedEvent,
): Promise<void> {
  try {
    const supabase = await createClient();

    // 알림을 보낼 조직 id 는 주문에 들어 있습니다
    const { data } = await supabase
      .from('orders')
      .select('order_no, patient_label, clinic_org_id, design_org_id, lab_org_id')
      .eq('id', event.orderId)
      .maybeSingle();

    if (!data) return;

    const order = data as unknown as {
      order_no: string;
      patient_label: string;
      clinic_org_id: string | null;
      design_org_id: string | null;
      lab_org_id: string | null;
    };

    const { data: saved } = await supabase
      .from('domain_events')
      .insert({
        event_type: 'order.status_changed',
        aggregate_type: 'order',
        aggregate_id: event.orderId,
        actor_org_id: event.actorOrgId,
        actor_user_id: event.actorUserId,
        payload: {
          from: event.from,
          to: event.to,
          reason: event.reason ?? null,
        },
      })
      .select('id')
      .single();

    const plans = planStatusNotifications(event.from, event.to, event.actorSector, {
      orderNo: order.order_no,
      patientLabel: order.patient_label,
      reason: event.reason,
    });

    const orgOf: Record<RecipientSlot, string | null> = {
      clinic: order.clinic_org_id,
      design: order.design_org_id,
      lab: order.lab_org_id,
    };

    const rows = plans
      .map((plan) => ({ plan, orgId: orgOf[plan.to] }))
      // 아직 배정 안 된 기공소처럼, 받을 조직이 없으면 건너뜁니다
      .filter(({ orgId }) => Boolean(orgId))
      .map(({ plan, orgId }) => ({
        org_id: orgId,
        event_id: saved?.id ?? null,
        // 알림톡이 붙기 전까지는 전부 인앱으로 남깁니다
        channel: 'in_app' as const,
        status: 'sent' as const,
        event_type: 'order.status_changed',
        title: plan.title,
        body: plan.body ?? null,
        link: linkFor(plan.to, event.orderId),
        payload: {
          orderId: event.orderId,
          from: event.from,
          to: event.to,
          // 알림톡으로 나갔어야 할 건인지 남겨 둡니다 (나중에 재발송 근거)
          intendedChannel: plan.channel,
        },
      }));

    if (rows.length > 0) {
      await supabase.from('notifications').insert(rows);
    }

    /*
      ★ 알림톡은 인앱과 **따로** 쌓습니다 (2026-08-14).
        인앱은 조직 하나에 한 줄이면 되지만, 알림톡은 사람마다 한 줄이라
        받는 사람도 번호도 다릅니다. 규칙도 다릅니다 — 인앱은 상태가
        바뀔 때마다 넘겨받는 쪽에 가지만, 알림톡은 셋(접수·제작대기·
        재스캔)에만 갑니다.
    */
    const kakao = eventFor(event.from, event.to);

    if (kakao) {
      await queueAlimtalk(kakao, {
        orderId: event.orderId,
        orderNo: order.order_no,
        patientLabel: order.patient_label,
        clinicOrgId: order.clinic_org_id,
        designOrgId: order.design_org_id,
        labOrgId: order.lab_org_id,
      });
    }
  } catch (error) {
    // 업무는 이미 끝났습니다. 알림 실패로 되돌리지 않습니다.
    console.error('[events] 주문 상태 이벤트 처리 실패', error);
  }
}

/**
 * 주문이 새로 등록됐습니다. (Q-7 ① 접수 발생 → 디자인센터)
 *
 * 상태 전이가 아니라 생성이라 따로 둡니다.
 * 리메이크·리페어도 여기를 지나가면 됩니다.
 */
export async function publishOrderCreated(event: {
  orderId: string;
  actorOrgId: string;
  actorUserId: string;
  /**
   * 무슨 주문인가. (2026-08-13)
   *
   * ★ 리메이크는 **새 주문보다 급합니다.**
   *   이미 한 번 만들어 보낸 것이 잘못됐다는 뜻이고, 환자는 이미
   *   한 번 헛걸음했습니다. 같은 제목으로 오면 그 급함이 안 보입니다.
   */
  kind?: 'new' | 'remake';
}): Promise<void> {
  try {
    const supabase = await createClient();

    const { data: order } = await supabase
      .from('orders')
      .select('order_no, patient_label, design_org_id')
      .eq('id', event.orderId)
      .maybeSingle();

    if (!order?.design_org_id) return;

    /*
      ★ 접수 알림톡은 **새 주문일 때만** 입니다 (2026-08-14).
        리메이크도 디자인센터가 받아야 하지만 문구가 달라야 합니다 —
        "새 주문" 이라고 보내면 이미 한 번 틀어진 건이 새 건으로 읽힙니다.
        템플릿이 정해지면 여기서 갈라 줍니다.
    */
    if (event.kind !== 'remake') {
      await queueAlimtalk('order_received', {
        orderId: event.orderId,
        orderNo: order.order_no,
        patientLabel: order.patient_label,
        clinicOrgId: null,
        designOrgId: order.design_org_id,
        labOrgId: null,
      });
    }

    const remake = event.kind === 'remake';
    const eventType = remake ? 'order.remake_requested' : 'order.created';

    const { data: saved } = await supabase
      .from('domain_events')
      .insert({
        event_type: eventType,
        aggregate_type: 'order',
        aggregate_id: event.orderId,
        actor_org_id: event.actorOrgId,
        actor_user_id: event.actorUserId,
        payload: { orderNo: order.order_no },
      })
      .select('id')
      .single();

    await supabase.from('notifications').insert({
      org_id: order.design_org_id,
      event_id: saved?.id ?? null,
      channel: 'in_app',
      status: 'sent',
      event_type: eventType,
      title: remake ? '리메이크가 접수되었습니다' : '새 주문이 접수되었습니다',
      body: `${order.order_no} · ${order.patient_label}`,
      link: `/design/orders/${event.orderId}`,
      payload: { orderId: event.orderId, intendedChannel: 'kakao' },
    });
  } catch (error) {
    console.error('[events] 주문 생성 이벤트 처리 실패', error);
  }
}

/**
 * 리페어가 신청됐습니다. (설계서 §4.5 — 알림은 배정된 기공소에게)
 *
 * 기공소는 이 알림을 보고 택배사에 수거를 수동으로 접수합니다.
 * 그래서 본문에 수거 안내를 함께 넣습니다.
 */
export async function publishRepairRequested(event: {
  repairOrderId: string;
  parentOrderId: string;
  labOrgId: string;
  actorOrgId: string;
  actorUserId: string;
  notes: string;
}): Promise<void> {
  try {
    const supabase = await createClient();

    // ★ 기공소가 이 이름으로 케이스를 찾아 수거합니다 — 가리면 못 찾습니다
    const { data } = await supabase
      .from('orders')
      .select('order_no, patient_label')
      .eq('id', event.repairOrderId)
      .maybeSingle();

    if (!data) return;

    const order = data as unknown as {
      order_no: string;
      patient_label: string;
    };

    const { data: saved } = await supabase
      .from('domain_events')
      .insert({
        event_type: 'order.repair_requested',
        aggregate_type: 'order',
        aggregate_id: event.repairOrderId,
        actor_org_id: event.actorOrgId,
        actor_user_id: event.actorUserId,
        payload: { parentOrderId: event.parentOrderId, notes: event.notes },
      })
      .select('id')
      .single();

    await supabase.from('notifications').insert({
      org_id: event.labOrgId,
      event_id: saved?.id ?? null,
      channel: 'in_app',
      status: 'sent',
      event_type: 'order.repair_requested',
      title: '리페어가 접수되었습니다 · 수거 필요',
      body:
        `${order.order_no} · ${order.patient_label}\n` +
        `요청: ${event.notes}\n` +
        '보철물 수거를 택배사에 접수해 주세요.',
      link: `/lab/orders/${event.repairOrderId}`,
      payload: {
        orderId: event.repairOrderId,
        parentOrderId: event.parentOrderId,
        intendedChannel: 'kakao',
      },
    });
  } catch (error) {
    console.error('[events] 리페어 이벤트 처리 실패', error);
  }
}

/**
 * 주문 대화에 글이 올라왔습니다. (사용자 결정 2026-08-13)
 *
 * ★ 여기서 실패해도 글은 이미 올라갔습니다.
 *   알림이 안 붙었다고 남의 말을 지우지 않습니다.
 */
export async function publishOrderMessage(event: {
  orderId: string;
  authorOrgId: string;
  authorUserId: string;
  authorSector: Sector;
  authorName: string;
  body: string;
}): Promise<void> {
  try {
    const supabase = await createClient();

    const { data } = await supabase
      .from('orders')
      .select('order_no, patient_label, clinic_org_id, design_org_id, lab_org_id')
      .eq('id', event.orderId)
      .maybeSingle();

    if (!data) return;

    const order = data as unknown as {
      order_no: string;
      patient_label: string;
      clinic_org_id: string | null;
      design_org_id: string | null;
      lab_org_id: string | null;
    };

    const { data: saved } = await supabase
      .from('domain_events')
      .insert({
        event_type: 'order.message',
        aggregate_type: 'order',
        aggregate_id: event.orderId,
        actor_org_id: event.authorOrgId,
        actor_user_id: event.authorUserId,
        payload: { preview: event.body.slice(0, MESSAGE_PREVIEW) },
      })
      .select('id')
      .single();

    const plans = planMessageNotifications(event.authorSector, {
      orderNo: order.order_no,
      patientLabel: order.patient_label,
      body: event.body,
      authorName: event.authorName,
    });

    const orgOf: Record<RecipientSlot, string | null> = {
      clinic: order.clinic_org_id,
      design: order.design_org_id,
      lab: order.lab_org_id,
    };

    // 누가 실제로 받는지는 도메인이 정합니다 (자사 제작 함정이 여기 있습니다)
    const rows = resolveRecipients(plans, orgOf, event.authorOrgId).map(({ plan, orgId }) => ({
      org_id: orgId,
      event_id: saved?.id ?? null,
      channel: 'in_app' as const,
      status: 'sent' as const,
      event_type: 'order.message',
      title: plan.title,
      body: plan.body ?? null,
      link: linkFor(plan.to, event.orderId),
      payload: { orderId: event.orderId },
    }));

    if (rows.length > 0) {
      await supabase.from('notifications').insert(rows);
    }
  } catch (error) {
    console.error('[events] 대화 알림 처리 실패', error);
  }
}

/** 받는 쪽 화면 경로가 섹터마다 다릅니다 */
function linkFor(slot: RecipientSlot, orderId: string): string {
  const base: Record<RecipientSlot, string> = {
    clinic: '/clinic/orders',
    design: '/design/orders',
    lab: '/lab/orders',
  };
  return `${base[slot]}/${orderId}`;
}
