// =========================================================
// 놓을 위치: tests/domain/signal.test.ts
// 기준: 사용자 요청 2026-08-19 — "대화창이 새로고침없이 카톡처럼
//       실시간으로". 로켓챗 이중화 대신 신호 방식.
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  orderTopic,
  orderIdFromTopic,
  refreshDelay,
  SIGNAL_COOLDOWN_MS,
} from '@/server/domain/signal';

const ID = '0b7f2a44-9c1d-4e2a-8f00-3d5b6c7a8e90';

describe('채널 이름', () => {
  it('주문 id 로 만듭니다', () => {
    expect(orderTopic(ID)).toBe(`order:${ID}`);
  });

  it('만든 것을 도로 꺼낼 수 있습니다', () => {
    expect(orderIdFromTopic(orderTopic(ID))).toBe(ID);
  });

  /**
   * ★ DB 정책(20260819120000)과 같은 검사여야 합니다.
   *   화면이 더 느슨하면 "구독은 했는데 DB 가 거절" 하는 어긋남이 생기고,
   *   더 빡빡하면 멀쩡한 채널을 화면이 못 씁니다.
   */
  it('★ 모양이 아니면 null — DB 정책과 같은 잣대', () => {
    expect(orderIdFromTopic('order:abc')).toBeNull();
    expect(orderIdFromTopic('order:')).toBeNull();
    expect(orderIdFromTopic(`orders:${ID}`)).toBeNull();
    expect(orderIdFromTopic(ID)).toBeNull();
    expect(orderIdFromTopic(`order:${ID}x`)).toBeNull();
  });

  it('대문자 uuid 도 받습니다 — 정책의 ~* 와 같게', () => {
    expect(orderIdFromTopic(`order:${ID.toUpperCase()}`)).toBe(ID.toUpperCase());
  });
});

describe('몰려오는 신호 뭉치기', () => {
  it('첫 신호는 바로 그립니다', () => {
    expect(refreshDelay(null, 1000)).toBe(0);
  });

  it('쉬는 시간이 지났으면 바로 그립니다', () => {
    expect(refreshDelay(1000, 1000 + SIGNAL_COOLDOWN_MS)).toBe(0);
    expect(refreshDelay(1000, 1000 + SIGNAL_COOLDOWN_MS + 500)).toBe(0);
  });

  // ★ 서너 명이 연달아 쓰면 신호도 연달아 옵니다. refresh 가 줄줄이
  //   쌓이면 안 됩니다 — 남은 시간만큼 기다렸다 한 번만 그립니다.
  it('★ 쉬는 시간 안이면 남은 만큼 기다립니다', () => {
    expect(refreshDelay(1000, 1300)).toBe(SIGNAL_COOLDOWN_MS - 300);
    expect(refreshDelay(1000, 1999)).toBe(SIGNAL_COOLDOWN_MS - 999);
  });

  it('경계 — 정확히 쉬는 시간이 끝나는 순간은 0', () => {
    expect(refreshDelay(0, SIGNAL_COOLDOWN_MS)).toBe(0);
  });
});
