// =========================================================
// 놓을 위치: src/app/api/device/print/report/route.ts
//
// 치과 PC 가 "여기까지 됐습니다" 하고 알려 주는 곳 (2026-10-06).
//   { "jobId": "…", "step": "printing" | "done" | "failed",
//     "percent": 0~100, "reason": "…" }
//
// ★ step 없이 percent 만 보내면 숫자만 올립니다. 출력 중에 자주 옵니다.
// ★ 치과 PC 가 옮길 수 있는 자리는 셋뿐입니다 — 나머지는 거절합니다.
// ★ **실패를 삼키지 않습니다.** 까닭을 그대로 받아 주문 화면에 띄웁니다.
//   조용히 멈춘 자동화가 가장 위험합니다.
// =========================================================

import { deviceFromRequest } from '@/server/repositories/device-link';
import { reportPrintJob } from '@/server/repositories/auto-print';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await deviceFromRequest(request);
  if (!auth.ok) return auth.refusal;
  const device = auth.device;

  let body: {
    jobId?: unknown;
    step?: unknown;
    percent?: unknown;
    reason?: unknown;
    remaining?: unknown;
    layer?: unknown;
    layers?: unknown;
    paused?: unknown;
    resumed?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: 'JSON 이 아닙니다' }, { status: 400 });
  }

  if (typeof body.jobId !== 'string' || !body.jobId) {
    return Response.json({ ok: false, error: 'jobId 가 없습니다' }, { status: 400 });
  }

  const result = await reportPrintJob(device, body.jobId, body);

  return Response.json(result, {
    status: result.ok ? 200 : 400,
    headers: { 'cache-control': 'no-store' },
  });
}
