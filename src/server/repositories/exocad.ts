// =========================================================
// 놓을 위치: src/server/repositories/exocad.ts
//
// exocad 로 보낸 기록 읽기. (2026-09-09)
// ★ RLS 가 센터만 줍니다 — 치과·기공소 화면에서 불러도 null 입니다.
// =========================================================

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ExocadLastResult } from '@/components/order/ExocadSendButton';

export async function getLastExocadExport(orderId: string): Promise<ExocadLastResult | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('exocad_exports')
    .select('requested_at, fetched_at, status, message')
    .eq('order_id', orderId)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const row = data as { requested_at: string; fetched_at: string | null; status: 'done' | 'failed' | null; message: string | null };
  return {
    requestedAt: row.requested_at,
    fetchedAt: row.fetched_at,
    status: row.status,
    message: row.message,
  };
}
