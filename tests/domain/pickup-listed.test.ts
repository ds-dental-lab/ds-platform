// =========================================================
// 놓을 위치: tests/domain/pickup-listed.test.ts
//
// 수거요청이 HOME 목록에 언제까지 남는가. (사용자 결정 2026-08-13)
//   "'배송' 상태 전까지는 리스트 업이 유지되어있으면 해"
// =========================================================

import { describe, it, expect } from 'vitest';
import { pickupStillListed, pickupWaiting } from '@/server/domain/pickup';

describe('수거요청은 배송 전까지 목록에 남는다', () => {
  it('아직 안 가져간 건은 당연히 남는다', () => {
    expect(pickupStillListed('open', 'production_wait')).toBe(true);
  });

  it('★ 수거완료를 눌러도 사라지지 않는다 — 전에는 여기서 없어졌습니다', () => {
    expect(pickupStillListed('done', 'production_wait')).toBe(true);
    expect(pickupStillListed('done', 'production')).toBe(true);
  });

  it('배송으로 넘어가면 빠진다', () => {
    expect(pickupStillListed('done', 'shipping')).toBe(false);
    expect(pickupStillListed('open', 'shipping')).toBe(false);
  });

  it('완료·취소된 주문도 빠진다', () => {
    expect(pickupStillListed('done', 'completed')).toBe(false);
    expect(pickupStillListed('open', 'cancelled')).toBe(false);
  });

  it('취소된 수거는 주문이 어디에 있든 안 보인다', () => {
    expect(pickupStillListed('cancelled', 'received')).toBe(false);
    expect(pickupStillListed('cancelled', null)).toBe(false);
  });

  it('★ 주문 없는 수거는 기준 삼을 단계가 없어 예전 규칙을 탄다', () => {
    expect(pickupStillListed('open', null)).toBe(true);
    expect(pickupStillListed('assigned', null)).toBe(true);
    expect(pickupStillListed('done', null)).toBe(false);
  });
});

describe('아직 안 가져간 것인지 가른다', () => {
  it('접수함까지는 기다리는 중이다', () => {
    expect(pickupWaiting('open')).toBe(true);
    expect(pickupWaiting('assigned')).toBe(true);
  });

  it('가져갔으면 기다리는 중이 아니다', () => {
    expect(pickupWaiting('done')).toBe(false);
    expect(pickupWaiting('cancelled')).toBe(false);
  });
});
