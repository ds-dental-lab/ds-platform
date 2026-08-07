// =========================================================
// 놓을 위치: src/server/domain/duplicate/index.ts
//
// 한 치아에 보철을 두 개 올릴 수 있는가. (기능명세서 §4.2.7)
// 허용 조합은 셋뿐이고, 그 외에는 기존 항목을 덮어씁니다.
// =========================================================

/** 치아 하나에 올라간 보철 하나 */
export interface Placement {
  typeCode: string;      // crown / inlay / implant
  materialCode: string;  // zirconia / pmma / abut_pmma ...
}

/**
 * 허용 조합 3종. (기능명세서 §4.2.7)
 *
 *   크라운 지르코니아          + 크라운 PMMA
 *   임플란트 Abut+Zir(SCRP)    + 임플란트 Abut + PMMA
 *   임플란트 Abut+Zir(Cement)  + 임플란트 Abut + PMMA
 */
const ALLOWED_PAIRS: [Placement, Placement][] = [
  [
    { typeCode: 'crown', materialCode: 'zirconia' },
    { typeCode: 'crown', materialCode: 'pmma' },
  ],
  [
    { typeCode: 'implant', materialCode: 'abut_zir_scrp' },
    { typeCode: 'implant', materialCode: 'abut_pmma' },
  ],
  [
    { typeCode: 'implant', materialCode: 'abut_zir_cem' },
    { typeCode: 'implant', materialCode: 'abut_pmma' },
  ],
];

/** 한 치아에 올릴 수 있는 최대 개수 */
export const MAX_PER_TOOTH = 2;

function isSame(a: Placement, b: Placement): boolean {
  return a.typeCode === b.typeCode && a.materialCode === b.materialCode;
}

/**
 * 두 보철을 한 치아에 같이 둘 수 있는가.
 * ★ 순서는 상관없습니다. PMMA 를 먼저 놓고 지르코니아를 올려도 같은 조합입니다.
 */
export function isAllowedPair(a: Placement, b: Placement): boolean {
  return ALLOWED_PAIRS.some(
    ([x, y]) => (isSame(a, x) && isSame(b, y)) || (isSame(a, y) && isSame(b, x)),
  );
}

export type AddAction = 'add' | 'replace' | 'remove';

export interface AddResult {
  action: AddAction;
  placements: Placement[];
}

/**
 * 치아에 보철을 하나 올렸을 때 결과를 계산합니다.
 *
 *   빈 치아                        → add      [새것]
 *   같은 것을 다시 누름            → remove   []        (명세서 §4.2.5 토글 해제)
 *   허용 조합                      → add      [기존, 새것]
 *   허용되지 않는 조합             → replace  [새것]
 *   이미 2개인데 또 올림           → replace  [새것]
 */
export function addPlacement(
  current: Placement[],
  incoming: Placement,
): AddResult {
  // 빈 치아
  if (current.length === 0) {
    return { action: 'add', placements: [incoming] };
  }

  // 같은 조건으로 다시 누르면 해제됩니다
  const existingIndex = current.findIndex((p) => isSame(p, incoming));
  if (existingIndex >= 0) {
    return {
      action: 'remove',
      placements: current.filter((_, i) => i !== existingIndex),
    };
  }

  // ★ 이미 2개면 세 번째는 무조건 덮어씁니다
  if (current.length >= MAX_PER_TOOTH) {
    return { action: 'replace', placements: [incoming] };
  }

  // 1개 있는 상태 — 허용 조합인지 봅니다
  if (isAllowedPair(current[0], incoming)) {
    return { action: 'add', placements: [current[0], incoming] };
  }

  return { action: 'replace', placements: [incoming] };
}

/** 치식도에 2 배지를 붙일지 판단합니다 */
export function hasDuplicateBadge(placements: Placement[]): boolean {
  return placements.length >= 2;
}

/** 참고용 — 허용 조합 목록을 읽기만 합니다 */
export function getAllowedPairs(): readonly [Placement, Placement][] {
  return ALLOWED_PAIRS;
}
