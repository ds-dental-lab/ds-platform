// =========================================================
// 놓을 위치: src/app/api/device/link/route.ts
//
// 치과 PC 프로그램이 여섯 자리 코드를 내밀고 기기 열쇠를 받아 갑니다 (2026-10-02).
// ★ 로그인 없이 부르는 길입니다. 코드가 전부이고, 10분·한 번으로 묶여 있습니다.
// =========================================================

import { isLinkCode } from '@/server/domain/device-link';
import { linkDevice } from '@/server/repositories/device-link';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { code?: string; deviceName?: string } | null;
  const code = (body?.code ?? '').trim();

  if (!isLinkCode(code)) {
    return Response.json({ ok: false, error: '여섯 자리 코드를 넣어 주세요' }, { status: 400 });
  }

  const result = await linkDevice(code, body?.deviceName ?? '스캐너 PC');
  return Response.json(result, { status: result.ok ? 200 : 400, headers: { 'cache-control': 'no-store' } });
}
