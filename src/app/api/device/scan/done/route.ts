// =========================================================
// 놓을 위치: src/app/api/device/scan/done/route.ts
//
// 다 올렸다는 신호. 저장소에 실제로 있는지 본 뒤에만 '올라옴' 으로 바꿉니다 (2026-10-02).
// =========================================================

import { deviceFromToken, finishScan } from '@/server/repositories/device-link';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  const device = await deviceFromToken(token);
  if (!device) return Response.json({ ok: false, error: '연결되지 않은 기기입니다' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { scanId?: string } | null;
  if (!body?.scanId) return Response.json({ ok: false, error: 'scanId 가 없습니다' }, { status: 400 });

  const result = await finishScan(device, body.scanId);
  return Response.json(result, { status: result.ok ? 200 : 400, headers: { 'cache-control': 'no-store' } });
}
