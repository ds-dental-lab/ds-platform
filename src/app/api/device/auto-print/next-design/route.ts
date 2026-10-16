// =========================================================
// 놓을 위치: src/app/api/device/auto-print/next-design/route.ts
//
// 설계 PC 일꾼이 "디자인할 FlowTemp 있나요" 하고 묻는 곳 (2026-10-15).
//
// ★ 있으면 **그 자리에서 잡아 줍니다**(design_stage='uploading'). 두 번 묻는
//   사이 다른 일꾼이 같은 것을 받지 않습니다.
// ★ 스캔 파일은 저장소 서명 주소로 — 우리 서버를 안 지나갑니다.
// ★ 디자인센터 기기만. 일감이 없으면 { ok: true, job: null }.
// =========================================================

import { deviceFromToken } from '@/server/repositories/device-link';
import { claimNextDesign } from '@/server/repositories/auto-print';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  const device = await deviceFromToken(token);
  if (!device) return Response.json({ ok: false, error: '연결되지 않은 기기입니다' }, { status: 401 });

  // ★ { peek: true } 면 잡지 않고 있는지만 (2026-10-16)
  const body = (await request.json().catch(() => ({}))) as { peek?: unknown };
  const result = await claimNextDesign(device.clinicOrgId, body.peek === true);
  return Response.json(result, {
    status: result.ok ? 200 : 400,
    headers: { 'cache-control': 'no-store' },
  });
}
