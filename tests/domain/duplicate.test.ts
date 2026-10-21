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
  unpairedAutoTooth,
  pairedAutoTeeth,
  teethNeedingCompanion,
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

describe('FlowTemp 는 같은 치아의 크라운과 짝 (2026-10-15, 과금 1안)', () => {
  const flow: Placement = { typeCode: 'auto_temp', materialCode: 'pmma', autoPipeline: true };

  it('크라운 지르코니아 + FlowTemp 는 같이 놓인다 (순서 무관)', () => {
    expect(isAllowedPair(zirCr, flow)).toBe(true);
    expect(isAllowedPair(flow, pmmaCr)).toBe(true);
    expect(addPlacement([zirCr], flow).action).toBe('add');
  });

  it('인레이·임플란트와는 아직 짝이 아니다', () => {
    expect(isAllowedPair(hyIn, flow)).toBe(false);
    expect(isAllowedPair(scrp, flow)).toBe(false);
  });

  it('코드가 아니라 제품 성질로 본다 — 성질이 없으면 짝이 아니다', () => {
    expect(isAllowedPair(zirCr, { typeCode: 'auto_temp', materialCode: 'pmma' })).toBe(false);
  });

  it('짝 없는 FlowTemp 의 치식을 돌려준다', () => {
    const item = (tooth: number, typeCode: string, autoPipeline = false, isPontic = false) => ({
      tooth, typeCode, autoPipeline, isPontic,
    });
    expect(unpairedAutoTooth([item(16, 'auto_temp', true)])).toBe(16);
    expect(unpairedAutoTooth([item(16, 'auto_temp', true), item(16, 'crown')])).toBeNull();
    expect(unpairedAutoTooth([item(16, 'auto_temp', true), item(17, 'crown')])).toBe(16);
    // ★ 폰틱 크라운도 짝입니다 (2026-10-19) — 임시 브릿지는 가운데 폰틱까지 한 덩어리
    expect(unpairedAutoTooth([item(16, 'auto_temp', true, true), item(16, 'crown', false, true)])).toBeNull();
    expect(unpairedAutoTooth([item(16, 'crown')])).toBeNull();
  });
});

describe('짝 있는 FlowTemp 는 0원 — pairedAutoTeeth (과금 2안, 2026-10-21)', () => {
  const item = (tooth: number, typeCode: string, autoPipeline = false, isPontic = false) => ({
    tooth, typeCode, autoPipeline, isPontic,
  });

  it('같은 치아 크라운이 있으면 그 치식, 없으면 빈 목록', () => {
    expect(pairedAutoTeeth([item(16, 'auto_temp', true), item(16, 'crown')])).toEqual([16]);
    expect(pairedAutoTeeth([item(16, 'auto_temp', true)])).toEqual([]);
  });

  it('★ 다른 치아 크라운으로는 안 된다 — 치아 단위', () => {
    expect(pairedAutoTeeth([item(16, 'auto_temp', true), item(17, 'crown')])).toEqual([]);
    expect(pairedAutoTeeth([item(16, 'auto_temp', true), item(17, 'auto_temp', true), item(17, 'crown')])).toEqual([17]);
  });

  it('폰틱 크라운도 짝이고, 인레이는 짝이 아니다', () => {
    expect(pairedAutoTeeth([item(16, 'auto_temp', true, true), item(16, 'crown', false, true)])).toEqual([16]);
    expect(pairedAutoTeeth([item(16, 'auto_temp', true), item(16, 'inlay')])).toEqual([]);
  });

  it('치식 번호 순으로 돌려준다', () => {
    expect(pairedAutoTeeth([item(26, 'auto_temp', true), item(26, 'crown'), item(16, 'auto_temp', true), item(16, 'crown')])).toEqual([16, 26]);
  });
});

describe('「FlowTemp 함께」 스위치 — FlowTemp 를 더 얹을 치아 (2026-10-19)', () => {
  const item = (tooth: number, typeCode: string, autoPipeline = false, isPontic = false) => ({
    tooth, typeCode, autoPipeline, isPontic,
  });

  it('짝 크라운만 있는 치아에 얹는다 — 치식 번호 순', () => {
    expect(teethNeedingCompanion([item(26, 'crown'), item(16, 'crown')])).toEqual([16, 26]);
  });

  it('이미 FlowTemp 가 있으면 다시 안 얹는다', () => {
    expect(teethNeedingCompanion([item(16, 'crown'), item(16, 'auto_temp', true)])).toEqual([]);
  });

  it('★ 인레이·임플란트에는 안 얹는다 — 과금 1안을 스위치가 깨지 않게', () => {
    expect(teethNeedingCompanion([item(16, 'inlay'), item(17, 'implant')])).toEqual([]);
  });

  it('폰틱 크라운에도 얹는다 — 임시 브릿지의 가운데 이 (2026-10-19)', () => {
    expect(teethNeedingCompanion([item(16, 'crown', false, true)])).toEqual([16]);
  });

  it('짝 없는 FlowTemp 만 있는 치아는 건드리지 않는다 (그건 unpairedAutoTooth 가 알린다)', () => {
    expect(teethNeedingCompanion([item(16, 'auto_temp', true)])).toEqual([]);
  });
});
