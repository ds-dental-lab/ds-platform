// =========================================================
// 놓을 위치: tests/domain/order-type.test.ts
//
// 아날로그 주문이 딸고 오는 것. (사용자 결정 2026-08-13 —
//   "아날로그는 주문시 수거요청으로 가야해. 실제 임프로 작업을 진행하니깐")
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  effectiveOrderType,
  ORDER_TYPE_LABEL,
  setupForOrderType,
  needsTeardown,
  lockedOrderType,
  isOrderable,
  ORDERABLE_TYPES,
} from '@/server/domain/order-type';

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

describe('FlowTemp 가 들면 모델리스뿐 (2026-10-15)', () => {
  // ★ 스캔 파일로 설계해 치과 프린터로 뽑는 제품입니다 — 인상체가 오가면 설계할 게 없습니다
  it('자동 제품이 하나라도 들면 모델리스로 묶입니다', () => {
    expect(lockedOrderType([true])).toBe('modelless');
    expect(lockedOrderType([false, true, false])).toBe('modelless');
  });

  it('자동 제품이 없으면 고를 수 있습니다 — 다른 제품은 그대로', () => {
    expect(lockedOrderType([false, false])).toBeNull();
    expect(lockedOrderType([])).toBeNull();
  });
});

describe('지금 주문할 수 있는 종류 (2026-10-15)', () => {
  it('모델리스는 됩니다 — 비워 보내도 모델리스입니다', () => {
    expect(isOrderable('modelless')).toBe(true);
    expect(isOrderable(undefined)).toBe(true);
  });

  // ★ 아날로그 길이 아직 안 갖춰졌습니다. 열 때는 ORDERABLE_TYPES 한 줄입니다
  it('★ 아날로그는 아직 안 됩니다', () => {
    expect(isOrderable('analog')).toBe(false);
    expect(ORDERABLE_TYPES).not.toContain('analog');
  });
});

describe('임시치아만 주문은 종류가 temp (과금 2안, 2026-10-22)', () => {
  it('항목이 전부 FlowTemp 면 temp', () => {
    expect(effectiveOrderType('modelless', [true])).toBe('temp');
    expect(effectiveOrderType('modelless', [true, true])).toBe('temp');
  });

  it('크라운이 하나라도 있으면 고른 종류 그대로', () => {
    expect(effectiveOrderType('modelless', [true, false])).toBe('modelless');
    expect(effectiveOrderType('analog', [false])).toBe('analog');
  });

  it('항목이 없으면 고른 종류 그대로 — 빈 주문을 temp 로 만들지 않는다', () => {
    expect(effectiveOrderType('modelless', [])).toBe('modelless');
  });

  it('이름은 치과가 읽는 말', () => {
    expect(ORDER_TYPE_LABEL.temp).toBe('임시치아');
    expect(ORDER_TYPE_LABEL.repair).toBe('리페어');
  });
});
