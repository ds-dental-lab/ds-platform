// =========================================================
// 놓을 위치: src/app/api/jobs/alimtalk/route.ts
//
// 1분마다 DB 시계(pg_cron)가 불러 알림톡 대기열을 비웁니다. (2026-09-08)
// ★ 열쇠 JOB_SECRET 필수 — 남이 불러 대기열을 흔들면 안 됩니다.
// =========================================================

import { runAlimtalkQueue } from '@/server/repositories/alimtalk-run';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.JOB_SECRET;
  if (!secret || request.headers.get('x-denflow-job') !== secret) {
    return new Response('forbidden', { status: 403 });
  }

  const result = await runAlimtalkQueue();
  return Response.json(result, { headers: { 'cache-control': 'no-store' } });
}
