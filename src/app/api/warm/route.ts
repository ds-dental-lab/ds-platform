// =========================================================
// 놓을 위치: src/app/api/warm/route.ts
//
// 서버를 깨워 두는 곳. (사용자 지적 2026-09-06 — "전체적으로 반응속도가 느려")
//
// ★ 느림의 정체는 코드가 아니라 **콜드 스타트** 였습니다.
//   7분 쉬었다가 첫 화면을 열면 3.7초, 이어지는 탭은 0.3초. Vercel 이
//   아무도 안 쓰는 동안 프로세스를 내리고, 다음 사람이 오면 19MB 함수를
//   새로 띄웁니다. 그래서 DB 시계(pg_cron)가 몇 분마다 이 주소를 부릅니다.
//
// ★★ **자료를 한 줄 읽어 보고 답합니다** (2026-11-12).
//   전에는 아무것도 안 읽고 "ok" 만 답했습니다. 2026-11-12 새벽 Supabase 의
//   API 서버가 죽어 모두가 자료를 못 읽는 10시간 동안 이 핑은 내내 "ok" 였습니다 —
//   감시가 아니었습니다. 이제 못 읽으면 503 `db-fail:코드` 로 답하고,
//   DB 의 지켜보기(api_watch_tick)가 그 글자를 보고 알립니다.
// ★ 읽는 것은 **공개 열쇠로 조직 표 한 줄**입니다. 로그인 없이는 0줄이 오지만
//   (RLS) 오류 없이 답이 오면 API 서버가 살아 있다는 뜻입니다. 새어 나갈 것이 없습니다.
// =========================================================

import { createPublicClient } from '@/lib/supabase/public';
import { warmAnswer } from '@/server/domain/api-watch';

export const dynamic = 'force-dynamic';

export async function GET() {
  let error: { code?: string; message?: string } | null = null;

  try {
    const result = await createPublicClient()
      .from('organizations')
      .select('id')
      .limit(1)
      .abortSignal(AbortSignal.timeout(5000));
    error = result.error;
  } catch (e) {
    error = { message: e instanceof Error ? e.name : 'network' };
  }

  const answer = warmAnswer(error);
  return new Response(answer.body, {
    status: answer.status,
    headers: { 'cache-control': 'no-store' },
  });
}
