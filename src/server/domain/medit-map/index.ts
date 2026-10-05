// =========================================================
// 놓을 위치: src/server/domain/medit-map/index.ts
//
// 메딧의 말을 덴플로우 제품으로 옮기기 (사용자 요청 2026-10-05).
//
// ★★ **두 길이 같은 표를 씁니다.** 메딧에서 보철 정보를 받는 길이 둘입니다 —
//   내보내기에 딸려 오는 **PDF**(지금 바로 됨)와 **메딧 OpenAPI**(파트너 승인
//   필요). 둘 다 쓰는 낱말이 같습니다: 크라운 / 풀컨투어 / 지르코니아 / A1.
//   그래서 옮기는 표를 먼저 만들어 둡니다 — 어느 길로 가든 안 버립니다.
//
// ★ 덴플로우 제품은 **표에 있습니다**(prosthesis_types·materials, 디자인센터가
//   고칩니다). 그래서 여기서는 **코드만** 가리킵니다. 없는 코드를 가리키면
//   맞추기가 실패하고, 화면은 사람에게 고르라고 합니다 — 넘겨짚지 않습니다.
//
// ★ 못 맞추면 **비워 둡니다.** 엉뚱한 제품이 찍힌 주문서보다, 빈 칸이 낫습니다.
//   틀린 값은 사람이 못 알아보고 그대로 넘어갑니다.
// =========================================================

import type { ShadeSystemCode } from '@/server/domain/shade';
import { SHADE_SYSTEMS } from '@/server/domain/shade';

/** 메딧이 주는 값 (PDF 든 API 든 같은 낱말입니다) */
export interface MeditProduct {
  /** 유형 — 'CROWN' · '크라운' */
  category: string;
  /** 방식 — 'ANATOMIC' · '풀컨투어' · 'SCREW_TYPE' */
  method: string;
  /** 재료 — 'ZIRCONIA' · '지르코니아' */
  material: string;
  /** 셰이드 — 'A1' */
  shade: string;
  /** 치식 */
  tooth: number;
}

export interface MappedProduct {
  tooth: number;
  typeCode: string;
  materialCode: string;
  /** 쉐이드를 알아봤을 때만 */
  shadeSystem: ShadeSystemCode | null;
  shade: string | null;
  isPontic: boolean;
}

export interface MapResult {
  mapped: MappedProduct[];
  /** 못 맞춘 줄 — 화면이 "이건 직접 골라 주세요" 로 보여 줍니다 */
  unmatched: { tooth: number; text: string }[];
}

function squeeze(value: string): string {
  return (value ?? '').replace(/[\s_\-+]/g, '').toUpperCase();
}

/** 한 낱말이 이 보기들 중 하나인가 */
function has(value: string, words: string[]): boolean {
  const v = squeeze(value);
  return words.some((w) => v.includes(squeeze(w)));
}

/*
  ---------------------------------------------------------
  옮기는 규칙.

  ★ 왼쪽은 메딧 낱말(영문 코드와 한글 둘 다), 오른쪽은 **덴플로우 제품 코드**
    입니다. 제품을 늘리면 여기도 한 줄 늘리면 됩니다.
  ★ 임플란트는 재료가 아니라 **방식**이 제품을 가릅니다 — 같은 지르코니아라도
    SCRP 와 Cementation 이 다른 값입니다.
  ---------------------------------------------------------
*/

const PONTIC_WORDS = ['PONTIC', '폰틱'];

/** 임플란트 쪽인가 */
const IMPLANT_WORDS = ['IMPLANTCROWN', '임플란트', 'CUSTOMABUTMENT', '커스텀어버트먼트'];

/**
 * 종류만 가립니다 — 재료를 모를 때 (사용자 요청 2026-10-05).
 *
 * ★ DS Core 주문 목록에는 '크라운 · 13, 12, 11' 처럼 **종류와 치식만** 옵니다.
 *   재료(지르코니아·PMMA)는 안 옵니다. 그래도 종류를 미리 골라 두면 사람이
 *   재료 하나만 누르면 됩니다 — 아무것도 안 고르는 것보다 낫습니다.
 * ★ 임플란트는 돌려주지 않습니다. 덴플로우 임플란트는 재료가 곧 방식이라
 *   (SCRP·Cementation) 종류만으로는 고를 것이 정해지지 않습니다.
 */
