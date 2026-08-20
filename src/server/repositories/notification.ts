// =========================================================
// 놓을 위치: src/server/repositories/notification.ts
//
// 인앱 알림 읽기. RLS 가 내 조직 것만 돌려줍니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { countUnreadChatByOrder, patientCall } from '@/server/domain/notification';

export interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export async function listNotifications(limit = 20): Promise<NotificationRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body, link, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as NotificationRow[];
}

/**
 * 안 읽은 대화가 있는 주문 → 건수. 주문목록의 💬 뱃지가 씁니다.
 * RLS 가 내 조직 것으로 좁힙니다.
 */
export async function unreadChatByOrder(): Promise<Record<string, number>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('notifications')
    .select('payload')
    .eq('event_type', 'order.message')
    .is('read_at', null);

  if (error || !data) return {};
  return countUnreadChatByOrder((data as { payload: unknown }[]).map((row) => row.payload));
}

export interface UnreadChatOrder {
  orderId: string;
  orderNo: string;
  /** '이건희님'. 부를 이름이 없으면 null — 화면이 주문번호로 돌아갑니다 */
  patientCall: string | null;
  count: number;
}

/**
 * HOME 의 안 읽은 대화 띠에 실을 목록.
 *
 * ★ **환자 이름으로 부릅니다** (사용자 요청 2026-08-19).
 *   처음에는 주문번호만 실었습니다. 지나가는 눈에 밟히는 자리라 볼
 *   권한을 따질 필요가 없는 값만 두려던 것인데, 정작 `ORD-260819-004`
 *   는 **누구 이야기인지 알 수 없어** 눈이 그냥 지나갑니다.
 *   실명은 목록·주문상세에도 이미 나오고, 무엇을 내려보낼지는 RLS 가
 *   '내 조직 주문' 으로 이미 잘라 뒀습니다.
 *
 */
export async function listUnreadChatOrders(limit = 6): Promise<UnreadChatOrder[]> {
  const counts = await unreadChatByOrder();
  const ids = Object.keys(counts);
  if (ids.length === 0) return [];

  const supabase = await createClient();

  /*
    ★ 환자 표시값도 함께 읽습니다 (사용자 요청 2026-08-19 —
      "해당 환자명(님)으로 표기해 줘").
      실명 컬럼을 쓰는 것은 목록·주문상세와 같습니다 — 무엇을 내려보낼지는
      RLS 가 '내 조직 주문' 으로 이미 잘라 뒀습니다 (repositories/order 의
      patientLabelColumn 주석과 같은 판단).
  */
  const { data } = await supabase
    .from('orders')
    .select('id, order_no, patient_label')
    .in('id', ids)
    .is('deleted_at', null);

  const rows = ((data ?? []) as { id: string; order_no: string; patient_label: string | null }[])
    .map((order) => ({
      orderId: order.id,
      orderNo: order.order_no,
      patientCall: patientCall(order.patient_label),
      count: counts[order.id] ?? 0,
    }))
    // 쌓인 것부터 — 많이 밀린 주문이 앞에 옵니다
    .sort((a, b) => b.count - a.count || b.orderNo.localeCompare(a.orderNo));

  return rows.slice(0, limit);
}

/** 종에 붙일 숫자 */
export async function countUnreadNotifications(): Promise<number> {
  const supabase = await createClient();

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);

  return count ?? 0;
}
