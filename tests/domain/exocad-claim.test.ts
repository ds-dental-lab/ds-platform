// =========================================================
// 놓을 위치: tests/domain/exocad-claim.test.ts
//
// 에이전트가 어떤 줄을 집어 가는가 (2026-10-14).
//
// ★★ 이 규칙이 느슨하면 **사람이 안 시킨 케이스가 열립니다.** 에이전트가
//   꺼져 있던 동안 쌓인 줄을 켜자마자 다 열어 버리는 자리입니다.
// =========================================================

import { describe, it, expect } from 'vitest';
import { nextExport, EXOCAD_CLAIM_MINUTES, type PendingExport } from '@/server/domain/exocad';

const NOW = new Date('2026-10-14T10:00:00.000Z');

function ago(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

const row = (over: Partial<PendingExport> = {}): PendingExport => ({
  orderId: 'o1',
  requestedAt: ago(1),
  fetchedAt: null,
  ...over,
});

describe('에이전트가 집어 갈 줄', () => {
  it('방금 누른 것을 집습니다', () => {
    expect(nextExport([row()], NOW)?.orderId).toBe('o1');
  });

  it('없으면 null', () => {
    expect(nextExport([], NOW)).toBeNull();
  });

  // ★ 런처가 주문 정보를 받아 가면 그 자리가 찍힙니다
  it('이미 가져간 것은 다시 안 줍니다', () => {
    expect(nextExport([row({ fetchedAt: ago(0) })], NOW)).toBeNull();
  });

  // ★★ 이것이 이 규칙의 전부입니다
  it('★★ 10분이 지난 줄은 안 집습니다 — 안 시킨 케이스가 열립니다', () => {
    expect(nextExport([row({ requestedAt: ago(EXOCAD_CLAIM_MINUTES + 1) })], NOW)).toBeNull();
    expect(nextExport([row({ requestedAt: ago(EXOCAD_CLAIM_MINUTES - 1) })], NOW)).not.toBeNull();
  });

  it('누른 차례대로 — 오래된 것부터', () => {
    const rows = [
      row({ orderId: '나중', requestedAt: ago(2) }),
      row({ orderId: '먼저', requestedAt: ago(5) }),
    ];
    expect(nextExport(rows, NOW)?.orderId).toBe('먼저');
  });
});
