// =========================================================
// 놓을 위치: tests/domain/prosthesis.test.ts
// 기준: 기능명세서 §4.2.2, §4.2.4, §4.2.6
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  PROSTHESIS_TYPES,
  getType,
  getMaterials,
  isValidCombination,
  canKeepMaterial,
  buildAbbr,
  isBridgeable,
  requiresImplantModel,
} from '@/server/domain/prosthesis';

describe('마스터', () => {
  it('종류는 크라운 · 인레이 · 임플란트 셋', () => {
    expect(PROSTHESIS_TYPES.map((t) => t.code)).toEqual([
      'crown',
      'inlay',
      'implant',
    ]);
  });

  it('종류별 재료 개수', () => {
    expect(getMaterials('crown')).toHaveLength(2);
    expect(getMaterials('inlay')).toHaveLength(2);
    expect(getMaterials('implant')).toHaveLength(4);
  });

  it('없는 종류는 빈 배열', () => {
    expect(getMaterials('bridge')).toEqual([]);
    expect(getType('bridge')).toBeNull();
  });
});

describe('종속 검증', () => {
  it('맞는 조합을 통과시킨다', () => {
    expect(isValidCombination('crown', 'zirconia')).toBe(true);
    expect(isValidCombination('inlay', 'hybrid')).toBe(true);
    expect(isValidCombination('implant', 'abut_pmma')).toBe(true);
  });

  it('★ 크라운에 하이브리드는 안 된다', () => {
    expect(isValidCombination('crown', 'hybrid')).toBe(false);
  });

  it('★ 인레이에 PMMA는 안 된다', () => {
    expect(isValidCombination('inlay', 'pmma')).toBe(false);
  });

  it('★ 크라운에 임플란트 재료는 안 된다', () => {
    expect(isValidCombination('crown', 'abut_pmma')).toBe(false);
  });
});

describe('종류 변경 시 재료 유지', () => {
  it('양쪽에 다 있는 재료는 유지된다', () => {
    // 지르코니아는 크라운에도 인레이에도 있습니다
    expect(canKeepMaterial('inlay', 'zirconia')).toBe(true);
  });

  it('★ 없는 재료는 초기화 대상', () => {
    expect(canKeepMaterial('inlay', 'pmma')).toBe(false);
    expect(canKeepMaterial('crown', 'hybrid')).toBe(false);
  });
});

describe('약칭 생성', () => {
  it('크라운', () => {
    expect(buildAbbr('crown', 'zirconia')).toBe('Zir-Cr');
    expect(buildAbbr('crown', 'pmma')).toBe('Pmma-Cr');
  });

  it('인레이', () => {
    expect(buildAbbr('inlay', 'hybrid')).toBe('Hy-In');
    expect(buildAbbr('inlay', 'zirconia')).toBe('Zir-In');
  });

  it('★ 임플란트는 재료 표기를 그대로 쓴다', () => {
    expect(buildAbbr('implant', 'abut_zir_scrp')).toBe('Abut+Zir(SCRP)');
    expect(buildAbbr('implant', 'abut_pmma')).toBe('Abut + PMMA');
    expect(buildAbbr('implant', 'custom_abut')).toBe('Custom Abutment');
  });

  it('★ -Im 같은 약칭을 만들지 않는다', () => {
    expect(buildAbbr('implant', 'abut_pmma')).not.toContain('-Im');
  });

  it('잘못된 조합은 거부한다', () => {
    expect(() => buildAbbr('crown', 'hybrid')).toThrow();
    expect(() => buildAbbr('bridge', 'zirconia')).toThrow();
  });
});

describe('브릿지 연결 가능 여부', () => {
  it('크라운과 임플란트는 연결된다', () => {
    expect(isBridgeable('crown')).toBe(true);
    expect(isBridgeable('implant')).toBe(true);
  });

  it('★ 인레이는 연결되지 않는다', () => {
    expect(isBridgeable('inlay')).toBe(false);
  });
});

describe('임플란트 모델 필수', () => {
  it('임플란트만 모델이 필요하다', () => {
    expect(requiresImplantModel('implant')).toBe(true);
    expect(requiresImplantModel('crown')).toBe(false);
    expect(requiresImplantModel('inlay')).toBe(false);
  });
});
