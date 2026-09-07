// =========================================================
// 놓을 위치: src/app/(mobile)/m/chats/[orderId]/page.tsx
//
// 폰 — 대화방 하나. 치과·센터 둘 다. (사용자 요청 2026-09-06)
//
// ★ 푸시 알림을 누르면 여기로 옵니다 (push-sw.js 가 폰이면 주소를 바꿔
//   줍니다). 그래서 없는 주문이면 404 가 아니라 목록으로 돌려보냅니다 —
//   알림을 눌렀는데 빈 화면이면 고장으로 보입니다.
// =========================================================

import { redirect } from 'next/navigation';
import { requireSession } from '@/server/policies/session';
import { getOrderDetail } from '@/server/repositories/order';
import { listOrderMessages } from '@/server/repositories/order-message';
import MobileChatRoom from '@/components/chat/MobileChatRoom';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: '대화' };

export default async function MobileChatRoomPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await requireSession();
  const { orderId } = await params;

  // ★ 둘은 서로를 안 씁니다 — 함께 보냅니다
  const [order, messages] = await Promise.all([getOrderDetail(orderId), listOrderMessages(orderId)]);
  if (!order) redirect('/m/chats');

  const isCenter = session.orgType === 'design_center';
  /*
    ★ 머리줄의 상대 이름 — 목록(chat-room 저장소)과 같은 글자여야 합니다.
      주문 상세에는 센터 이름이 없어 한 번 더 묻습니다. 치과가 열 때만.
  */
  const counterpart = isCenter ? order.clinic_name : await designCenterName(order.id);

  return (
    <MobileChatRoom
      orderId={order.id}
      orderNo={order.order_no}
      patientLabel={order.patient_label}
      /* 치과가 보면 센터 이름, 센터가 보면 치과 이름 */
      counterpart={counterpart}
      messages={messages}
      sector={session.orgType ?? 'clinic'}
      /* 센터는 폰 주문 화면(종류·치식), 치과는 그 의뢰서의 촬영 화면 */
      detailHref={isCenter ? `/m/orders/${order.id}` : `/m/${order.id}`}
    />
  );
}

async function designCenterName(orderId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('orders')
    .select('design:organizations!orders_design_org_id_fkey(name)')
    .eq('id', orderId)
    .maybeSingle();
  return (data as { design: { name: string } | null } | null)?.design?.name ?? '디자인센터';
}
