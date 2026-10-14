// =========================================================
// 놓을 위치: tests/domain/auto-print-match.test.ts
//
// 폴더에 떨어진 크라운이 어느 주문 것인가 (2026-10-14).
//
// ★★ 이 규칙이 느슨하면 **엉뚱한 이의 크라운이 치과에서 그대로
//   출력됩니다.** 애매하면 고르지 않는 쪽이 맞습니다.
// =========================================================

import { describe, it, expect } from 'vitest';
import { matchWaiting, type WaitingJob } from '@/server/domain/auto-print';

const job = (orderId: string, teeth: number[]): WaitingJob => ({ orderId, teeth });

describe('기다리는 주문 고르기', () => {
  it('치식이 꼭 맞는 하나를 고릅니다', () => {
    const got = matchWaiting([job('a', [26]), job('b', [36])], [26]);
    expect(got).toEqual({ ok: true, orderId: 'a' });
  });

  it('차례가 달라도 같은 치식입니다', () => {
    expect(matchWaiting([job('a', [26, 24, 25])], [25, 26, 24])).toEqual({
      ok: true,
      orderId: 'a',
    });
  });

  // ★★ 이 둘이 이 규칙의 전부입니다
  it('★★ 둘이면 안 고릅니다 — 엉뚱한 이가 출력됩니다', () => {
    const got = matchWaiting([job('a', [26]), job('b', [26])], [26]);
    expect(got.ok).toBe(false);
    expect(got.ok === false && got.why).toContain('2건');
  });

  it('★★ 치식을 못 읽었으면 안 고릅니다 — 근거 없이 집는 셈입니다', () => {
    const got = matchWaiting([job('a', [26])], []);
    expect(got.ok).toBe(false);
    expect(got.ok === false && got.why).toContain('못 읽었습니다');
  });

  it('없으면 까닭을 적어 돌려줍니다', () => {
    const got = matchWaiting([job('a', [26])], [36]);
    expect(got.ok).toBe(false);
    expect(got.ok === false && got.why).toContain('36');
  });

  // ★ 부분은 사람이 고릅니다 — 자동으로 잡으면 나머지가 영영 안 나옵니다
  it('주문의 이를 다 덮지 못하면 안 고릅니다', () => {
    expect(matchWaiting([job('a', [26, 27])], [26]).ok).toBe(false);
  });

  it('주문에 없는 이가 섞여 있어도 안 고릅니다', () => {
    expect(matchWaiting([job('a', [26])], [26, 27]).ok).toBe(false);
  });

  it('기다리는 것이 없으면 null 이 아니라 까닭', () => {
    expect(matchWaiting([], [26]).ok).toBe(false);
  });
});
