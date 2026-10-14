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

/**
 * 설계 PC 가 "열 것 있나요" 하고 물어보면 한 건을 줍니다 (2026-10-14).
 *
 * ★★ **디자인센터 기기만** 입니다. exocad 를 여는 일은 센터의 일이고,
 *   치과 기기가 이 길로 들어오면 남의 주문을 열게 됩니다.
 * ★ 토큰은 그 자리에서 새로 만듭니다 — 눌러 둔 줄에는 토큰이 없습니다.
 *   10분짜리라 미리 만들어 둘 수 있는 것이 아닙니다.
 * ★ **여기서 '가져갔다' 를 안 찍습니다.** 런처가 주문 정보를 받아 갈 때
 *   서버가 찍습니다 — 받아 간 것이 진짜 가져간 것입니다. 여기서 먼저
 *   찍으면 런처가 뜨다 말았을 때 그 건이 영영 안 열립니다.
 */
export async function claimExocadJob(
  orgId: string,
): Promise<{ ok: true; job: { orderId: string; token: string } | null } | { ok: false; error: string }> {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const { nextExport, EXOCAD_CLAIM_MINUTES } = await import('@/server/domain/exocad');
  const { issueExocadToken } = await import('@/server/exocad/token');

  const admin = createAdminClient();

  const { data: org } = await admin
    .from('organizations')
    .select('org_type')
    .eq('id', orgId)
    .maybeSingle();
  if ((org as { org_type?: string } | null)?.org_type !== 'design_center') {
    return { ok: false, error: '설계 PC 만 물어볼 수 있습니다' };
  }

  const since = new Date(Date.now() - EXOCAD_CLAIM_MINUTES * 60_000).toISOString();
  const { data, error } = await admin
    .from('exocad_exports')
    .select('order_id, requested_at, fetched_at')
    .gte('requested_at', since)
    .is('fetched_at', null)
    .order('requested_at')
    .limit(20);

  if (error) return { ok: false, error: error.message };

  const rows = ((data ?? []) as { order_id: string; requested_at: string; fetched_at: string | null }[]).map(
    (r) => ({ orderId: r.order_id, requestedAt: r.requested_at, fetchedAt: r.fetched_at }),
  );

  const pick = nextExport(rows);
  if (!pick) return { ok: true, job: null };

  const token = issueExocadToken(pick.orderId);
  if (!token) return { ok: false, error: '서버에 열쇠가 없어 토큰을 못 만듭니다' };

  return { ok: true, job: { orderId: pick.orderId, token } };
}
