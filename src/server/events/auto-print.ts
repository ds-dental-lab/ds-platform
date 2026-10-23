// =========================================================
// 놓을 위치: src/server/events/auto-print.ts
//
// FlowTemp — 치과가 손댈 일이 생기면 알립니다 (사용자 요청 2026-10-15).
//
// ★ 둘뿐입니다: 출력판을 비워 달라 / 다 나왔으니 꺼내 달라 (domain/auto-print).
// ★ 단계를 바꾸는 쪽이 **기기**(설계 PC·치과 PC)라 로그인한 사람이 없습니다.
//   그래서 관리자 열쇠로 씁니다. 받는 곳은 그 주문의 치과 하나뿐입니다.
// ★ 여기서 실패해도 단계는 이미 넘어갔습니다. 되돌리지 않습니다
//   (events/index 와 같은 규칙).
// =========================================================

import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { alertPushes, autoAlert, type AutoAlertKind } from '@/server/domain/auto-print';
import { sendPushToOrgs } from '@/server/events/push';

export async function publishAutoAlert(
  orderId: string,
  kind: AutoAlertKind,
  reason?: string | null,
): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data } = await admin
      .from('orders')
      .select('order_no, patient_label, clinic_org_id')
      .eq('id', orderId)
      .maybeSingle();
    const order = data as { order_no: string; patient_label: string; clinic_org_id: string } | null;
    if (!order) return;

    // ★ 제품 이름은 표에서 — 이름이 바뀌면 알림도 따라갑니다
    const { data: type } = await admin
      .from('prosthesis_types')
      .select('name')
      .eq('auto_pipeline', true)
      .order('sort_order')
      .limit(1)
      .maybeSingle();
    const productName = (type as { name: string } | null)?.name ?? '임시치아';

    const alert = autoAlert(kind, {
      orderNo: order.order_no,
      patientLabel: order.patient_label,
      productName,
      reason,
    });
    const link = `/clinic/orders/${orderId}`;
    const eventType = `order.auto_print.${kind}`;

    await admin.from('notifications').insert({
      org_id: order.clinic_org_id,
      channel: 'in_app',
      status: 'sent',
      event_type: eventType,
      title: alert.title,
      body: alert.body,
      link,
      payload: { orderId, kind },
    });

    // ★ '다 나왔다' 는 폰으로 안 보냅니다 — 종 알림·책갈피만 (사용자 2026-10-23)
    if (!alertPushes(kind)) return;

    await sendPushToOrgs(
      new Map([
        [
          order.clinic_org_id,
          // ★ 같은 주문이면 갈아끼웁니다 — '비워 주세요' 뒤에 '다 나왔습니다' 가 남게
          { title: alert.title, body: alert.body, link, tag: `auto-print-${orderId}` },
        ],
      ]),
    );
  } catch (error) {
    console.error('[events] 자동 출력 알림 실패', error);
  }
}

/**
 * 디자인이 멈췄다고 **센터에** 알립니다 (2026-10-16 점검).
 *
 * ★ 전에는 센터가 주문 상세를 열어야만 알았습니다. 멈춘 디자인은 센터가 손댈
 *   일입니다(치과는 '디자인 지연' 만 봅니다). 까닭을 그대로 실어 보냅니다 —
 *   센터 화면이라 덴트버드 이야기가 들어가도 됩니다.
 */
/**
 * 서버 PC 의 덴트버드 로그인이 풀렸습니다 — 센터에 종·푸시 (2026-10-23).
 * ★ 주문이 오기 **전에** 알리는 것이 목적입니다. 풀린 채로 주문이 오면 그 주문이 멈춥니다.
 * ★ 같은 계정으로 다른 PC 에서 로그인하면 생깁니다 — 사람용 계정은 따로 씁니다.
 */
export async function publishDentbirdLoggedOut(orgId: string, deviceName: string, detail: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const title = '덴트버드 로그인이 풀렸습니다 — FlowTemp 설계가 멈춥니다';
    const body = `${deviceName} — 서버 PC 의 덴트버드 전용 창에서 다시 로그인해 주세요. ${detail}`.slice(0, 300);
    const link = '/design/devices';

    await admin.from('notifications').insert({
      org_id: orgId,
      channel: 'in_app',
      status: 'sent',
      event_type: 'device.dentbird_logged_out',
      title,
      body,
      link,
      payload: { deviceName },
    });
    await sendPushToOrgs(new Map([[orgId, { title, body, link, tag: 'dentbird-logged-out' }]]));
  } catch (error) {
    console.error('[events] 덴트버드 로그인 풀림 알림 실패', error);
  }
}

export async function publishDesignStall(orderId: string, note: string | null): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('orders')
      .select('order_no, patient_label, design_org_id')
      .eq('id', orderId)
      .maybeSingle();
    const order = data as { order_no: string; patient_label: string; design_org_id: string | null } | null;
    if (!order?.design_org_id) return;

    const title = `FlowTemp 디자인이 멈췄습니다 — ${order.order_no}`;
    const body = `${order.patient_label} — ${note?.trim() || '주문 화면에서 까닭을 확인하세요'}`;
    const link = `/design/orders/${orderId}`;

    await admin.from('notifications').insert({
      org_id: order.design_org_id,
      channel: 'in_app',
      status: 'sent',
      event_type: 'order.auto_print.design_stalled',
      title,
      body,
      link,
      payload: { orderId },
    });
    await sendPushToOrgs(new Map([[order.design_org_id, { title, body, link, tag: `auto-design-${orderId}` }]]));
  } catch (error) {
    console.error('[events] 디자인 멈춤 알림 실패', error);
  }
}
