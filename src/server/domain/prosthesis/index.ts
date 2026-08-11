// =========================================================
// 놓을 위치: src/server/domain/prosthesis/index.ts
//
// 보철물 종류와 재료 규칙. (기능명세서 §4.2.2)
// ★ Next.js 도 Supabase 도 모르는 순수 계산입니다.
// =========================================================

/**
 * ★ 세 가지로 묶어 두지 않습니다.
 *   제품을 표에서 읽으므로 디자인센터가 새 종류를 만들 수 있습니다.
 *   'crown' | 'inlay' | 'implant' 로 못 박으면 새 제품이 타입 오류가 됩니다.
 *
 *   대신 규칙이 걸린 세 가지(브릿지·임플란트 모델·치은포셀린)는
 *   아래 함수들이 코드 문자열로 판정합니다.
 */
export type ProsthesisTypeCode = string;

export interface Material {
  code: string;
  name: string;        // 화면에 보이는 이름
  abbr: string;        // 약칭 만들 때 쓰는 조각

  /**
   * 제품마다 다른 성질. (디자인센터 제품탭에서 정합니다)
   *
   * ★ 종류로 묶지 않습니다.
   *   '커스텀 어버트먼트' 는 임플란트인데 쉐이드도 폰틱도 없습니다.
   *   같은 종류 안에서도 달라, 종류로는 표현할 수 없습니다.
   */
  hasShade: boolean;
  hasPontic: boolean;
  hasPink: boolean;

  /** 비어 있으면 아직 안 정한 값입니다. 0 은 무료입니다 */
  price: number | null;
  ponticPrice: number | null;
  pinkPrice: number | null;
}

export interface ProsthesisType {
  code: ProsthesisTypeCode;
  name: string;
  abbr: string;

  /**
   * 종류마다 다른 성질. (제품탭에서 정합니다)
   *
   * ★ 코드에 박아 두면 종류를 늘릴 수 없습니다.
   *   덴쳐·교정을 넣는 순간 '임플란트면 …' 같은 규칙이 어디에 걸릴지
   *   알 수 없어집니다. 종류가 자기 성질을 들고 있어야 합니다.
   */
  needsImplantModel: boolean;
  /** 약칭에 재료 이름만 쓰는가. 켜면 'Zir-Cr' 대신 'Abut+Zir(SCRP)' */
  abbrMaterialOnly: boolean;

  color: string;
  colorSoft: string;

  materials: Material[];
}

/**
 * 보철 제품 목록. 디자인센터가 제품탭에서 관리합니다.
 *
 * ★ 이제 코드가 아니라 표에서 옵니다 (prosthesis_types / _materials).
 *   화면과 서비스가 이것을 인자로 받아 씁니다 — 임플란트 카탈로그와 같은 방식입니다.
 *   그래야 제품을 늘렸을 때 배포 없이 치과 화면에 나타납니다.
 */
export type ProsthesisCatalog = ProsthesisType[];

/** 최소 목록을 짧게 적기 위한 도우미. 안 준 값은 기본으로 둡니다 */
function mat(
  code: string,
  name: string,
  abbr: string,
  opts: { shade?: boolean; pontic?: boolean; pink?: boolean } = {},
): Material {
  return {
    code,
    name,
    abbr,
    hasShade: opts.shade ?? true,
    hasPontic: opts.pontic ?? false,
    hasPink: opts.pink ?? false,
    price: null,
    ponticPrice: null,
    pinkPrice: null,
  };
}

/**
 * 표를 못 읽었을 때 쓰는 최소 목록.
 *
 * ★ 이것을 정상 경로로 쓰지 않습니다.
 *   DB 가 잠깐 안 될 때 주문등록 화면이 통째로 비는 것을 막는 그물일 뿐입니다.
 *   여기 있는 세 종류는 마이그레이션이 표에 씨앗으로 넣은 것과 같습니다.
 */
