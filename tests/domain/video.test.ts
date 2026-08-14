// =========================================================
// 놓을 위치: tests/domain/video.test.ts
//
// 배경 영상을 20초에서 되감는 규칙. (사용자 요청 2026-08-14)
//
// ★ 이걸 빼내 시험하는 이유는, 눈으로 보려면 **20초를 기다려야** 하고
//   브라우저 창이 숨어 있으면 아예 재생이 안 되기 때문입니다.
//   판단만이라도 여기서 확인해 둡니다.
// =========================================================

import { describe, it, expect } from 'vitest';
import { shouldRewind } from '@/server/domain/video';

describe('배경 영상 되감기', () => {
  it('끊을 지점을 지나면 되감습니다', () => {
    expect(shouldRewind(20, 20)).toBe(true);
    expect(shouldRewind(20.4, 20)).toBe(true);
    expect(shouldRewind(19.9, 20)).toBe(false);
    expect(shouldRewind(0, 20)).toBe(false);
  });

  it('끊을 지점이 없으면 안 되감습니다 — 영상 길이대로 갑니다', () => {
    expect(shouldRewind(120, undefined)).toBe(false);
    expect(shouldRewind(120, 0)).toBe(false);
  });

  it('★ 재생기가 아직 준비되지 않았을 때가 진짜 문제입니다', () => {
    // getCurrentTime() 이 이런 것들을 줍니다. 그대로 비교하면
    // 조용히 안 되감기거나, 반대로 매번 되감습니다
    expect(shouldRewind(NaN, 20)).toBe(false);
    expect(shouldRewind(undefined, 20)).toBe(false);
    expect(shouldRewind(null, 20)).toBe(false);
    expect(shouldRewind(Infinity, 20)).toBe(false);
    expect(shouldRewind('20', 20)).toBe(false);
    expect(shouldRewind(-1, 20)).toBe(false);
  });
});
