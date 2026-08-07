// =========================================================
// 놓을 위치: tests/domain/implant.test.ts
// 기준: 기능명세서 §4.2.4
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  MANUFACTURERS,
  EMPTY_SELECTION,
  getTypes,
  getSizes,
  getScrews,
  selectManufacturer,
  selectType,
  isComplete,
  getMissingStep,
  formatSelection,
} from '@/server/domain/implant';

describe('종속 관계', () => {
  it('★ 제조사를 고르면 그 제조사 타입만 나온다', () => {
    const osstem = getTypes('OST').map((t) => t.name);
    expect(osstem).toEqual(['KS', 'SS', 'TS', 'US']);
    expect(osstem).not.toContain('IS');       // IS 는 Neobiotech 것
  });

  it('★ IS 는 Neobiotech 에만 있다', () => {
    expect(getTypes('NBT').map((t) => t.name)).toContain('IS');
  });

  it('제조사를 안 고르면 타입이 없다', () => {
    expect(getTypes(null)).toEqual([]);
  });

  it('★ 사이즈는 제조사가 아니라 타입에 딸린다', () => {
    // 같은 Osstem 인데 TS 와 SS 의 사이즈가 다릅니다
    expect(getSizes('OST', 'OST_TS').map((s) => s.name)).toEqual(['Mini', 'Regular']);
    expect(getSizes('OST', 'OST_SS').map((s) => s.name)).toEqual(['Mini', 'Regular', 'Wide']);
  });

  it('★ 스크류도 타입마다 다르다', () => {
    expect(getScrews('OST', 'OST_TS').map((s) => s.name)).toEqual(['Hex', 'Non-Hex']);
    expect(getScrews('OST', 'OST_SS').map((s) => s.name)).toEqual(['Octa', 'Non-Octa']);
  });

  it('★ 사이즈가 없는 타입은 목록이 비어 있다', () => {
    expect(getSizes('OST', 'OST_US')).toEqual([]);
  });
});

describe('표기 통일', () => {
  it('★ 스크류 이름은 Hex / Non-Hex 로 통일한다', () => {
    for (const m of MANUFACTURERS) {
      for (const t of m.types) {
        for (const s of t.screws) {
          expect(s.name).not.toBe('HEX');       // 전부 대문자 금지
          expect(s.name).not.toBe('non-hex');
        }
      }
    }
  });

  it('★ 코드는 부모 코드를 물려받는다', () => {
    for (const m of MANUFACTURERS) {
      for (const t of m.types) {
        expect(t.code.startsWith(m.code)).toBe(true);
        for (const s of [...t.sizes, ...t.screws]) {
          expect(s.code.startsWith(t.code)).toBe(true);
        }
      }
    }
  });

  it('★ 누락을 뜻하는 가짜 항목이 없다', () => {
    for (const m of MANUFACTURERS) {
      for (const t of m.types) {
        for (const s of [...t.sizes, ...t.screws]) {
          expect(['-', 'NA', 'N/A', '해당없음']).not.toContain(s.name);
        }
      }
    }
  });
});

describe('상위 변경 시 하위 초기화', () => {
  it('★ 제조사를 바꾸면 아래가 전부 지워진다', () => {
    const result = selectManufacturer('DTM');
    expect(result.typeCode).toBeNull();
    expect(result.sizeCode).toBeNull();
    expect(result.screwCode).toBeNull();
  });

  it('★ 타입을 바꾸면 사이즈·스크류가 지워진다', () => {
    const before = {
      manufacturerCode: 'OST',
      typeCode: 'OST_TS',
      sizeCode: 'OST_TS_MINI',
      screwCode: 'OST_TS_HEX',
      option: '메모',
    };
    const after = selectType(before, 'OST_SS');

    expect(after.sizeCode).toBeNull();
    expect(after.screwCode).toBeNull();
    expect(after.typeCode).toBe('OST_SS');
    expect(after.option).toBe('메모');      // 옵션은 유지
  });
});

describe('완성 판정', () => {
  const base = { ...EMPTY_SELECTION, manufacturerCode: 'OST' };

  it('제조사만으로는 부족하다', () => {
    expect(isComplete(base)).toBe(false);
    expect(getMissingStep(base)).toBe('타입');
  });

  it('사이즈를 안 고르면 진행할 수 없다', () => {
    const s = { ...base, typeCode: 'OST_TS', screwCode: 'OST_TS_HEX' };
    expect(isComplete(s)).toBe(false);
    expect(getMissingStep(s)).toBe('사이즈');
  });

  it('★ 고를 사이즈가 없는 타입은 사이즈 없이 진행된다', () => {
    const s = { ...base, typeCode: 'OST_US', screwCode: 'OST_US_HEX' };
    expect(isComplete(s)).toBe(true);
    expect(getMissingStep(s)).toBeNull();
  });

  it('다 고르면 완성', () => {
    const s = {
      ...base,
      typeCode: 'OST_TS',
      sizeCode: 'OST_TS_MINI',
      screwCode: 'OST_TS_HEX',
      option: '',
    };
    expect(isComplete(s)).toBe(true);
  });

  it('옵션은 비어 있어도 된다', () => {
    const s = {
      ...base,
      typeCode: 'OST_TS',
      sizeCode: 'OST_TS_MINI',
      screwCode: 'OST_TS_HEX',
      option: '',
    };
    expect(isComplete(s)).toBe(true);
  });
});

describe('요약 표기', () => {
  it('고른 것만 이어 붙인다', () => {
    const s = {
      manufacturerCode: 'OST',
      typeCode: 'OST_TS',
      sizeCode: 'OST_TS_REG',
      screwCode: 'OST_TS_HEX',
      option: '',
    };
    expect(formatSelection(s)).toBe('Osstem TS Regular Hex');
  });

  it('★ 사이즈가 없으면 그 자리가 빠진다', () => {
    const s = {
      manufacturerCode: 'OST',
      typeCode: 'OST_US',
      sizeCode: null,
      screwCode: 'OST_US_HEX',
      option: '',
    };
    expect(formatSelection(s)).toBe('Osstem US Hex');
  });

  it('옵션은 맨 뒤에 붙는다', () => {
    const s = {
      manufacturerCode: 'DTM',
      typeCode: 'DTM_SL',
      sizeCode: 'DTM_SL_REG',
      screwCode: 'DTM_SL_HEX',
      option: '특수 발주',
    };
    expect(formatSelection(s)).toBe('Dentium Super Line Regular Hex 특수 발주');
  });

  it('아무것도 안 골랐으면 빈 문자열', () => {
    expect(formatSelection(EMPTY_SELECTION)).toBe('');
  });
});
