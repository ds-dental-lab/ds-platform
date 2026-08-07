// =========================================================
// 놓을 위치: tests/domain/duplicate.test.ts
// 기준: 기능명세서 §4.2.7
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  isAllowedPair,
  addPlacement,
  hasDuplicateBadge,
  getAllowedPairs,
  MAX_PER_TOOTH,
  type Placement,
} from '@/server/domain/duplicate';

const zirCr: Placement  = { typeCode: 'crown',    materialCode: 'zirconia' };
const pmmaCr: Placement = { typeCode: 'crown',    materialCode: 'pmma' };
const hyIn: Placement   = { typeCode: 'inlay',    materialCode: 'hybrid' };
const zirIn: Placement  = { typeCode: 'inlay',    materialCode: 'zirconia' };
const scrp: Placement   = { typeCode: 'implant',  materialCode: 'abut_zir_scrp' };
const cem: Placement    = { typeCode: 'implant',  materialCode: 'abut_zir_cem' };
const abutPmma: Placement = { typeCode: 'implant', materialCode: 'abut_pmma' };
const customAbut: Placement = { typeCode: 'implant', materialCode: 'custom_abut' };

describe('허용 조합', () => {
  it('정확히 3종이다', () => {
    expect(getAllowedPairs()).toHaveLength(3);
  });

  it('크라운 지르코니아 + 크라운 PMMA', () => {
    expect(isAllowedPair(zirCr, pmmaCr)).toBe(true);
  });

  it('임플란트 SCRP + Abut PMMA', () => {
    expect(isAllowedPair(scrp, abutPmma)).toBe(true);
  });

  it('임플란트 Cementation + Abut PMMA', () => {
    expect(isAllowedPair(cem, abutPmma)).toBe(true);
  });

  it('★ 순서를 바꿔도 같은 조합이다', () => {
    expect(isAllowedPair(pmmaCr, zirCr)).toBe(true);
    expect(isAllowedPair(abutPmma, scrp)).toBe(true);
  });

  it('★ 그 외 조합은 허용되지 않는다', () => {
    expect(isAllowedPair(zirCr, hyIn)).toBe(false);   // 종류가 다름
    expect(isAllowedPair(hyIn, zirIn)).toBe(false);   // 인레이끼리
    expect(isAllowedPair(scrp, cem)).toBe(false);     // SCRP + Cementation
    expect(isAllowedPair(scrp, customAbut)).toBe(false);
  });

  it('같은 것 둘은 조합이 아니다', () => {
    expect(isAllowedPair(zirCr, zirCr)).toBe(false);
  });
});

describe('보철 올리기', () => {
  it('빈 치아에는 그냥 올라간다', () => {
    const r = addPlacement([], zirCr);
    expect(r.action).toBe('add');
    expect(r.placements).toEqual([zirCr]);
  });

  it('★ 같은 것을 다시 누르면 해제된다', () => {
    const r = addPlacement([zirCr], zirCr);
    expect(r.action).toBe('remove');
    expect(r.placements).toEqual([]);
  });

  it('허용 조합이면 둘 다 남는다', () => {
    const r = addPlacement([zirCr], pmmaCr);
    expect(r.action).toBe('add');
    expect(r.placements).toEqual([zirCr, pmmaCr]);
  });

  it('★ 허용되지 않는 조합은 덮어쓴다', () => {
    const r = addPlacement([zirCr], hyIn);
    expect(r.action).toBe('replace');
    expect(r.placements).toEqual([hyIn]);
  });

  it('★ 이미 2개인 치아에 세 번째는 덮어쓴다', () => {
    const r = addPlacement([zirCr, pmmaCr], scrp);
    expect(r.action).toBe('replace');
    expect(r.placements).toEqual([scrp]);
    expect(r.placements).toHaveLength(1);
  });

  it('★ 2개인 상태에서 그중 하나를 다시 누르면 그것만 빠진다', () => {
    const r = addPlacement([zirCr, pmmaCr], pmmaCr);
    expect(r.action).toBe('remove');
    expect(r.placements).toEqual([zirCr]);
  });

  it('한 치아에 3개가 되는 경우는 없다', () => {
    const r = addPlacement([scrp, abutPmma], cem);
    expect(r.placements.length).toBeLessThanOrEqual(MAX_PER_TOOTH);
  });
});

describe('2 배지', () => {
  it('2개일 때만 붙는다', () => {
    expect(hasDuplicateBadge([])).toBe(false);
    expect(hasDuplicateBadge([zirCr])).toBe(false);
    expect(hasDuplicateBadge([zirCr, pmmaCr])).toBe(true);
  });
});
