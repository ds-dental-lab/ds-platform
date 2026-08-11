// =========================================================
// 놓을 위치: tests/domain/order-validate.test.ts
//
// 저장 전 검증. DB 를 건드리지 않고 규칙만 시험합니다.
// =========================================================

import { describe, it, expect } from 'vitest';
import { validateOrder, type CreateOrderInput } from '@/server/services/order';
import { FALLBACK_TYPES } from '@/server/domain/prosthesis';

/**
 * 제품 목록은 이제 인자로 받습니다 — 디자인센터가 제품탭에서 늘릴 수 있어서입니다.
 * 테스트는 씨앗과 같은 최소 목록으로 규칙만 확인합니다.
 */
const CATALOG = FALLBACK_TYPES;

const base: CreateOrderInput = {
  patientLabel: '김철수 (10001)',
  dueDate: '2026-08-20',
  items: [{ tooth: 16, typeCode: 'crown', materialCode: 'zirconia', shadeSystem: 'vita_classic', shadeCervical: 'A2' }],
};

describe('기본 입력', () => {
  it('정상 주문은 통과한다', () => {
    expect(validateOrder(base, CATALOG)).toBeNull();
  });

  it('환자가 없으면 막는다', () => {
    expect(validateOrder({ ...base, patientLabel: '' }, CATALOG)).toBeTruthy();
  });

  it('요청시한이 없으면 막는다', () => {
    expect(validateOrder({ ...base, dueDate: '' }, CATALOG)).toBeTruthy();
  });

  it('보철물이 없으면 막는다', () => {
    expect(validateOrder({ ...base, items: [] }, CATALOG)).toBeTruthy();
  });
});

describe('치식 번호', () => {
  it('★ 없는 번호를 막는다', () => {
    const result = validateOrder({
      ...base,
      items: [{ tooth: 19, typeCode: 'crown', materialCode: 'zirconia', shadeSystem: 'vita_classic', shadeCervical: 'A2' }],
    }, CATALOG);
    expect(result).toContain('19');
  });
});

describe('종류와 재료', () => {
  it('★ 크라운에 하이브리드는 막는다', () => {
    const result = validateOrder({
      ...base,
      items: [{ tooth: 16, typeCode: 'crown', materialCode: 'hybrid', shadeSystem: 'vita_classic', shadeCervical: 'A2' }],
    }, CATALOG);
    expect(result).toBeTruthy();
  });

  it('인레이 지르코니아는 통과한다', () => {
    const result = validateOrder({
      ...base,
      items: [{ tooth: 16, typeCode: 'inlay', materialCode: 'zirconia', shadeSystem: 'vita_classic', shadeCervical: 'A2' }],
    }, CATALOG);
    expect(result).toBeNull();
  });
});

describe('폰틱', () => {
  it('★ 인레이 폰틱을 막는다', () => {
    const result = validateOrder({
      ...base,
      items: [{ tooth: 16, typeCode: 'inlay', materialCode: 'hybrid', isPontic: true }],
    }, CATALOG);
    expect(result).toContain('폰틱');
  });

  it('크라운 폰틱은 통과한다', () => {
    const result = validateOrder({
      ...base,
      items: [{ tooth: 16, typeCode: 'crown', materialCode: 'zirconia', isPontic: true }],
    }, CATALOG);
    expect(result).toBeNull();
  });
});

describe('임플란트', () => {
  it('★ 모델이 없으면 막는다', () => {
    const result = validateOrder({
      ...base,
      items: [{ tooth: 16, typeCode: 'implant', materialCode: 'abut_pmma' }],
    }, CATALOG);
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
          shadeSystem: 'vita_classic',
          shadeCervical: 'A2',
        },
      ],
    }, CATALOG);
    expect(result).toBeNull();
  });

  it('임플란트 폰틱은 모델이 없어도 된다', () => {
    const result = validateOrder({
      ...base,
      items: [
        { tooth: 16, typeCode: 'implant', materialCode: 'abut_pmma', isPontic: true },
      ],
    }, CATALOG);
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
    }, CATALOG);
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
    }, CATALOG);
    expect(result).toBeNull();
  });
});

describe('한 치아 중복', () => {
  it('허용 조합은 통과한다', () => {
    const result = validateOrder({
      ...base,
      items: [
        { tooth: 16, typeCode: 'crown', materialCode: 'zirconia', shadeSystem: 'vita_classic', shadeCervical: 'A2' },
        { tooth: 16, typeCode: 'crown', materialCode: 'pmma', shadeSystem: 'vita_classic', shadeCervical: 'A2' },
      ],
    }, CATALOG);
    expect(result).toBeNull();
  });

  it('★ 허용되지 않는 조합을 막는다', () => {
    const result = validateOrder({
      ...base,
      items: [
        { tooth: 16, typeCode: 'crown', materialCode: 'zirconia', shadeSystem: 'vita_classic', shadeCervical: 'A2' },
        { tooth: 16, typeCode: 'inlay', materialCode: 'hybrid', shadeSystem: 'vita_classic', shadeCervical: 'A2' },
      ],
    }, CATALOG);
    expect(result).toBeTruthy();
  });

  it('★ 한 치아에 3개를 막는다', () => {
    const result = validateOrder({
      ...base,
      items: [
        { tooth: 16, typeCode: 'crown', materialCode: 'zirconia', shadeSystem: 'vita_classic', shadeCervical: 'A2' },
        { tooth: 16, typeCode: 'crown', materialCode: 'pmma', shadeSystem: 'vita_classic', shadeCervical: 'A2' },
        { tooth: 16, typeCode: 'implant', materialCode: 'abut_pmma',
          implantManufacturer: 'OST', implantType: 'OST_TS' },
      ],
    }, CATALOG);
    expect(result).toBeTruthy();
  });

  it('★ 같은 보철이 두 번 들어오면 막는다', () => {
    const result = validateOrder({
      ...base,
      items: [
        { tooth: 16, typeCode: 'crown', materialCode: 'zirconia', shadeSystem: 'vita_classic', shadeCervical: 'A2' },
        { tooth: 16, typeCode: 'crown', materialCode: 'zirconia', shadeSystem: 'vita_classic', shadeCervical: 'A2' },
      ],
    }, CATALOG);
    expect(result).toBeTruthy();
  });
});

// =========================================================
// 쉐이드는 필수입니다 (2026-08-12 — 서버가 안 막고 있었습니다)
// =========================================================

describe('쉐이드 필수', () => {
  const base = {
    patientLabel: '홍길동',
    dueDate: '2026-08-20',
  };

  function item(over: Record<string, unknown> = {}) {
    return { tooth: 16, typeCode: 'crown', materialCode: 'zirconia', ...over };
  }

  // ★ 기공소는 색을 모르면 만들 수 없습니다
  it('★ 쉐이드 없이 저장할 수 없다', () => {
    const problem = validateOrder({ ...base, items: [item()] }, CATALOG);

    expect(problem).toContain('쉐이드');
  });

  it('쉐이드가 있으면 통과한다', () => {
    const problem = validateOrder(
      { ...base, items: [item({ shadeSystem: 'vita_classic', shadeCervical: 'A2' })] },
      CATALOG,
    );

    expect(problem).toBeNull();
  });

  // 폰틱은 옆 이의 색을 따라갑니다
  it('폰틱은 쉐이드를 묻지 않는다', () => {
    const problem = validateOrder(
      { ...base, items: [item({ isPontic: true })] },
      CATALOG,
    );

    expect(problem).toBeNull();
  });
});