export const FALLBACK_TYPES: ProsthesisCatalog = [
  {
    code: 'crown',
    name: '크라운',
    abbr: 'Cr',
    needsImplantModel: false,
    abbrMaterialOnly: false,
    color: '#E0409A',
    colorSoft: '#FCEAF3',
    materials: [
      mat('zirconia', '지르코니아', 'Zir',  { pontic: true, pink: true }),
      mat('pmma',     'PMMA',       'Pmma', { pontic: true, pink: true }),
    ],
  },
  {
    code: 'inlay',
    name: '인레이',
    abbr: 'In',
    needsImplantModel: false,
    abbrMaterialOnly: false,
    color: '#1B63E8',
    colorSoft: '#EDF3FE',
    materials: [
      mat('hybrid',   '하이브리드', 'Hy'),
      mat('zirconia', '지르코니아', 'Zir'),
    ],
  },
  {
    code: 'implant',
    name: '임플란트',
    abbr: 'Im',
    needsImplantModel: true,
    abbrMaterialOnly: true,
    color: '#7C6BE8',
    colorSoft: '#EDEBFB',
    // ★ 임플란트는 약칭을 만들지 않고 name 을 그대로 씁니다.
    //   그래서 abbr 에도 같은 값을 넣어 둡니다.
    materials: [
      mat('abut_zir_scrp', 'Abut+Zir(SCRP)',          'Abut+Zir(SCRP)',          { pontic: true, pink: true }),
      mat('abut_zir_cem',  'Abut + Zir(Cementation)', 'Abut + Zir(Cementation)', { pontic: true, pink: true }),
      mat('abut_pmma',     'Abut + PMMA',             'Abut + PMMA',             { pontic: true, pink: true }),
      // 커스텀 어버트먼트는 쉐이드도 폰틱도 없습니다
      mat('custom_abut',   '커스텀 어버트먼트',        'Custom Abutment',         { shade: false }),
    ],
  },
];

// ---------- 조회 ----------

export function getType(catalog: ProsthesisCatalog, typeCode: string): ProsthesisType | null {
  return catalog.find((t) => t.code === typeCode) ?? null;
}

/** 그 종류에서 고를 수 있는 재료 목록. 없는 종류면 빈 배열 */
export function getMaterials(catalog: ProsthesisCatalog, typeCode: string): Material[] {
  return getType(catalog, typeCode)?.materials ?? [];
}

export function getMaterial(
  catalog: ProsthesisCatalog,
  typeCode: string,
  materialCode: string,
): Material | null {
  return getMaterials(catalog, typeCode).find((m) => m.code === materialCode) ?? null;
}

// ---------- 종속 검증 ----------

/**
 * 이 종류에 이 재료를 붙일 수 있는가.
 * 재료는 종류에 종속됩니다 — 크라운에 하이브리드는 안 됩니다.
 */
export function isValidCombination(
  catalog: ProsthesisCatalog,
  typeCode: string,
  materialCode: string,
): boolean {
  return getMaterial(catalog, typeCode, materialCode) !== null;
}

/**
 * 종류를 바꿨을 때 고르던 재료를 유지해도 되는가.
 * 안 되면 화면에서 재료·모델 선택을 초기화해야 합니다. (명세서 §4.2.2)
 *
 *   크라운 지르코니아 → 인레이 로 변경 → 인레이에도 지르코니아가 있으니 유지 가능
 *   크라운 PMMA       → 인레이 로 변경 → 인레이에 PMMA 없음 → 초기화
 */
export function canKeepMaterial(
  catalog: ProsthesisCatalog,
  nextTypeCode: string,
  materialCode: string,
): boolean {
  return isValidCombination(catalog, nextTypeCode, materialCode);
}

// ---------- 약칭 ----------

