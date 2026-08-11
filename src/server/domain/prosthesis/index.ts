// =========================================================
// 놓을 위치: src/server/domain/prosthesis/index.ts
//
// 보철물 종류와 재료 규칙. (기능명세서 §4.2.2)
// ★ Next.js 도 Supabase 도 모르는 순수 계산입니다.
// =========================================================

export type ProsthesisTypeCode = 'crown' | 'inlay' | 'implant';

export interface Material {
  code: string;
  name: string;        // 화면에 보이는 이름
  abbr: string;        // 약칭 만들 때 쓰는 조각
}

export interface ProsthesisType {
  code: ProsthesisTypeCode;
  name: string;
  abbr: string;
  materials: Material[];
}

// ---------- 마스터 ----------
// 나중에 DB 로 옮기더라도 이 모양 그대로 씁니다.

export const PROSTHESIS_TYPES: ProsthesisType[] = [
  {
    code: 'crown',
    name: '크라운',
    abbr: 'Cr',
    materials: [
      { code: 'zirconia', name: '지르코니아', abbr: 'Zir' },
      { code: 'pmma',     name: 'PMMA',       abbr: 'Pmma' },
    ],
  },
  {
    code: 'inlay',
    name: '인레이',
    abbr: 'In',
    materials: [
      { code: 'hybrid',   name: '하이브리드', abbr: 'Hy' },
      { code: 'zirconia', name: '지르코니아', abbr: 'Zir' },
    ],
  },
  {
    code: 'implant',
    name: '임플란트',
    abbr: 'Im',
    // ★ 임플란트는 약칭을 만들지 않고 name 을 그대로 씁니다.
    //   그래서 abbr 에도 같은 값을 넣어 둡니다.
    materials: [
      { code: 'abut_zir_scrp', name: 'Abut+Zir(SCRP)',          abbr: 'Abut+Zir(SCRP)' },
      { code: 'abut_zir_cem',  name: 'Abut + Zir(Cementation)', abbr: 'Abut + Zir(Cementation)' },
      { code: 'abut_pmma',     name: 'Abut + PMMA',             abbr: 'Abut + PMMA' },
      { code: 'custom_abut',   name: '커스텀 어버트먼트',        abbr: 'Custom Abutment' },
    ],
  },
];

// ---------- 조회 ----------

export function getType(typeCode: string): ProsthesisType | null {
  return PROSTHESIS_TYPES.find((t) => t.code === typeCode) ?? null;
}

/** 그 종류에서 고를 수 있는 재료 목록. 없는 종류면 빈 배열 */
export function getMaterials(typeCode: string): Material[] {
  return getType(typeCode)?.materials ?? [];
}

export function getMaterial(typeCode: string, materialCode: string): Material | null {
  return getMaterials(typeCode).find((m) => m.code === materialCode) ?? null;
}

// ---------- 종속 검증 ----------

/**
 * 이 종류에 이 재료를 붙일 수 있는가.
 * 재료는 종류에 종속됩니다 — 크라운에 하이브리드는 안 됩니다.
 */
export function isValidCombination(typeCode: string, materialCode: string): boolean {
  return getMaterial(typeCode, materialCode) !== null;
}

/**
 * 종류를 바꿨을 때 고르던 재료를 유지해도 되는가.
 * 안 되면 화면에서 재료·모델 선택을 초기화해야 합니다. (명세서 §4.2.2)
 *
 *   크라운 지르코니아 → 인레이 로 변경 → 인레이에도 지르코니아가 있으니 유지 가능
 *   크라운 PMMA       → 인레이 로 변경 → 인레이에 PMMA 없음 → 초기화
 */
export function canKeepMaterial(nextTypeCode: string, materialCode: string): boolean {
  return isValidCombination(nextTypeCode, materialCode);
}

// ---------- 약칭 ----------

/**
 * 화면과 요약 카드에 쓰는 약칭을 만듭니다.
 *
 *   지르코니아 + 크라운  →  Zir-Cr
 *   하이브리드 + 인레이  →  Hy-In
 *   임플란트             →  Abut+Zir(SCRP)   ← 재료 표기 그대로 (명세서 §4.2.2)
 */
export function buildAbbr(typeCode: string, materialCode: string): string {
  const type = getType(typeCode);
  const material = getMaterial(typeCode, materialCode);

  if (!type || !material) {
    throw new Error(`잘못된 조합입니다: ${typeCode} / ${materialCode}`);
  }

  // 임플란트만 예외입니다
  if (type.code === 'implant') return material.abbr;

  return `${material.abbr}-${type.abbr}`;
}

/** 브릿지 자동 연결 대상인가. 인레이는 연결되지 않습니다 (명세서 §4.2.6) */
export function isBridgeable(typeCode: string): boolean {
  return typeCode === 'crown' || typeCode === 'implant';
}

/** 임플란트 모델(제조사·타입 등) 선택이 필수인가 (명세서 §4.2.4) */
export function requiresImplantModel(typeCode: string): boolean {
  return typeCode === 'implant';
}

// ---------- 표시 색 (시안 .proto --pc / --ps) ----------

/**
 * 보철 종류마다 고유한 색이 있습니다.
 * 칩·치식도·요약이 모두 같은 색을 씁니다 — 화면 어디서 보든 같은 것으로 읽히도록.
 */
export const TYPE_COLOR: Record<string, { line: string; soft: string }> = {
  crown:   { line: '#E0409A', soft: '#FCEAF3' },
  inlay:   { line: '#1B63E8', soft: '#EDF3FE' },
  implant: { line: '#7C6BE8', soft: '#EDEBFB' },
};

export function colorOfType(typeCode: string): { line: string; soft: string } {
  return TYPE_COLOR[typeCode] ?? { line: '#4A5567', soft: '#F4F6F9' };
}

// ---------- 치은포셀린 ----------

/**
 * 치은포셀린을 붙일 수 있는가.
 *
 * ★ 인레이에는 붙지 않습니다.
 *   인레이는 치아 안쪽을 메우는 것이라 잇몸에 닿는 부위가 없습니다.
 *
 * 추가 과금 항목이라 금액은 디자인센터가 정합니다 (surcharge_prices).
 */
export function allowsGingival(typeCode: string): boolean {
  return typeCode !== 'inlay';
}
