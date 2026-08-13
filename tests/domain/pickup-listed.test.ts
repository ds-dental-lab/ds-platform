// =========================================================
// 놓을 위치: tests/domain/pickup-listed.test.ts
//
// 수거요청이 HOME 목록에 언제까지 남는가. (사용자 결정 2026-08-13)
//   "'배송' 상태 전까지는 리스트 업이 유지되어있으면 해"
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  pickupStillListed,
  pickupWaiting,
  canCompletePickup,
} from '@/server/domain/pickup';

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

describe('수거완료는 받는 사람만 누른다', () => {
  const LAB = 'org-lab';
  const CLINIC = 'org-clinic';
  const DESIGN = 'org-design';

  it('배정된 기공소는 누를 수 있다', () => {
    expect(
      canCompletePickup({ viewerOrgId: LAB, labOrgId: LAB, pickupStatus: 'open' }),
    ).toBe(true);
  });

  it('★ 자사 제작이면 디자인센터가 누른다 — 전에는 아무도 못 눌렀습니다', () => {
    // 기공소 자리를 디자인센터가 겸합니다 (통합 조직 모델)
    expect(
      canCompletePickup({ viewerOrgId: DESIGN, labOrgId: DESIGN, pickupStatus: 'open' }),
    ).toBe(true);
  });

  it('★ 치과는 절대 못 누른다 — 보내는 쪽이 도착을 선언할 수는 없습니다', () => {
    expect(
      canCompletePickup({ viewerOrgId: CLINIC, labOrgId: LAB, pickupStatus: 'open' }),
    ).toBe(false);
  });

  it('남의 기공소 건은 못 누른다', () => {
    expect(
      canCompletePickup({ viewerOrgId: 'org-other', labOrgId: LAB, pickupStatus: 'open' }),
    ).toBe(false);
  });

  it('기공소가 아직 안 정해졌으면 아무도 못 누른다', () => {
    expect(
      canCompletePickup({ viewerOrgId: DESIGN, labOrgId: null, pickupStatus: 'open' }),
    ).toBe(false);
  });

  it('이미 닫힌 수거는 다시 못 누른다', () => {
    expect(
      canCompletePickup({ viewerOrgId: LAB, labOrgId: LAB, pickupStatus: 'done' }),
    ).toBe(false);
    expect(
      canCompletePickup({ viewerOrgId: LAB, labOrgId: LAB, pickupStatus: 'cancelled' }),
    ).toBe(false);
  });

  it('택배사에 접수만 한 상태면 아직 누를 수 있다', () => {
    expect(
      canCompletePickup({ viewerOrgId: LAB, labOrgId: LAB, pickupStatus: 'assigned' }),
    ).toBe(true);
  });

  it('로그인 안 한 사람은 못 누른다', () => {
    expect(
      canCompletePickup({ viewerOrgId: null, labOrgId: LAB, pickupStatus: 'open' }),
    ).toBe(false);
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
