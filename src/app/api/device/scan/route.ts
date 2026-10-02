// =========================================================
// 놓을 위치: src/app/api/device/scan/route.ts
//
// 치과 PC 가 "스캔 하나 올리겠다" 고 알리면, 저장소 업로드 주소를 내줍니다 (2026-10-02).
//
// ★ 파일은 이 길로 안 지나갑니다 — 150MB 를 화면 서버로 보내면 막힙니다.
//   저장소가 내준 주소로 PC 가 바로 올립니다.
// ★ 열쇠는 Authorization: Bearer <기기 열쇠>.
// =========================================================

import { deviceFromToken, openScanSlot } from '@/server/repositories/device-link';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  const device = await deviceFromToken(token);
  if (!device) return Response.json({ ok: false, error: '연결되지 않은 기기입니다' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const result = await openScanSlot(device, body ?? {});

  return Response.json(
    result.ok
      ? { ok: true, already: result.already, ...result.slot, bucket: 'order-files' }
      : result,
    { status: result.ok ? 200 : 400, headers: { 'cache-control': 'no-store' } },
  );
}
