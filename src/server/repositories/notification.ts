// =========================================================
// 놓을 위치: src/server/repositories/notification.ts
//
// 인앱 알림 읽기. RLS 가 내 조직 것만 돌려줍니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';

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

/** 종에 붙일 숫자 */
export async function countUnreadNotifications(): Promise<number> {
  const supabase = await createClient();

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);

  return count ?? 0;
}
