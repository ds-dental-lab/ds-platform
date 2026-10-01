// =========================================================
// 놓을 위치: src/app/api/jobs/auto-complete/route.ts
//
// 아침 9시(KST)에 DB 시계(pg_cron)가 부릅니다 — 요청시한이 된 제작·배송 건을
// '완료' 로 넘깁니다 (사용자 요청 2026-10-01).
//
// ★ 열쇠: JOB_SECRET 이 서버에 있으면 x-denflow-job 헤더가 같아야 합니다.
// ★ 9시인 이유는 domain/auto-complete 에 적어 뒀습니다 (UTC 날짜가 한국 날짜와 같은 시각).
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
