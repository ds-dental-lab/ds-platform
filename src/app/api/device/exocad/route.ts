// =========================================================
// 놓을 위치: src/app/api/device/exocad/route.ts
//
// 설계 PC 가 "exocad 로 열 것 있나요" 하고 물어보는 곳 (2026-10-14).
//
// ★★ **왜 생겼나 — 브라우저를 고리에서 뺍니다.** 지금까지는 단추를 누르면
//   브라우저가 `denflow://` 를 쏘아 런처를 띄웠습니다. 그런데 브라우저가
//   안 쏘면 **창도 오류도 없이** 멈춥니다. 레지스트리도 런처도 멀쩡한데
//   화면엔 '여는 중' 만 남습니다 (2026-10-13~14, 일곱 건). 그쪽은 우리가
//   고칠 수 있는 자리가 아닙니다.
// ★ 자동 출력(/api/device/print)과 같은 모양입니다 — 밖에서 안으로 들어오는
//   연결이 없고, 열쇠는 기기 열쇠 하나입니다.
// =========================================================

import { deviceFromToken } from '@/server/repositories/device-link';
import { claimExocadJob } from '@/server/repositories/exocad';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  const device = await deviceFromToken(token);
  if (!device) return Response.json({ ok: false, error: '연결되지 않은 기기입니다' }, { status: 401 });

  const result = await claimExocadJob(device.clinicOrgId);

  return Response.json(result, {
    status: result.ok ? 200 : 400,
    headers: { 'cache-control': 'no-store' },
  });
}
