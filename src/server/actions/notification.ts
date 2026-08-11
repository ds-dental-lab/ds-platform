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

/** 전부 읽음. 목록이 길어졌을 때 한 번에 비웁니다 */
export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);

  revalidatePath('/', 'layout');
}
