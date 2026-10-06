// =========================================================
// 놓을 위치: src/app/api/device/print/route.ts
//
// 치과 PC 가 "출력할 것 있나요" 하고 물어보는 곳 (2026-10-06).
//
// ★ **치과 쪽으로 들어오는 연결이 없습니다.** 치과 PC 가 밖으로 물어봅니다.
//   그래서 포트포워딩도, 고정 IP 도, 방화벽 구멍도 필요 없습니다.
// ★ 열쇠는 스캔 올릴 때와 같은 기기 열쇠입니다 — Authorization: Bearer.
// ★ 출력 파일은 이 길로 안 지나갑니다. 저장소 서명 주소를 내주고
//   치과 PC 가 바로 내려받습니다.
// =========================================================

import { deviceFromToken } from '@/server/repositories/device-link';
import { claimPrintJob } from '@/server/repositories/auto-print';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  const device = await deviceFromToken(token);
  if (!device) return Response.json({ ok: false, error: '연결되지 않은 기기입니다' }, { status: 401 });

  const result = await claimPrintJob(device);

  return Response.json(result, {
    status: result.ok ? 200 : 400,
    headers: { 'cache-control': 'no-store' },
  });
}
