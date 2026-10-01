// =========================================================
// 놓을 위치: src/app/api/jobs/auto-complete/route.ts
//
// 새벽 3시(KST)에 DB 시계(pg_cron)가 부릅니다 — 요청시한이 된 제작·배송 건을
// '완료' 로 넘깁니다 (사용자 요청 2026-10-01).
//
// ★ 열쇠: JOB_SECRET 이 서버에 있으면 x-denflow-job 헤더가 같아야 합니다.
// ★ 적히는 배송 시각은 '그날 한국 날짜' 로 맞춥니다 — 새벽에 돌아도 정산 달이
//   안 밀립니다 (domain/auto-complete 의 stampFor).
// =========================================================

import { runAutoComplete } from '@/server/repositories/auto-complete';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.JOB_SECRET;
  if (secret && request.headers.get('x-denflow-job') !== secret) {
    return new Response('forbidden', { status: 403 });
  }

  const result = await runAutoComplete();
  return Response.json(result, { headers: { 'cache-control': 'no-store' } });
}
