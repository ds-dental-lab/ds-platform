// =========================================================
// 놓을 위치: tests/domain/order-validate.test.ts
//
// 저장 전 검증. DB 를 건드리지 않고 규칙만 시험합니다.
// =========================================================

import { describe, it, expect } from 'vitest';
import { validateOrder, type CreateOrderInput } from '@/server/services/order';

const base: CreateOrderInput = {
  patientLabel: '김철수 (10001)',
  dueDate: '2026-08-20',
  items: [{ tooth: 16, typeCode: 'crown', materialCode: 'zirconia' }],
};

describe('기본 입력', () => {
  it('정상 주문은 통과한다', () => {
    expect(validateOrder(base)).toBeNull();
  });

  it('환자가 없으면 막는다', () => {
    expect(validateOrder({ ...base, patientLabel: '' })).toBeTruthy();
  });

  it('요청시한이 없으면 막는다', () => {
    expect(validateOrder({ ...base, dueDate: '' })).toBeTruthy();
  });

  it('보철물이 없으면 막는다', () => {
    expect(validateOrder({ ...base, items: [] })).toBeTruthy();
  });
});

describe('치식 번호', () => {
  it('★ 없는 번호를 막는다', () => {
    const result = validateOrder({
      ...base,
      items: [{ tooth: 19, typeCode: 'crown', materialCode: 'zirconia' }],
    });
    expect(result).toContain('19');
  });
});

describe('종류와 재료', () => {
  it('★ 크라운에 하이브리드는 막는다', () => {
    const result = validateOrder({
      ...base,
      items: [{ tooth: 16, typeCode: 'crown', materialCode: 'hybrid' }],
    });
    expect(result).toBeTruthy();
  });

  it('인레이 지르코니아는 통과한다', () => {
    const result = validateOrder({
      ...base,
      items: [{ tooth: 16, typeCode: 'inlay', materialCode: 'zirconia' }],
    });
    expect(result).toBeNull();
  });
});

describe('폰틱', () => {
  it('★ 인레이 폰틱을 막는다', () => {
    const result = validateOrder({
      ...base,
      items: [{ tooth: 16, typeCode: 'inlay', materialCode: 'hybrid', isPontic: true }],
    });
    expect(result).toContain('폰틱');
  });

  it('크라운 폰틱은 통과한다', () => {
    const result = validateOrder({
      ...base,
      items: [{ tooth: 16, typeCode: 'crown', materialCode: 'zirconia', isPontic: true }],
    });
    expect(result).toBeNull();
  });
});

describe('임플란트', () => {
  it('★ 모델이 없으면 막는다', () => {
    const result = validateOrder({
      ...base,
      items: [{ tooth: 16, typeCode: 'implant', materialCode: 'abut_pmma' }],
    });
    expect(result).toContain('임플란트');
  });

  it('모델이 있으면 통과한다', () => {
    const result = validateOrder({
      ...base,
      items: [
        {
          tooth: 16,
          typeCode: 'implant',
          materialCode: 'abut_pmma',
          implantManufacturer: 'OST',
          implantType: 'OST_TS',
        },
      ],
    });
    expect(result).toBeNull();
  });

  it('임플란트 폰틱은 모델이 없어도 된다', () => {
    const result = validateOrder({
      ...base,
      items: [
        { tooth: 16, typeCode: 'implant', materialCode: 'abut_pmma', isPontic: true },
      ],
    });
    expect(result).toBeNull();
  });
});

describe('쉐이드', () => {
  it('★ 체계에 없는 색조를 막는다', () => {
    const result = validateOrder({
      ...base,
      items: [
        {
          tooth: 16,
          typeCode: 'crown',
          materialCode: 'zirconia',
          shadeSystem: 'vita_classic',
          shadeCervical: '2M2',      // 3D Master 코드
        },
      ],
    });
    expect(result).toContain('2M2');
  });

  it('맞는 색조는 통과한다', () => {
    const result = validateOrder({
      ...base,
      items: [
        {
          tooth: 16,
          typeCode: 'crown',
          materialCode: 'zirconia',
          shadeSystem: 'vita_classic',
          shadeCervical: 'A3',
          shadeIncisal: 'A2',
        },
      ],
    });
    expect(result).toBeNull();
  });
});

describe('한 치아 중복', () => {
  it('허용 조합은 통과한다', () => {
    const result = validateOrder({
      ...base,
      items: [
        { tooth: 16, typeCode: 'crown', materialCode: 'zirconia' },
        { tooth: 16, typeCode: 'crown', materialCode: 'pmma' },
      ],
    });
    expect(result).toBeNull();
  });

  it('★ 허용되지 않는 조합을 막는다', () => {
    const result = validateOrder({
      ...base,
      items: [
        { tooth: 16, typeCode: 'crown', materialCode: 'zirconia' },
        { tooth: 16, typeCode: 'inlay', materialCode: 'hybrid' },
      ],
    });
    expect(result).toBeTruthy();
  });

  it('★ 한 치아에 3개를 막는다', () => {
    const result = validateOrder({
      ...base,
      items: [
        { tooth: 16, typeCode: 'crown', materialCode: 'zirconia' },
        { tooth: 16, typeCode: 'crown', materialCode: 'pmma' },
        { tooth: 16, typeCode: 'implant', materialCode: 'abut_pmma',
          implantManufacturer: 'OST', implantType: 'OST_TS' },
      ],
    });
    expect(result).toBeTruthy();
  });

  it('★ 같은 보철이 두 번 들어오면 막는다', () => {
    const result = validateOrder({
      ...base,
      items: [
        { tooth: 16, typeCode: 'crown', materialCode: 'zirconia' },
        { tooth: 16, typeCode: 'crown', materialCode: 'zirconia' },
      ],
    });
    expect(result).toBeTruthy();
  });
});
