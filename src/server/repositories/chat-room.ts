// =========================================================
// 놓을 위치: src/server/repositories/chat-room.ts
//
// 대화방 목록 — 내가 볼 수 있는 주문의 글을 최신순으로 받아 주문별로
// 묶습니다. (사용자 요청 2026-09-06 — 폰에서 카톡처럼)
//
// ★ 무엇이 보이는지는 RLS 가 정합니다. 치과는 제 주문, 센터는 제 센터
//   주문, 기공소는 배정된 주문 — 여기서는 조건을 더 걸지 않습니다.
// ★ 글 400줄을 받아 브라우저가 아니라 **여기서** 묶습니다. 대화방이
//   많아 봐야 수십 개라 한 번의 왕복으로 끝납니다 (domain/chat-room).
// =========================================================

import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/server/policies/session';
import { unreadChatByOrder } from '@/server/repositories/notification';
import {
  groupChatRooms,
  ROOM_MESSAGE_LIMIT,
  type ChatMessageRow,
  type ChatRoom,
} from '@/server/domain/chat-room';

interface RawRoomMessage {
  order_id: string;
  body: string;
  file_id: string | null;
  author_org_id: string;
  author_name: string;
  created_at: string;
  /* ★ 별칭이 ord 인 이유 — 'order' 는 PostgREST 의 정렬 파라미터 이름입니다 */
  ord: {
    order_no: string;
    patient_label: string;
    clinic: { name: string } | null;
    design: { name: string } | null;
  } | null;
}

export async function listChatRooms(): Promise<ChatRoom[]> {
  const supabase = await createClient();
  const session = await getSession();
  if (!session) return [];

  const [{ data, error }, unread] = await Promise.all([
    supabase
      .from('order_messages')
      .select(
        'order_id, body, file_id, author_org_id, author_name, created_at, ord:orders!inner(order_no, patient_label, clinic:organizations!orders_clinic_org_id_fkey(name), design:organizations!orders_design_org_id_fkey(name))',
      )
      .is('deleted_at', null)
      /*
        ★ 지워진 주문의 대화는 뺍니다 — 방을 눌러도 열 수 없는 주문입니다.
          !inner 라야 이 조건이 글 자체를 거릅니다 (아니면 order 만 null 로 옴).
          처음에 이걸 빼먹어 8월에 지운 시험 주문들이 목록에 올라왔습니다.
      */
      .is('ord.deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(ROOM_MESSAGE_LIMIT),
    unreadChatByOrder(),
  ]);

  if (error || !data) return [];

  /*
    ★ 상대 이름 — 치과가 보면 센터, 센터·기공소가 보면 치과.
      한 방에 셋이 있어도 방 이름은 하나여야 합니다. 환자 이름이 제목이고
      이건 부제라, "누구 치과의 환자" 로 읽히면 충분합니다.
  */
  const isClinic = session.orgType === 'clinic';

  const rows: ChatMessageRow[] = (data as unknown as RawRoomMessage[])
    .filter((r) => r.ord)
    .map((r) => ({
      orderId: r.order_id,
      orderNo: r.ord!.order_no,
      patientLabel: r.ord!.patient_label,
      counterpart: (isClinic ? r.ord!.design?.name : r.ord!.clinic?.name) ?? '',
      body: r.body,
      hasFile: Boolean(r.file_id),
      authorName: r.author_name,
      mine: r.author_org_id === session.orgId,
      createdAt: r.created_at,
    }));

  return groupChatRooms(rows, unread);
}
