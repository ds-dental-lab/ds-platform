// =========================================================
// 놓을 위치: tests/domain/medit-map.test.ts
//
// 메딧의 말 → 덴플로우 제품 (사용자 요청 2026-10-05).
//
// ★ 값은 실제 메딧 PDF 와 메딧 OpenAPI 코드표에서 그대로 떼어 왔습니다.
//   PDF 는 한글('크라운 · 풀컨투어 · 지르코니아'), API 는 영문 코드
//   ('CROWN · ANATOMIC · ZIRCONIA') 인데 **같은 표**로 옮깁니다.
// =========================================================

import { describe, it, expect } from 'vitest';
import { mapCategory, mapProduct, mapProducts } from '@/server/domain/medit-map';

// 지금 덴플로우 제품표 그대로 (2026-10-05)
const CATALOG = [
  { code: 'crown', materials: [{ code: 'zirconia' }, { code: 'pmma' }] },
  { code: 'inlay', materials: [{ code: 'hybrid' }, { code: 'zirconia' }] },
  {
    code: 'implant',
    materials: [
      { code: 'abut_zir_scrp' },
      { code: 'abut_zir_cem' },
      { code: 'abut_pmma' },
      { code: 'custom_abut' },
    ],
  },
];

describe('실제 메딧 PDF 한 줄', () => {
  // 26 | 크라운 | 풀컨투어 | 지르코니아 | A1
  const hit = mapProduct({
    tooth: 26, category: '크라운', method: '풀컨투어', material: '지르코니아', shade: 'A1',
  });

  it('크라운·지르코니아로 옮겨집니다', () => {
    expect(hit).toMatchObject({ tooth: 26, typeCode: 'crown', materialCode: 'zirconia' });
  });

  it('쉐이드도 알아봅니다', () => {
    expect(hit).toMatchObject({ shadeSystem: 'vita_classic', shade: 'A1' });
  });
});

describe('API 영문 코드도 같은 표로', () => {
  it('CROWN · ANATOMIC · ZIRCONIA', () => {
    expect(
      mapProduct({ tooth: 16, category: 'CROWN', method: 'ANATOMIC', material: 'ZIRCONIA', shade: 'A2' }),
    ).toMatchObject({ typeCode: 'crown', materialCode: 'zirconia', shade: 'A2' });
  });

  it('INLAY · ZIRCONIA', () => {
    expect(
      mapProduct({ tooth: 36, category: 'INLAY', method: 'ANATOMIC', material: 'ZIRCONIA', shade: '' }),
    ).toMatchObject({ typeCode: 'inlay', materialCode: 'zirconia', shade: null });
  });
});

/*
  ★★ 임플란트는 **방식**이 제품을 가릅니다. 같은 지르코니아라도 SCRP 와
    Cementation 이 덴플로우에서 다른 제품(값도 다름)입니다.
*/
describe('★ 임플란트는 방식으로 갈립니다', () => {
  const base = { tooth: 46, category: 'IMPLANT_CROWN', material: 'ZIRCONIA', shade: 'A3' };

  it('SCRP', () => {
    expect(mapProduct({ ...base, method: 'SCREW_TYPE' })).toMatchObject({
      typeCode: 'implant', materialCode: 'abut_zir_scrp',
    });
  });

  it('Cementation', () => {
    expect(mapProduct({ ...base, method: 'CEMENTATION_TYPE' })).toMatchObject({
      typeCode: 'implant', materialCode: 'abut_zir_cem',
    });
  });

  // ★ 모르는 방식이면 **비웁니다** — 둘 중 아무거나 찍으면 값이 틀립니다
  it('★ 방식을 모르면 안 맞춥니다', () => {
    expect(mapProduct({ ...base, method: 'PFM' })).toBeNull();
  });

  it('커스텀 어버트먼트는 쉐이드가 없습니다', () => {
    expect(
      mapProduct({ tooth: 46, category: 'CUSTOM_ABUTMENT', method: '', material: 'TITANIUM', shade: 'A1' }),
    ).toMatchObject({ typeCode: 'implant', materialCode: 'custom_abut', shade: null });
  });
});

