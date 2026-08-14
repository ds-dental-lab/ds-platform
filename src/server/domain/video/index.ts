// =========================================================
// 놓을 위치: src/server/domain/video/index.ts
//
// 배경 영상을 어디서 되감을 것인가. (사용자 요청 2026-08-14 —
// "20초까지만 끊어주고 반복재생해줘")
//
// ★ 규칙만 여기 둡니다. 재생기를 부르는 일은 화면 쪽(YouTubeAmbient)
//   입니다. 이 판단이 화면 코드 안에 섞여 있으면 아무도 확인 못 합니다 —
//   되감기는 **눈으로 보려면 20초를 기다려야** 하는 종류라 더 그렇습니다.
// =========================================================

/**
 * 지금 처음으로 돌아가야 하는가.
 *
 * ★ 재생기가 아직 준비되지 않으면 `getCurrentTime()` 이 NaN 이나
 *   undefined 를 줍니다. 그걸 그대로 비교하면 false 가 나와 조용히
 *   안 되감기거나, 반대로 0 을 줘서 계속 되감깁니다. 여기서 걸러 냅니다.
 *
 * ★ 끊을 지점이 없으면 안 되감습니다 — 영상 길이대로 갑니다.
 */
export function shouldRewind(current: unknown, stopAt: number | undefined): boolean {
  if (!stopAt || stopAt <= 0) return false;
  if (typeof current !== 'number' || !Number.isFinite(current)) return false;
  if (current < 0) return false;

  return current >= stopAt;
}
