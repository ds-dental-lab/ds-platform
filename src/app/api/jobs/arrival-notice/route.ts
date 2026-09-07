// =========================================================
// 놓을 위치: src/app/api/jobs/arrival-notice/route.ts
//
// 아침 8시(KST)에 DB 시계(pg_cron)가 부릅니다 — "오늘 도착 예정" 안내를
// 치과마다 한 통씩 알림톡 대기열에 쌓습니다. (사용자 요청 2026-09-07)
//
// ★ 열쇠: JOB_SECRET 이 Vercel 에 있으면 x-denflow-job 헤더가 같아야
//   합니다. 없으면 검사를 안 합니다 — 이 일은 하루 한 번으로 묶여
//   있어(repositories/arrival-notice) 남이 불러도 두 통이 되지 않지만,
//   열쇠를 넣어 두는 것이 맞습니다 (migration 20260907120000 의 값).
// ★ 여기서 실제 발송은 안 합니다. 대기열에 쌓기만 — 발송은 카카오
//   채널·대행사가 붙은 뒤 한 곳에서 합니다.
// =========================================================

import { runArrivalNotices } from '@/server/repositories/arrival-notice';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.JOB_SECRET;
  if (secret && request.headers.get('x-denflow-job') !== secret) {
    return new Response('forbidden', { status: 403 });
  }

  const result = await runArrivalNotices();
  return Response.json(result, { headers: { 'cache-control': 'no-store' } });
}