describe('폰틱', () => {
  it('폰틱이라고 적혀 있으면 표시합니다', () => {
    expect(
      mapProduct({ tooth: 25, category: 'PONTIC', method: '', material: '지르코니아', shade: 'A2' }),
    ).toMatchObject({ typeCode: 'crown', materialCode: 'zirconia', isPontic: true });
  });
});

/*
  ★★ 못 맞추면 빈 칸입니다. 엉뚱한 제품이 찍힌 주문서보다 빈 칸이 낫습니다 —
    틀린 값은 사람이 못 알아보고 그대로 넘어갑니다.
*/
describe('★ 못 맞춘 것', () => {
  it('안 파는 제품은 안 맞춥니다', () => {
    expect(
      mapProduct({ tooth: 11, category: 'VENEER', method: 'LAMINATE', material: 'E.MAX', shade: 'A1' }),
    ).toBeNull();
  });

  it('덴쳐·나이트가드도 안 맞춥니다', () => {
    expect(mapProduct({ tooth: 0, category: 'NIGHT_GUARD', method: '', material: '', shade: '' })).toBeNull();
    expect(mapProduct({ tooth: 0, category: 'DENTURE', method: '', material: '', shade: '' })).toBeNull();
  });

  it('무엇이 안 맞았는지 글자로 돌려줍니다', () => {
    const result = mapProducts(
      [
        { tooth: 26, category: '크라운', method: '풀컨투어', material: '지르코니아', shade: 'A1' },
        { tooth: 11, category: 'VENEER', method: 'LAMINATE', material: 'E.MAX', shade: 'A1' },
      ],
      CATALOG,
    );

    expect(result.mapped).toHaveLength(1);
    expect(result.unmatched).toEqual([{ tooth: 11, text: 'VENEER · LAMINATE · E.MAX · A1' }]);
  });

  /*
    ★★ 제품표는 디자인센터가 고칩니다. 코드가 사라졌는데 맞췄다고 하면,
      주문서에 없는 제품이 들어갑니다.
  */
  it('★ 지금 제품표에 없는 코드는 안 맞춘 것으로 봅니다', () => {
    const result = mapProducts(
      [{ tooth: 26, category: '크라운', method: '', material: 'PMMA', shade: '' }],
      [{ code: 'crown', materials: [{ code: 'zirconia' }] }],   // pmma 를 지운 표
    );

    expect(result.mapped).toHaveLength(0);
    expect(result.unmatched[0].tooth).toBe(26);
  });
});

/*
  ★★ DS Core 주문 목록에는 '크라운 · 13, 12, 11' 처럼 **종류와 치식만** 옵니다
    (실측 2026-10-05). 재료는 안 옵니다. 그래도 종류를 미리 골라 두면 사람이
    재료 하나만 누르면 됩니다.
*/
describe('종류만 아는 경우 (DS Core 주문 목록)', () => {
  it('크라운·인레이는 종류를 고릅니다', () => {
    expect(mapCategory('크라운')).toBe('crown');
    expect(mapCategory('CROWN')).toBe('crown');
    expect(mapCategory('인레이')).toBe('inlay');
  });

  // ★ 임플란트는 재료가 곧 방식이라(SCRP·Cementation) 종류만으로 못 정합니다
  it('★ 임플란트는 고르지 않습니다', () => {
    expect(mapCategory('IMPLANT_CROWN')).toBeNull();
    expect(mapCategory('임플란트')).toBeNull();
  });

  it('안 파는 것은 비웁니다', () => {
    expect(mapCategory('NIGHT_GUARD')).toBeNull();
    expect(mapCategory('')).toBeNull();
  });
});
