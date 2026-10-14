// =========================================================
// 놓을 위치: src/app/api/device/auto-print/match/route.ts
//
// "이 치식의 크라운, 어느 주문 것인가요" (2026-10-14).
//
// ★★ **마지막 사람 손을 없애는 자리입니다.** 덴트버드에서 받은 STL 을
//   사람이 창에서 골라 줘야 했습니다 — 다른 데는 다 자동인데 그 한 번
//   때문에 사람이 PC 앞을 못 떠납니다.
// ★ 애매하면 **안 고릅니다.** 같은 치식으로 기다리는 주문이 둘이면 멈추고
//   까닭을 돌려줍니다 — 반쯤 맞는 것으로 고르면 엉뚱한 이의 크라운이
//   치과에서 그대로 출력됩니다.
// =========================================================

import { deviceFromToken } from '@/server/repositories/device-link';
import { matchWaitingJob } from '@/server/repositories/auto-print';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  const device = await deviceFromToken(token);
  if (!device) return Response.json({ ok: false, error: '연결되지 않은 기기입니다' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { teeth?: unknown };
  const teeth = Array.isArray(body.teeth)
    ? body.teeth.filter((t): t is number => Number.isInteger(t))
    : [];

  const result = await matchWaitingJob(device.clinicOrgId, teeth);

  return Response.json(result, {
    status: result.ok ? 200 : 400,
    headers: { 'cache-control': 'no-store' },
  });
}