/**
 * 화면과 요약 카드에 쓰는 약칭을 만듭니다.
 *
 *   지르코니아 + 크라운  →  Zir-Cr
 *   하이브리드 + 인레이  →  Hy-In
 *   임플란트             →  Abut+Zir(SCRP)   ← 재료 표기 그대로 (명세서 §4.2.2)
 */
export function buildAbbr(
  catalog: ProsthesisCatalog,
  typeCode: string,
  materialCode: string,
): string {
  const type = getType(catalog, typeCode);
  const material = getMaterial(catalog, typeCode, materialCode);

  // ★ 던지지 않고 코드를 그대로 돌려줍니다.
  //   제품탭에서 재료를 끄면 지난 주문이 그 조합을 가리킨 채 남습니다.
  //   목록 한 줄 때문에 화면 전체가 죽으면 안 됩니다.
  if (!type || !material) return `${typeCode}/${materialCode}`;

  // ★ 종류가 정합니다. '임플란트면' 이라고 코드에 적지 않습니다
  if (type.abbrMaterialOnly) return material.abbr;

  return `${material.abbr}-${type.abbr}`;
}

/**
 * 브릿지로 이어 붙일 수 있는 제품인가. (명세서 §4.2.6)
 *
 * ★ 제품에 물어봅니다. 종류로 판정하지 않습니다.
 *   폰틱이 되는 제품만 이어집니다 — 폰틱이 곧 다리의 가운데 칸입니다.
 */
export function isBridgeable(
  catalog: ProsthesisCatalog,
  typeCode: string,
  materialCode: string,
): boolean {
  return getMaterial(catalog, typeCode, materialCode)?.hasPontic ?? false;
}

/**
 * 쉐이드를 골라야 하는 제품인가.
 *
 * ★ 커스텀 어버트먼트처럼 색을 안 내는 제품이 있습니다.
 *   그런 제품은 치아를 눌러도 쉐이드창이 뜨지 않아야 합니다.
 */
export function requiresShade(
  catalog: ProsthesisCatalog,
  typeCode: string,
  materialCode: string,
): boolean {
  return getMaterial(catalog, typeCode, materialCode)?.hasShade ?? true;
}

/** 모델(제조사·타입 등) 선택이 필수인 종류인가 (명세서 §4.2.4) */
export function requiresImplantModel(
  catalog: ProsthesisCatalog,
  typeCode: string,
): boolean {
  return getType(catalog, typeCode)?.needsImplantModel ?? false;
}

// ---------- 표시 색 (시안 .proto --pc / --ps) ----------

/**
 * 보철 종류마다 고유한 색이 있습니다.
 * 칩·치식도·요약이 모두 같은 색을 씁니다 — 화면 어디서 보든 같은 것으로 읽히도록.
 */
const NO_COLOR = { line: '#4A5567', soft: '#F4F6F9' };

/**
 * 종류의 색. 제품탭에서 정합니다.
 *
 * ★ 목록에 없으면 회색입니다.
 *   제품을 끈 뒤에도 지난 주문이 그 종류를 가리키므로, 색을 못 찾았다고
 *   화면이 깨지면 안 됩니다.
 */
export function colorOfType(
  catalog: ProsthesisCatalog,
  typeCode: string,
): { line: string; soft: string } {
  const type = getType(catalog, typeCode);
  return type ? { line: type.color, soft: type.colorSoft } : NO_COLOR;
}

// ---------- 치은포셀린 ----------

/**
 * 핑크(치은) 포셀린을 붙일 수 있는가.
 *
 * ★ 제품에 물어봅니다. 인레이는 잇몸에 닿는 부위가 없어 기본으로 꺼져 있지만,
 *   그건 제품탭에서 정하는 값이지 코드가 정할 일이 아닙니다.
 *
 * 금액도 제품에 붙습니다 (pinkPrice).
 */
export function allowsGingival(
  catalog: ProsthesisCatalog,
  typeCode: string,
  materialCode: string,
): boolean {
  return getMaterial(catalog, typeCode, materialCode)?.hasPink ?? false;
}
