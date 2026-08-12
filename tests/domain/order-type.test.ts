// =========================================================
// 놓을 위치: tests/domain/order-type.test.ts
//
// 아날로그 주문이 딸고 오는 것. (사용자 결정 2026-08-13 —
//   "아날로그는 주문시 수거요청으로 가야해. 실제 임프로 작업을 진행하니깐")
// =========================================================

import { describe, it, expect } from 'vitest';
import { setupForOrderType, needsTeardown } from '@/server/domain/order-type';

describe('아날로그는 인상체를 가지러 가야 한다', () => {
  it('★ 수거요청이 함께 섭니다 — 실물이 움직이는 주문입니다', () => {
    const setup = setupForOrderType('analog');

    expect(setup.pickup).toBe('impression');
  });

  it('★ 메모는 왜인지를 적습니다 — 무엇인지는 kind 가 이미 말합니다', () => {
    // '인상체 수거 · 인상체 수거' 처럼 같은 말이 두 번 뜨면 안 됩니다
    expect(setupForOrderType('analog').pickupMemo).not.toContain('인상체');
    expect(setupForOrderType('analog').issueReason).toContain('인상체');
  });

  it('★ 딱지도 함께 답니다 — 여는 곳이 없어 필터가 늘 0이었습니다', () => {
    expect(setupForOrderType('analog').issue).toBe('analog');
  });

  it('모델리스는 파일만 건너옵니다 — 가지러 갈 것이 없습니다', () => {
    expect(setupForOrderType('modelless')).toEqual({
      issue: null,
      pickup: null,
      pickupMemo: '',
      issueReason: '',
    });
  });

  it('안 정한 종류는 모델리스로 봅니다', () => {
    expect(setupForOrderType(null).pickup).toBeNull();
    expect(setupForOrderType(undefined).pickup).toBeNull();
  });

  it('★ 리페어의 수거와 종류가 다릅니다 — 하나는 보철물, 하나는 인상체', () => {
    expect(setupForOrderType('analog').pickup).not.toBe('prosthesis');
  });
});

describe('종류를 바꾸면 앞서 만든 것을 거둔다', () => {
  it('아날로그 → 모델리스면 수거를 거둔다', () => {
    expect(needsTeardown('analog', 'modelless')).toBe(true);
  });

  it('모델리스 → 아날로그는 거둘 것이 없다 (새로 만들 뿐)', () => {
    expect(needsTeardown('modelless', 'analog')).toBe(false);
  });

  it('그대로면 아무것도 안 한다', () => {
    expect(needsTeardown('analog', 'analog')).toBe(false);
    expect(needsTeardown('modelless', 'modelless')).toBe(false);
  });
});
