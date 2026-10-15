// =========================================================
// 놓을 위치: src/app/api/device/auto-print/stage/route.ts
//
// "이 주문, 지금 설계 어디까지 왔습니다" — 설계 PC 의 매크로가 부릅니다 (2026-10-15).
//
// ★★ 치과가 설계 중인지 아닌지 몰랐습니다 ("새로고침을 해야 보이고").
//   STL 이 올라오기 전까지 서버에 아무 기록이 없었기 때문입니다.
//   이제 매크로가 단계를 넘을 때마다 여기에 적고, 표가 바뀌면 표가 주문
//   화면에 신호를 쏩니다(auto_jobs_signal) — 새로고침 없이 칸이 넘어갑니다.
// ★ 설계 PC(디자인센터 기기)만. 디자인 차례인 주문에만 적힙니다.
// ★ 멈춘 까닭(note)은 센터 화면에만 뜹니다. 설계 프로그램 이름이 들어
//   있어도 치과에는 안 갑니다.
// =========================================================

import { deviceFromToken } from '@/server/repositories/device-link';
import { setDesignStage } from '@/server/repositories/auto-print';
import { isDesignStage } from '@/server/domain/auto-print';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  const device = await deviceFromToken(token);
  if (!device) return Response.json({ ok: false, error: '연결되지 않은 기기입니다' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    orderId?: unknown;
    stage?: unknown;
    note?: unknown;
  };

  if (typeof body.orderId !== 'string' || !UUID_RE.test(body.orderId)) {
    return Response.json({ ok: false, error: '주문 id 가 없습니다' }, { status: 400 });
  }
  if (!isDesignStage(body.stage)) {
    return Response.json({ ok: false, error: '모르는 단계입니다' }, { status: 400 });
  }
  const note = typeof body.note === 'string' ? body.note : null;

  const result = await setDesignStage(device.clinicOrgId, body.orderId, body.stage, note);

  return Response.json(result, {
    status: result.ok ? 200 : 400,
    headers: { 'cache-control': 'no-store' },
  });
}
