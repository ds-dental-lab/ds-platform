// =========================================================
// 놓을 위치: tests/domain/summary.test.ts
// 기준: 기능명세서 §4.2.5, §4.2.7
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  buildSummaryLines,
  shouldHighlightReset,
  countTeeth,
} from '@/server/domain/summary';
import type { ToothPlacement } from '@/server/domain/bridge';

const zir = (tooth: number, isPontic = false): ToothPlacement => ({
  tooth,
  typeCode: 'crown',
  materialCode: 'zirconia',
  isPontic,
});

const pmma = (tooth: number): ToothPlacement => ({
  tooth,
  typeCode: 'crown',
  materialCode: 'pmma',
});

const scrp = (tooth: number): ToothPlacement => ({
  tooth,
  typeCode: 'implant',
  materialCode: 'abut_zir_scrp',
});

describe('한 줄 만들기', () => {
  it('★ 명세서 형식과 맞는다', () => {
    const lines = buildSummaryLines({
      placements: [zir(42), zir(41, true), zir(31)],
      shades: {
        42: { cervical: 'A3', incisal: 'A3' },
        31: { cervical: 'A3', incisal: 'A3' },
      },
    });

    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('Zir-Cr | 42, X, 31 (A3)');
  });

  it('★ 폰틱은 번호 대신 X', () => {
    // 17 을 폰틱으로 지정 → 번호가 아니라 X 로 나와야 합니다
    const lines = buildSummaryLines({ placements: [zir(16), zir(17, true)] });
    expect(lines[0].teethLabel).toBe('X, 16');
    expect(lines[0].teethLabel).not.toContain('17');
  });

  it('치식도 순서대로 정렬된다', () => {
    const lines = buildSummaryLines({ placements: [zir(16), zir(18), zir(17)] });
    expect(lines[0].teeth).toEqual([18, 17, 16]);
  });

  it('빈 입력은 빈 결과', () => {
    expect(buildSummaryLines({ placements: [] })).toEqual([]);
  });
});

describe('중복 등록', () => {
  it('★ 같은 치아라도 재료가 다르면 두 줄로 나뉜다', () => {
    const lines = buildSummaryLines({ placements: [zir(16), pmma(16)] });

    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.abbr).sort()).toEqual(['Pmma-Cr', 'Zir-Cr']);
  });

  it('종류가 달라도 두 줄', () => {
    const lines = buildSummaryLines({ placements: [zir(16), scrp(16)] });
    expect(lines).toHaveLength(2);
  });
});

describe('임플란트', () => {
  it('★ 약칭 대신 재료 표기를 그대로 쓴다', () => {
    const lines = buildSummaryLines({ placements: [scrp(16)] });
    expect(lines[0].abbr).toBe('Abut+Zir(SCRP)');
    expect(lines[0].text).not.toContain('-Im');
  });

  it('모델이 뒤에 붙는다', () => {
    const lines = buildSummaryLines({
      placements: [scrp(16)],
      implants: {
        16: {
          manufacturerCode: 'OST',
          typeCode: 'OST_TS',
          sizeCode: 'OST_TS_REG',
          screwCode: 'OST_TS_HEX',
          option: '',
        },
      },
    });
    expect(lines[0].text).toContain('Osstem TS Regular Hex');
  });
});

describe('쉐이드', () => {
  it('전부 같으면 하나로 적는다', () => {
    const lines = buildSummaryLines({
      placements: [zir(16), zir(17)],
      shades: {
        16: { cervical: 'A2', incisal: 'A2' },
        17: { cervical: 'A2', incisal: 'A2' },
      },
    });
    expect(lines[0].shadeLabel).toBe('A2');
  });

  it('다르면 나란히 적는다', () => {
    const lines = buildSummaryLines({
      placements: [zir(16), zir(17)],
      shades: {
        16: { cervical: 'A2', incisal: 'A2' },
        17: { cervical: 'A3', incisal: 'A3' },
      },
    });
    expect(lines[0].shadeLabel).toBe('A3, A2');
  });

  it('★ 이분할은 슬래시로', () => {
    const lines = buildSummaryLines({
      placements: [zir(11)],
      shades: { 11: { cervical: 'A3', incisal: 'A2' } },
    });
    expect(lines[0].shadeLabel).toBe('A3/A2');
  });

  it('★ 폰틱은 쉐이드를 따지지 않는다', () => {
    const lines = buildSummaryLines({
      placements: [zir(16), zir(17, true)],
      shades: { 16: { cervical: 'A3', incisal: 'A3' } },
    });
    expect(lines[0].shadeLabel).toBe('A3');
  });

  it('쉐이드가 없으면 괄호가 안 붙는다', () => {
    const lines = buildSummaryLines({ placements: [zir(16)] });
    expect(lines[0].text).toBe('Zir-Cr | 16');
  });
});

describe('초기화 버튼', () => {
  it('★ 선택이 하나라도 있으면 강조된다', () => {
    expect(shouldHighlightReset([])).toBe(false);
    expect(shouldHighlightReset([zir(16)])).toBe(true);
  });
});

describe('치아 개수', () => {
  it('중복 등록된 치아는 하나로 센다', () => {
    expect(countTeeth([zir(16), pmma(16)])).toBe(1);
    expect(countTeeth([zir(16), zir(17)])).toBe(2);
  });
});
