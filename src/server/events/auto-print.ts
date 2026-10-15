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
import { autoAlert, type AutoAlertKind } from '@/server/domain/auto-print';
import { sendPushToOrgs } from '@/server/events/push';

export async function publishAutoAlert(orderId: string, kind: AutoAlertKind): Promise<void> {
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
    });
    const link = `/clinic/orders/${orderId}`;
    const eventType = kind === 'bed' ? 'order.auto_print.bed' : 'order.auto_print.done';

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
