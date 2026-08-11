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
  getShadeLayout,
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

// =========================================================
// 색표 배치
//
// ★ 배치는 손으로 적은 표라 색조가 빠지거나 두 번 들어가기 쉽습니다.
//   원장이 못 찾는 색조가 생기므로 목록과 정확히 맞는지 잠가 둡니다.
// =========================================================

describe('색표 배치', () => {
  for (const system of SHADE_SYSTEMS) {
    it(`${system.name} — 색조가 하나도 빠지지 않고 중복도 없다`, () => {
      const placed = getShadeLayout(system.code)
        .rows.flat()
        .filter((cell): cell is string => Boolean(cell));

      expect([...placed].sort()).toEqual([...system.shades].sort());
      expect(new Set(placed).size).toBe(placed.length);
    });

    it(`${system.name} — 모든 줄의 길이가 같다`, () => {
      const { rows } = getShadeLayout(system.code);
      const width = Math.max(...rows.map((r) => r.length));

      // 마지막 줄은 남은 것만 채우므로 넘치지만 않으면 됩니다
      for (const row of rows) expect(row.length).toBeLessThanOrEqual(width);
    });
  }

  it('★ 3D Master 는 명도 묶음대로 11열이다', () => {
    const layout = getShadeLayout('vita_3d_master');

    expect(layout.rows).toHaveLength(3);
    for (const row of layout.rows) expect(row).toHaveLength(11);

    // 열 이름은 각 묶음의 M 자리에만 붙습니다
    expect(layout.columnLabels).toEqual([
      '1M', null, '2M', null, null, '3M', null, null, '4M', null, '5M',
    ]);
    expect(layout.columnLabels).toHaveLength(11);
  });

  it('Ivoclar 는 빈 자리와 색 없는 칸을 구분한다', () => {
    const rows = getShadeLayout('ivoclar').rows;

    // 첫 줄은 1E 하나뿐 — 나머지는 칸 자체가 없습니다
    expect(rows[0].filter(Boolean)).toEqual(['1E']);
    expect(rows[0]).toContain(null);

    // 가운데 줄에는 자리만 있고 색이 없는 칸이 있습니다
    expect(rows[1]).toContain('');
  });

  it('Vita classic 은 6칸씩 끊는다', () => {
    const rows = getShadeLayout('vita_classic').rows;

    expect(rows[0]).toEqual(['A1', 'A2', 'A3', 'A3.5', 'A4', 'B1']);
    expect(rows[rows.length - 1]).toEqual(['D3.5', 'D4']);
  });

  it('모르는 체계는 빈 표를 준다', () => {
    expect(getShadeLayout('nope').rows).toEqual([]);
  });
});
