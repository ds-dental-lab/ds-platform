// =========================================================
// 놓을 위치: src/server/repositories/pickup.ts
//
// 수거요청 읽기. (설계서 §4.6 pickup_requests)
// RLS 가 요청한 치과 · 처리할 기공소 · 거래 디자인센터만 통과시킵니다.
//
// 표시용 라벨은 lib/format/pickup 에 있습니다 —
// 클라이언트 컴포넌트가 그 값을 쓰기 때문입니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { PickupRequestRow } from '@/lib/format/pickup';

export type { PickupRequestRow };

/** 이 주문에 딸린 수거요청 */
export async function listPickupsForOrder(orderId: string): Promise<PickupRequestRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('pickup_requests')
    .select('id, kind, status, memo, created_at, order_id')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as PickupRequestRow[];
}

/** 기공소 HOME 의 '수거대기' 카운트 (설계서 §4.6) */
export async function countOpenPickups(): Promise<number> {
  const supabase = await createClient();

  const { count } = await supabase
    .from('pickup_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open');

  return count ?? 0;
}
