// =========================================================
// 놓을 위치: tests/domain/shade.test.ts
// 기준: 기능명세서 §4.2.3, 설계서 §4.4 확정 색조 70개
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  SHADE_SYSTEMS,
  getSystem,
  getDefaultSystem,
  getShades,
  isValidShade,
  findSystemOf,
  EMPTY_SHADE,
  isUniform,
  isSplit,
  isEmpty,
  applyShade,
  applyToPart,
  applyToWhole,
  clearShade,
  isActive,
  formatShade,
} from '@/server/domain/shade';

describe('색조 목록', () => {
  it('체계는 셋', () => {
    expect(SHADE_SYSTEMS).toHaveLength(3);
  });

  it('★ 확정된 개수와 맞는다', () => {
    expect(getShades('vita_classic')).toHaveLength(20);
    expect(getShades('vita_3d_master')).toHaveLength(26);
    expect(getShades('ivoclar')).toHaveLength(24);
  });

  it('★ 전부 합쳐 70개', () => {
    const total = SHADE_SYSTEMS.reduce((sum, s) => sum + s.shades.length, 0);
    expect(total).toBe(70);
  });

  it('중복된 코드가 없다', () => {
    for (const system of SHADE_SYSTEMS) {
      expect(new Set(system.shades).size).toBe(system.shades.length);
    }
  });

  it('기본 체계는 Vita classic', () => {
    expect(getDefaultSystem().code).toBe('vita_classic');
  });

  it('없는 체계는 null', () => {
    expect(getSystem('chromascop')).toBeNull();
    expect(getShades('chromascop')).toEqual([]);
  });
});

describe('색조 검증', () => {
  it('있는 색조를 통과시킨다', () => {
    expect(isValidShade('vita_classic', 'A3.5')).toBe(true);
    expect(isValidShade('vita_3d_master', '2R2.5')).toBe(true);
    expect(isValidShade('ivoclar', 'BL4')).toBe(true);
  });

  it('★ 체계를 건너뛴 색조는 거른다', () => {
    expect(isValidShade('vita_classic', '2M2')).toBe(false);  // 3D Master 것
    expect(isValidShade('ivoclar', 'A3')).toBe(false);        // classic 것
  });

  it('색조가 속한 체계를 찾는다', () => {
    expect(findSystemOf('A1')?.code).toBe('vita_classic');
    expect(findSystemOf('5M3')?.code).toBe('vita_3d_master');
    expect(findSystemOf('01')?.code).toBe('ivoclar');
    expect(findSystemOf('없는색')).toBeNull();
  });
});

describe('상태 판정', () => {
  it('빈 상태', () => {
    expect(isEmpty(EMPTY_SHADE)).toBe(true);
    expect(isUniform(EMPTY_SHADE)).toBe(false);
    expect(isSplit(EMPTY_SHADE)).toBe(false);
  });

  it('한 색', () => {
    const s = { cervical: 'A3', incisal: 'A3' };
    expect(isUniform(s)).toBe(true);
    expect(isSplit(s)).toBe(false);
  });

  it('이분할', () => {
    const s = { cervical: 'A3', incisal: 'A2' };
    expect(isSplit(s)).toBe(true);
    expect(isUniform(s)).toBe(false);
  });
});

describe('이분할 적용', () => {
  it('★ 첫 클릭은 치아 전체에 적용된다', () => {
    const result = applyShade(EMPTY_SHADE, 'A3');
    expect(result).toEqual({ cervical: 'A3', incisal: 'A3' });
    expect(isUniform(result)).toBe(true);
  });

  it('★ 이미 색이 있으면 바로 적용하지 않고 대기한다', () => {
    const current = { cervical: 'A3', incisal: 'A3' };
    const result = applyShade(current, 'A2');
    expect(result).toEqual(current);   // 그대로
  });

  it('★ 치경부만 지정하면 위만 바뀐다', () => {
    const current = { cervical: 'A3', incisal: 'A3' };
    const result = applyToPart(current, 'A2', 'cervical');
    expect(result).toEqual({ cervical: 'A2', incisal: 'A3' });
    expect(isSplit(result)).toBe(true);
  });

  it('★ 절단부만 지정하면 아래만 바뀐다', () => {
    const current = { cervical: 'A3', incisal: 'A3' };
    const result = applyToPart(current, 'A1', 'incisal');
    expect(result).toEqual({ cervical: 'A3', incisal: 'A1' });
  });

  it('이분할을 다시 한 색으로', () => {
    const result = applyToWhole('A4');
    expect(isUniform(result)).toBe(true);
  });

  it('지우면 빈 상태', () => {
    expect(isEmpty(clearShade())).toBe(true);
  });

  it('원본을 바꾸지 않는다', () => {
    const current = { cervical: 'A3', incisal: 'A3' };
    applyToPart(current, 'A2', 'cervical');
    expect(current.cervical).toBe('A3');
  });
});

describe('활성 표시', () => {
  it('★ 마지막에 누른 하나만 켜진다', () => {
    let active: string | null = 'A2';
    expect(isActive(active, 'A2')).toBe(true);

    active = 'A3';                       // A3 를 새로 누름
    expect(isActive(active, 'A3')).toBe(true);
    expect(isActive(active, 'A2')).toBe(false);   // A2 는 꺼짐
  });

  it('아무것도 안 눌렀으면 다 꺼져 있다', () => {
    expect(isActive(null, 'A1')).toBe(false);
  });
});

describe('요약 표기', () => {
  it('한 색은 그대로', () => {
    expect(formatShade({ cervical: 'A3', incisal: 'A3' })).toBe('A3');
  });

  it('★ 이분할은 치경부/절단부', () => {
    expect(formatShade({ cervical: 'A3', incisal: 'A2' })).toBe('A3/A2');
  });

  it('빈 상태는 빈 문자열', () => {
    expect(formatShade(EMPTY_SHADE)).toBe('');
  });

  it('한쪽만 있으면 나머지는 -', () => {
    expect(formatShade({ cervical: 'A3', incisal: null })).toBe('A3/-');
  });
});
