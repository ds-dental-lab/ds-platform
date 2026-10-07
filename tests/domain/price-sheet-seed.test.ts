// =========================================================
// 놓을 위치: tests/domain/price-sheet-seed.test.ts
// 기준: 사용자 지적 2026-10-07 — "수가표 탭에서 기본값으로 저장된 금액이
//       신규가입 치과 수가표에 적용이 안되어있네"
//
// ★ 수가표는 상담용 종이고 실제 단가는 제품표에서 옵니다. 둘이 따로 놀아서
//   센터가 48,000 을 적어 보내도 새 치과는 50,000 으로 주문이 들어갔습니다.
//   이 시험은 그 이음새를 못 박습니다.
// =========================================================

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PRICE_SHEET,
  SHEET_TO_PRODUCT,
  sheetToClinicPrices,
  type MaterialRef,
  type PriceRow,
} from '@/server/domain/price-sheet';

/** 실제 제품표와 같은 모양 (2026-10-07) */
const MATERIALS: MaterialRef[] = [
  { id: 'm-crown-zir', typeCode: 'crown', materialCode: 'zirconia' },
  { id: 'm-crown-pmma', typeCode: 'crown', materialCode: 'pmma' },
  { id: 'm-inlay-hyb', typeCode: 'inlay', materialCode: 'hybrid' },
  { id: 'm-inlay-zir', typeCode: 'inlay', materialCode: 'zirconia' },
  { id: 'm-imp-scrp', typeCode: 'implant', materialCode: 'abut_zir_scrp' },
  { id: 'm-imp-cem', typeCode: 'implant', materialCode: 'abut_zir_cem' },
  { id: 'm-imp-pmma', typeCode: 'implant', materialCode: 'abut_pmma' },
  { id: 'm-imp-abut', typeCode: 'implant', materialCode: 'custom_abut' },
];

const find = (rows: { materialId: string; price: number }[], id: string) =>
  rows.find((r) => r.materialId === id)?.price;

describe('수가표를 치과 단가로', () => {
  it('여섯 줄이 제 제품으로 갑니다', () => {
    const got = sheetToClinicPrices(DEFAULT_PRICE_SHEET, MATERIALS);
    // ★ 임플란트 보철 한 줄이 둘(SCRP·Cementation)을 가리켜 일곱입니다
    expect(got).toHaveLength(7);
    expect(find(got, 'm-crown-pmma')).toBe(10_000);
    expect(find(got, 'm-crown-zir')).toBe(45_000);
    expect(find(got, 'm-inlay-hyb')).toBe(40_000);
    expect(find(got, 'm-inlay-zir')).toBe(40_000);
    expect(find(got, 'm-imp-abut')).toBe(45_000);
    expect(find(got, 'm-imp-scrp')).toBe(90_000);
  });

  it('같은 이름이라도 **분류로** 가립니다', () => {
    /*
      ★ '지르코니아' 가 크라운에도 인레이에도 있습니다. 이름만 보고 이으면
        크라운 값이 인레이로 가거나 그 반대가 됩니다.
    */
    const rows: PriceRow[] = [
      { group: 'Crown', item: 'Zirconia', price: 48_000 },
      { group: 'Inlay', item: 'Zirconia', price: 40_000 },
    ];
    const got = sheetToClinicPrices(rows, MATERIALS);
    expect(find(got, 'm-crown-zir')).toBe(48_000);
    expect(find(got, 'm-inlay-zir')).toBe(40_000);
  });

  it('임플란트 보철 한 줄이 **둘**을 같은 값으로 맞춥니다', () => {
    /*
      ★ 종이에는 한 줄인데 제품표는 조이는 방식(SCRP)과 붙이는 방식
        (Cementation)으로 나뉩니다. 치과에는 한 값으로 말하기로 했습니다
        (사용자 결정 2026-10-07).
    */
    const got = sheetToClinicPrices(DEFAULT_PRICE_SHEET, MATERIALS);
    expect(find(got, 'm-imp-scrp')).toBe(90_000);
    expect(find(got, 'm-imp-cem')).toBe(90_000);
  });

  it('수가표에 없는 제품은 **건드리지 않습니다**', () => {
    /*
      ★ Abut+PMMA 는 종이에 안 적힙니다. 우리가 값을 정해 버리면 센터가
        적지도 않은 값으로 주문이 들어갑니다.
    */
    const touched = sheetToClinicPrices(DEFAULT_PRICE_SHEET, MATERIALS).map((r) => r.materialId);
    expect(touched).not.toContain('m-imp-pmma');
  });

  it('못 잇는 줄은 조용히 건너뜁니다', () => {
    // ★ 센터가 수가표에 새 줄을 적어도 화면이 멈추면 안 됩니다
    const rows: PriceRow[] = [
      { group: 'Crown', item: 'PMMA', price: 10_000 },
      { group: 'Crown', item: '새로 만든 것', price: 30_000 },
    ];
    expect(sheetToClinicPrices(rows, MATERIALS)).toHaveLength(1);
  });

  it('제품표에 없는 재료를 가리켜도 안 죽습니다', () => {
    expect(sheetToClinicPrices(DEFAULT_PRICE_SHEET, [])).toEqual([]);
  });

  it('값이 이상한 줄은 안 옮깁니다', () => {
    const rows = [
      { group: 'Crown', item: 'PMMA', price: 0 },
      { group: 'Crown', item: 'Zirconia', price: -1 },
      { group: 'Inlay', item: 'Hybrid', price: 1.5 },
    ] as PriceRow[];
    expect(sheetToClinicPrices(rows, MATERIALS)).toEqual([]);
  });

  it('앞뒤 빈칸이 있어도 이어집니다', () => {
    const rows: PriceRow[] = [{ group: 'Crown', item: '  PMMA  ', price: 10_000 }];
    expect(sheetToClinicPrices(rows, MATERIALS)).toHaveLength(1);
  });
});

describe('이음표가 수가표 기본값을 다 덮습니다', () => {
  /*
    ★★ 기본 수가표의 줄 중 하나라도 못 이으면 그 제품만 **옛 단가로** 남아
      조용히 어긋납니다. 줄을 더하거나 이름을 바꾸면 여기서 걸립니다.
  */
  it('기본 수가표의 모든 줄에 갈 곳이 있습니다', () => {
    for (const row of DEFAULT_PRICE_SHEET) {
      expect(SHEET_TO_PRODUCT[`${row.group}|${row.item}`], `${row.group}/${row.item}`).toBeDefined();
    }
  });
});
