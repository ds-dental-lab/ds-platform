// =========================================================
// 놓을 위치: src/server/domain/db-retry/index.ts
//
// 서버가 Supabase 를 부를 때, 답이 안 좋으면 **다시 물을지 · 남길지**를 정합니다.
// (2026-11-18, 사용자 "앞으로 홈페이지 연결문제는 없었으면 한다")
//
// ★★ 왜 한곳에 두는가.
//   조회 실패를 "없음" 으로 바꿔 넘기는 자리가 저장소에 수백 곳 있습니다 —
//   `if (error || !data) return []`. 그중 하나(제작옵션 목록)가 순간 실패하자
//   옵션 없는 주문이 9건 들어갔고 아무 기록도 없었습니다. 자리마다 고치는 것으로는
//   끝이 안 나므로, **모든 조회가 지나는 길목**에서 두 가지를 합니다.
//
//     1) 읽기가 순간 실패하면 한 번 더 묻습니다 — 대부분 1초 안에 돌아옵니다
//        (10-28 의 1초짜리 거절, 재시작·배포 순간의 503)
//     2) 그래도 안 되면 **남깁니다** — 버셀 로그에서 `[db]` 로 찾습니다
//
// ★ 다시 묻는 것은 **읽기(GET·HEAD)뿐**입니다. 쓰기를 다시 보내면 두 번 들어갑니다.
// ★ 다시 묻는 것은 **잠깐 못 닿은 경우**(연결 실패 · 502 · 503 · 504)뿐입니다.
//   권한 거절이나 잘못된 조회는 다시 물어도 같은 답입니다.
// ★ 남길 때는 **경로만** 남깁니다. 물음표 뒤(조건)에는 환자·치과가 들어갈 수 있습니다.
// =========================================================

/** 한 번의 시도가 어떻게 끝났나. status 가 없으면 서버에 닿지도 못한 것 */
export interface FetchOutcome {
  status?: number;
}

const TRANSIENT = new Set([502, 503, 504]);

/** 다시 묻기 전에 쉬는 시간 */
export const RETRY_DELAY_MS = 400;

function isRead(method: string | undefined): boolean {
  const m = (method ?? 'GET').toUpperCase();
  return m === 'GET' || m === 'HEAD';
}

/** 한 번 더 물을 것인가 */
export function shouldRetry(method: string | undefined, outcome: FetchOutcome): boolean {
  if (!isRead(method)) return false;
  return outcome.status === undefined || TRANSIENT.has(outcome.status);
}

/**
 * 남길 것인가.
 *
 * ★ 못 닿았거나 서버 쪽 고장(5xx)은 어디든 남깁니다.
 * ★ 자료 쪽(/rest/)의 401·403 도 남깁니다 — 문지기에 막힌 쓰기가 조용히 지나가던 자리입니다.
 * ★ 로그인 쪽(/auth/)의 4xx 는 안 남깁니다. 비밀번호를 틀릴 때마다 쌓입니다.
 * ★ 404·406·409 는 평소에도 나옵니다 (없는 줄 · 한 줄 요청에 0줄 · 겹침).
 */
export function shouldReport(pathname: string, outcome: FetchOutcome): boolean {
  if (outcome.status === undefined) return true;
  if (outcome.status >= 500) return true;
  if (pathname.startsWith('/rest/') && (outcome.status === 401 || outcome.status === 403)) return true;
  return false;
}

/** 로그 한 줄. 경로까지만 — 조건은 뺍니다 */
export function reportLine(method: string | undefined, pathname: string, outcome: FetchOutcome, retried: boolean): string {
  const result = outcome.status === undefined ? '닿지 못함' : String(outcome.status);
  return `[db] ${(method ?? 'GET').toUpperCase()} ${pathname} → ${result}${retried ? ' (한 번 더 물은 뒤)' : ''}`;
}
