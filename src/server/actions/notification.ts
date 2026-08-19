// =========================================================
// 놓을 위치: src/server/actions/notification.ts
//
// 알림 읽음 처리. 누가 무엇을 읽을 수 있는지는 RLS 가 정합니다.
// =========================================================

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function markNotificationRead(notificationId: string): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('read_at', null);

  revalidatePath('/', 'layout');
}

/**
 * 주문상세를 열면 그 주문의 대화 알림을 읽음으로. (2026-08-19)
 *
 * ★ 화면을 봤으면 읽은 것입니다.
 *   대화 뱃지(💬)와 HOME 띠가 이 값으로 꺼집니다. 종을 눌러야만
 *   꺼지면, 상세에서 대화를 다 읽고 나서도 뱃지가 남아 거짓말을 합니다.
 *
 * ★ 대화 알림만 지웁니다. 상태 변경 알림은 그대로 둡니다 —
 *   상세를 열었다고 종의 다른 소식까지 읽은 것은 아닙니다.
 */
export async function markOrderChatRead(orderId: string): Promise<void> {
  if (!orderId) return;

  const supabase = await createClient();

  const { data } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('event_type', 'order.message')
    .contains('payload', { orderId })
    .is('read_at', null)
    .select('id');

  // 바뀐 것이 없으면 화면도 다시 그릴 필요가 없습니다
  if (data && data.length > 0) revalidatePath('/', 'layout');
}

/** 전부 읽음. 목록이 길어졌을 때 한 번에 비웁니다 */
export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);

  revalidatePath('/', 'layout');
}
