// =========================================================
// 놓을 위치: src/app/api/jobs/retention/route.ts
//
// 새벽 3시(KST)에 DB 시계(pg_cron)가 부르는 자동 파기.
// (사용자 결정 2026-09-07 — 의뢰 내역은 남기고 파일·기록만)
//
// ★ 열쇠는 아침 도착 안내와 같은 JOB_SECRET. 파기는 되돌릴 수 없으니
//   열쇠가 없으면 **안 돕니다** — 도착 안내와 달리 여기는 열쇠가 필수.
// =========================================================

import { runRetentionJob } from '@/server/repositories/retention-job';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.JOB_SECRET;
  if (!secret || request.headers.get('x-denflow-job') !== secret) {
    return new Response('forbidden', { status: 403 });
  }

  const result = await runRetentionJob();
  return Response.json(result, { headers: { 'cache-control': 'no-store' } });
}
