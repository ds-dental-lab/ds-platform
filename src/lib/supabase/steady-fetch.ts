// =========================================================
// 놓을 위치: src/lib/supabase/steady-fetch.ts
//
// 서버 쪽 Supabase 연결이 쓰는 fetch. 규칙은 domain/db-retry 에 있습니다.
//
// ★ 읽기가 순간 실패하면 한 번 더 묻고, 그래도 안 되면 `[db]` 로 남깁니다.
// ★ 답 자체는 **건드리지 않습니다** — 부른 쪽이 받는 것은 전과 같습니다.
//   여기서 던지거나 바꾸면 수백 곳의 조회가 한꺼번에 달라집니다.
// =========================================================

import { RETRY_DELAY_MS, reportLine, shouldReport, shouldRetry, type FetchOutcome } from '@/server/domain/db-retry';

type FetchArgs = Parameters<typeof fetch>;

function describe(input: FetchArgs[0], init: FetchArgs[1]): { method: string | undefined; pathname: string } {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : undefined);

  try {
    return { method, pathname: new URL(url).pathname };
  } catch {
    return { method, pathname: '?' };
  }
}

async function attempt(input: FetchArgs[0], init: FetchArgs[1]): Promise<{ response?: Response; thrown?: unknown; outcome: FetchOutcome }> {
  try {
    const response = await fetch(input, init);
    return { response, outcome: { status: response.status } };
  } catch (thrown) {
    return { thrown, outcome: {} };
  }
}

export async function steadyFetch(input: FetchArgs[0], init?: FetchArgs[1]): Promise<Response> {
  const { method, pathname } = describe(input, init);

  let result = await attempt(input, init);
  let retried = false;

  if (shouldRetry(method, result.outcome)) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    result = await attempt(input, init);
    retried = true;
  }

  if (shouldReport(pathname, result.outcome)) {
    console.error(reportLine(method, pathname, result.outcome, retried));
  }

  if (result.response) return result.response;
  throw result.thrown;
}
