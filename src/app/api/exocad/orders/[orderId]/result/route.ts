// =========================================================
// 놓을 위치: src/app/api/exocad/orders/[orderId]/result/route.ts
//
// 런처가 끝나며 한 번 알려 주는 곳. (2026-09-09)
//   { "status": "done" | "failed", "message": "…" }
//
// ★ 없어도 돌아갑니다. 있으면 주문 상세에 "exocad 로 보냄 · 완료/실패" 가
//   남아 사람이 런처 문제를 알아챕니다.
// ★ 같은 토큰으로 옵니다 — 정보 받고 10분 안이면 됩니다. dxd 변환이
//   그보다 길면 결과만 못 적을 뿐 폴더는 이미 만들어져 있습니다.
// =========================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { verifyExocadToken } from '@/server/exocad/token';
import { isExocadResultStatus } from '@/server/domain/exocad';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const token = new URL(request.url).searchParams.get('t');
  const check = verifyExocadToken(orderId, token);
  if (!check.ok) return Response.json({ error: check.reason }, { status: 401 });

  let body: { status?: unknown; message?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: 'JSON 이 아닙니다' }, { status: 400 });
  }
  if (!isExocadResultStatus(body.status)) {
    return Response.json({ error: 'status 는 done 또는 failed' }, { status: 400 });
  }
  const message = typeof body.message === 'string' ? body.message.slice(0, 500) : null;

  const admin = createAdminClient();
  // 가장 최근 요청 줄에 적습니다
  const { data: latest } = await admin
    .from('exocad_exports')
    .select('id')
    .eq('order_id', orderId)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return Response.json({ error: '보낸 기록이 없습니다' }, { status: 404 });

  const { error } = await admin
    .from('exocad_exports')
    .update({ status: body.status, message, finished_at: new Date().toISOString() })
    .eq('id', (latest as { id: string }).id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