export function mapCategory(category: string): string | null {
  if (has(category, IMPLANT_WORDS)) return null;
  if (has(category, ['INLAY', '인레이', 'ONLAY', '온레이'])) return 'inlay';
  if (has(category, ['CROWN', '크라운', 'PONTIC', '폰틱', 'COPING', '코핑'])) return 'crown';
  return null;
}

export function mapProduct(input: MeditProduct): MappedProduct | null {
  const { category, method, material } = input;

  const shadeSystem = SHADE_SYSTEMS.find((s) => s.shades.includes(input.shade?.trim() ?? ''));
  const shade = shadeSystem ? input.shade.trim() : null;
  const isPontic = has(category, PONTIC_WORDS) || has(method, PONTIC_WORDS);

  const base = {
    tooth: input.tooth,
    shadeSystem: (shadeSystem?.code ?? null) as ShadeSystemCode | null,
    shade,
    isPontic,
  };

  // ---------- 임플란트 ----------
  if (has(category, IMPLANT_WORDS)) {
    // 커스텀 어버트먼트만 따로 — 쉐이드도 폰틱도 없는 제품입니다
    if (has(category, ['CUSTOMABUTMENT', '커스텀어버트먼트']) && !has(category, ['CROWN', '크라운'])) {
      return { ...base, typeCode: 'implant', materialCode: 'custom_abut', shadeSystem: null, shade: null };
    }

    if (has(material, ['PMMA'])) {
      return { ...base, typeCode: 'implant', materialCode: 'abut_pmma' };
    }

    if (has(material, ['ZIRCONIA', '지르코니아'])) {
      // ★ 방식이 제품을 가릅니다. 모르면 비웁니다 — 둘 중 아무거나 찍지 않습니다
      if (has(method, ['SCRP', 'SCREWTYPE', '스크류'])) {
        return { ...base, typeCode: 'implant', materialCode: 'abut_zir_scrp' };
      }
      if (has(method, ['CEMENTATION', '시멘', '시멘테이션'])) {
        return { ...base, typeCode: 'implant', materialCode: 'abut_zir_cem' };
      }
    }

    return null;
  }

  // ---------- 인레이·온레이 ----------
  if (has(category, ['INLAY', '인레이', 'ONLAY', '온레이'])) {
    if (has(material, ['ZIRCONIA', '지르코니아'])) {
      return { ...base, typeCode: 'inlay', materialCode: 'zirconia' };
    }
    if (has(material, ['HYBRID', '하이브리드', 'COMPOSITE', '레진'])) {
      return { ...base, typeCode: 'inlay', materialCode: 'hybrid' };
    }
    return null;
  }

  // ---------- 크라운 (폰틱·브릿지도 크라운 제품으로 들어옵니다) ----------
  if (has(category, ['CROWN', '크라운', 'PONTIC', '폰틱', 'COPING', '코핑'])) {
    if (has(material, ['ZIRCONIA', '지르코니아'])) {
      return { ...base, typeCode: 'crown', materialCode: 'zirconia' };
    }
    if (has(material, ['PMMA'])) {
      return { ...base, typeCode: 'crown', materialCode: 'pmma' };
    }
    return null;
  }

  return null;
}

/**
 * 여러 줄을 한꺼번에.
 *
 * ★ 가리키는 제품 코드가 **지금 제품표에 있는지** 확인합니다. 디자인센터가
 *   제품을 지웠거나 코드를 바꿨으면, 맞췄다고 하면 안 됩니다.
 */
export function mapProducts(
  rows: MeditProduct[],
  catalog: { code: string; materials: { code: string }[] }[],
): MapResult {
  const mapped: MappedProduct[] = [];
  const unmatched: { tooth: number; text: string }[] = [];

  for (const row of rows) {
    const hit = mapProduct(row);
    const type = hit && catalog.find((t) => t.code === hit.typeCode);
    const ok = hit && type && type.materials.some((m) => m.code === hit.materialCode);

    if (ok && hit) {
      mapped.push(hit);
    } else {
      unmatched.push({
        tooth: row.tooth,
        text: [row.category, row.method, row.material, row.shade].filter(Boolean).join(' · '),
      });
    }
  }

  return { mapped, unmatched };
}
