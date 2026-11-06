// =========================================================
// 놓을 위치: src/app/api/device/learn/route.ts
//
// 디자인PC 밤 실행이 "배울 덴플로우 주문 있나요" 하고 묻는 곳 (2026-11-06).
//
// ★ 열쇠는 설계 PC 기기 열쇠(design_agent.json)입니다. 디자인센터 기기만 답을 받습니다.
// ★ 하루에 한 번, 밤 실행을 시작할 때만 부릅니다 — 버셀 호출이 늘지 않습니다.
// ★ 본문(선택): { "hours": 48 } — 이만큼 지난 주문까지.
// =========================================================
import { deviceFromToken } from '@/server/repositories/device-link';
import { listLearnCases } from '@/server/repositories/learn-cases';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  const device = await deviceFromToken(token);
  if (!device) return Response.json({ ok: false, error: '연결되지 않은 기기입니다' }, { status: 401 });

  let hours: number | undefined;
  try {
    const body = (await request.json()) as { hours?: unknown };
    if (typeof body?.hours === 'number' && Number.isFinite(body.hours)) hours = body.hours;
  } catch {
    // 본문 없음 — 기본값
  }
  const result = await listLearnCases(device.clinicOrgId, hours);
  return Response.json(result, {
    status: result.ok ? 200 : 403,
    headers: { 'cache-control': 'no-store' },
  });
}
