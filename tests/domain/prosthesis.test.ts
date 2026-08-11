// =========================================================
// 놓을 위치: tests/domain/prosthesis.test.ts
// 기준: 기능명세서 §4.2.2, §4.2.4, §4.2.6
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  FALLBACK_TYPES,
  getType,
  getMaterials,
  isValidCombination,
  canKeepMaterial,
  buildAbbr,
  isBridgeable,
  requiresImplantModel,
} from '@/server/domain/prosthesis';

/**
 * 테스트가 쓰는 제품 목록.
 *
 * ★ 이제 제품이 표에서 옵니다. 도메인 함수는 목록을 인자로 받으므로
 *   테스트는 씨앗과 같은 최소 목록으로 규칙만 확인합니다.
 */
const CATALOG = FALLBACK_TYPES;

describe('마스터', () => {
  it('종류는 크라운 · 인레이 · 임플란트 셋', () => {
    expect(FALLBACK_TYPES.map((t) => t.code)).toEqual([
      'crown',
      'inlay',
      'implant',
    ]);
  });

  it('종류별 재료 개수', () => {
    expect(getMaterials(CATALOG, 'crown')).toHaveLength(2);
    expect(getMaterials(CATALOG, 'inlay')).toHaveLength(2);
    expect(getMaterials(CATALOG, 'implant')).toHaveLength(4);
  });

  it('없는 종류는 빈 배열', () => {
    expect(getMaterials(CATALOG, 'bridge')).toEqual([]);
    expect(getType(CATALOG, 'bridge')).toBeNull();
  });
});

describe('종속 검증', () => {
  it('맞는 조합을 통과시킨다', () => {
    expect(isValidCombination(CATALOG, 'crown', 'zirconia')).toBe(true);
    expect(isValidCombination(CATALOG, 'inlay', 'hybrid')).toBe(true);
    expect(isValidCombination(CATALOG, 'implant', 'abut_pmma')).toBe(true);
  });

  it('★ 크라운에 하이브리드는 안 된다', () => {
    expect(isValidCombination(CATALOG, 'crown', 'hybrid')).toBe(false);
  });

  it('★ 인레이에 PMMA는 안 된다', () => {
    expect(isValidCombination(CATALOG, 'inlay', 'pmma')).toBe(false);
  });

  it('★ 크라운에 임플란트 재료는 안 된다', () => {
    expect(isValidCombination(CATALOG, 'crown', 'abut_pmma')).toBe(false);
  });
});

describe('종류 변경 시 재료 유지', () => {
  it('양쪽에 다 있는 재료는 유지된다', () => {
    // 지르코니아는 크라운에도 인레이에도 있습니다
    expect(canKeepMaterial(CATALOG, 'inlay', 'zirconia')).toBe(true);
  });

  it('★ 없는 재료는 초기화 대상', () => {
    expect(canKeepMaterial(CATALOG, 'inlay', 'pmma')).toBe(false);
    expect(canKeepMaterial(CATALOG, 'crown', 'hybrid')).toBe(false);
  });
});

describe('약칭 생성', () => {
  it('크라운', () => {
    expect(buildAbbr(CATALOG, 'crown', 'zirconia')).toBe('Zir-Cr');
    expect(buildAbbr(CATALOG, 'crown', 'pmma')).toBe('Pmma-Cr');
  });

  it('인레이', () => {
    expect(buildAbbr(CATALOG, 'inlay', 'hybrid')).toBe('Hy-In');
    expect(buildAbbr(CATALOG, 'inlay', 'zirconia')).toBe('Zir-In');
  });

  it('★ 임플란트는 재료 표기를 그대로 쓴다', () => {
    expect(buildAbbr(CATALOG, 'implant', 'abut_zir_scrp')).toBe('Abut+Zir(SCRP)');
    expect(buildAbbr(CATALOG, 'implant', 'abut_pmma')).toBe('Abut + PMMA');
    expect(buildAbbr(CATALOG, 'implant', 'custom_abut')).toBe('Custom Abutment');
  });

  it('★ -Im 같은 약칭을 만들지 않는다', () => {
    expect(buildAbbr(CATALOG, 'implant', 'abut_pmma')).not.toContain('-Im');
  });

  it('★ 목록에 없는 조합은 코드를 그대로 찍는다 — 던지지 않습니다', () => {
    // 제품탭에서 재료를 끄면 지난 주문이 그 조합을 가리킨 채 남습니다.
    // 목록 한 줄 때문에 화면 전체가 죽으면 안 됩니다.
    expect(buildAbbr(CATALOG, 'crown', 'hybrid')).toBe('crown/hybrid');
    expect(buildAbbr(CATALOG, 'bridge', 'zirconia')).toBe('bridge/zirconia');
  });
});

describe('브릿지 연결 가능 여부', () => {
  it('크라운과 임플란트는 연결된다', () => {
    expect(isBridgeable(CATALOG, 'crown', CATALOG.find((t) => t.code === 'crown')?.materials[0].code ?? '')).toBe(true);
    expect(isBridgeable(CATALOG, 'implant', CATALOG.find((t) => t.code === 'implant')?.materials[0].code ?? '')).toBe(true);
  });

  it('★ 인레이는 연결되지 않는다', () => {
    expect(isBridgeable(CATALOG, 'inlay', CATALOG.find((t) => t.code === 'inlay')?.materials[0].code ?? '')).toBe(false);
  });
});

describe('임플란트 모델 필수', () => {
  it('임플란트만 모델이 필요하다', () => {
    expect(requiresImplantModel(CATALOG, 'implant')).toBe(true);
    expect(requiresImplantModel(CATALOG, 'crown')).toBe(false);
    expect(requiresImplantModel(CATALOG, 'inlay')).toBe(false);
  });
});
