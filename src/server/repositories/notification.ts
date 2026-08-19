// =========================================================
// 놓을 위치: src/server/repositories/notification.ts
//
// 인앱 알림 읽기. RLS 가 내 조직 것만 돌려줍니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { countUnreadChatByOrder } from '@/server/domain/notification';

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
  count: number;
}

/**
 * HOME 의 안 읽은 대화 띠에 실을 목록.
 *
 * ★ 주문번호만 싣습니다. 환자 이름은 안 싣습니다 — 띠는 화면 제일
 *   위라 지나가는 눈에도 밟히는 자리입니다. 누른 다음(상세)에 보면
 *   됩니다.
 */
export async function listUnreadChatOrders(limit = 6): Promise<UnreadChatOrder[]> {
  const counts = await unreadChatByOrder();
  const ids = Object.keys(counts);
  if (ids.length === 0) return [];

  const supabase = await createClient();

  const { data } = await supabase
    .from('orders')
    .select('id, order_no')
    .in('id', ids)
    .is('deleted_at', null);

  const rows = ((data ?? []) as { id: string; order_no: string }[])
    .map((order) => ({
      orderId: order.id,
      orderNo: order.order_no,
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
