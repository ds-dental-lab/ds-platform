// =========================================================
// 놓을 위치: src/server/events/shade-photo.ts
//
// 쉐이드 사진이 붙었다고 알립니다. (명세서 SPEC_shade-photo S4)
//
// ★★ 화면이 "덴플로우 치과기공소에 알림을 보냈습니다" 라고 **말만**
//   하고 있었습니다 (2026-08-21). 하지도 않은 일을 했다고 하는 것이라
//   먼저 고칩니다.
//
// ★ 받는 쪽은 **지금 그 주문을 쥐고 있는 곳**입니다.
//   접수·디자인 단계에서는 디자인센터가 작업합니다. 기공소는 아직
//   배정도 안 됐을 수 있습니다. 배정돼 있으면 둘 다 받습니다 —
//   쉐이드는 만드는 사람이 봐야 하는 것이라 넓게 알립니다.
//
// ★ 여기서 실패해도 사진은 이미 붙었습니다. 되돌리지 않습니다
//   (events/index 와 같은 규칙).
// =========================================================

import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { shadeNotice, shadePushPayload } from '@/server/domain/shade-photo';
import { sendPushToOrgs } from '@/server/events/push';

export interface ShadePhotoAddedEvent {
  orderId: string;
  count: number;
  actorOrgId: string;
  actorUserId: string;
}

export async function publishShadePhotoAdded(event: ShadePhotoAddedEvent): Promise<void> {
  try {
    if (event.count <= 0) return;

    const supabase = await createClient();

    const { data } = await supabase
      .from('orders')
      .select('order_no, patient_label, design_org_id, lab_org_id')
      .eq('id', event.orderId)
      .maybeSingle();

    if (!data) return;

    const order = data as unknown as {
      order_no: string;
      patient_label: string;
      design_org_id: string | null;
      lab_org_id: string | null;
    };

    const notice = shadeNotice(order.order_no, order.patient_label, event.count);

    const { data: saved } = await supabase
      .from('domain_events')
      .insert({
        event_type: 'order.shade_photo_added',
        aggregate_type: 'order',
        aggregate_id: event.orderId,
        actor_org_id: event.actorOrgId,
        actor_user_id: event.actorUserId,
        payload: { count: event.count },
      })
      .select('id')
      .single();

    /*
      ★ 보낼 곳을 모읍니다. 자사 제작이면 센터와 기공소가 같은 조직이라
        같은 곳에 두 번 가지 않게 걸러냅니다.
    */
    const targets = [
      { orgId: order.design_org_id, base: '/design/orders' },
      { orgId: order.lab_org_id, base: '/lab/orders' },
    ].filter(
      (t, i, all) => t.orgId && all.findIndex((x) => x.orgId === t.orgId) === i,
    ) as { orgId: string; base: string }[];

    if (targets.length === 0) return;

    await supabase.from('notifications').insert(
      targets.map((t) => ({
        org_id: t.orgId,
        event_id: saved?.id ?? null,
        channel: 'in_app' as const,
        status: 'sent' as const,
        event_type: 'order.shade_photo_added',
        title: notice.title,
        body: notice.body,
        link: `${t.base}/${event.orderId}`,
        payload: { orderId: event.orderId, count: event.count },
      })),
    );

    /*
      ★ 웹푸시도 함께. 기공소가 화면을 안 보고 있어도 폰이 울립니다 —
        쉐이드는 색을 보는 일이라 늦게 알면 이미 만들어 버린 뒤입니다.
    */
    // ★ sendPushToOrgs 는 Map 을 받습니다 (events/index 와 같은 모양)
    await sendPushToOrgs(
      new Map(
        targets.map((t) => [
          t.orgId,
          shadePushPayload(
            event.orderId,
            order.order_no,
            order.patient_label,
            event.count,
            `${t.base}/${event.orderId}`,
          ),
        ]),
      ),
    );
  } catch (error) {
    // 사진은 이미 붙었습니다. 알림 실패로 되돌리지 않습니다.
    console.error('[events] 쉐이드 사진 알림 실패', error);
  }
}
