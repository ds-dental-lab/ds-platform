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
  /**
   * 자동 출력 제품(FlowTemp)인가 — 제품 표의 auto_pipeline.
   * ★ 코드('auto_temp')로 알아보지 않습니다. 제품이 자기 성질을 들고 옵니다.
   */
  autoPipeline?: boolean;
}

/**
 * FlowTemp 가 짝으로 붙을 수 있는 최종 보철 종류.
 *
 * ★★ **FlowTemp 는 최종 보철물과 같이 주문할 때만** 넣습니다 (사용자 결정
 *   2026-10-15, 과금 1안). 같은 스캔으로 크라운을 만들고, 그 사이에 쓸
 *   임시치아를 치과 프린터가 뽑습니다. 돈은 크라운으로 받습니다.
 * ★ 지금은 **크라운만**입니다 — 목표가 '싱글 크라운 하나 완벽하게, 그다음
 *   브릿지·임플란트' 이고, 덴트버드 매크로도 크라운만 봅니다. 임플란트를
 *   열 때 여기에 'implant' 를 넣습니다.
 * ★ 아직 시험 중인 제품입니다 (2026-10-15 — 디자인 오류·교합/컨택 값·재출력이
 *   안 정해짐). 그래서 치과 목록에서는 감춰 두고(is_internal) 시험 치과만 봅니다.
 */
export const AUTO_PARTNER_TYPES: readonly string[] = ['crown'];

function isAutoPair(a: Placement, b: Placement): boolean {
  const [auto, other] = a.autoPipeline ? [a, b] : [b, a];
  return Boolean(auto.autoPipeline) && !other.autoPipeline && AUTO_PARTNER_TYPES.includes(other.typeCode);
}

export interface PairingItem {
  tooth: number;
  typeCode: string;
  isPontic: boolean;
  autoPipeline: boolean;
}

/**
 * 짝(같은 치아의 최종 크라운)이 없는 FlowTemp 의 치식. 다 짝이 있으면 null.
 *
 * ★ 폰틱 크라운도 짝입니다 (사용자 2026-10-19 — "FlowTemp 도 폰틱이 존재해"). 임시
 *   브릿지는 가운데 폰틱까지 한 덩어리로 뽑습니다. 전에는 "지대치가 있어야" 로 뺐는데,
 *   그러면 브릿지 케이스의 가운데 이에 FlowTemp 를 못 넣었습니다.
 */
export function unpairedAutoTooth(items: PairingItem[]): number | null {
  for (const it of items) {
    if (!it.autoPipeline) continue;
    const paired = items.some(
      (o) =>
        o.tooth === it.tooth &&
        !o.autoPipeline &&
        AUTO_PARTNER_TYPES.includes(o.typeCode),
    );
    if (!paired) return it.tooth;
  }
  return null;
}

/**
 * 짝(같은 치아의 최종 크라운)이 **있는** FlowTemp 의 치식들 — 정산에서 0원이 되는 줄 (2026-10-21).
 *
 * ★★ 과금 2안 (사용자 결정 2026-10-21): FlowTemp 는 **값 하나에 규칙 하나**.
 *   임시치아 1개 제품가(8,000원), 그 치아의 크라운을 함께 주문하면 0원.
 *   전에는 짝 없는 FlowTemp 를 저장에서 **막았는데**(과금 1안), 스캐너 장기 계약 등으로
 *   크라운을 못 주는 치과가 많아 임시치아만도 받기로 했습니다. 막기 → 값 매기기.
 * ★ "무료"는 **그 치아** 크라운에만 묶입니다. 다른 치아 크라운 하나로 임시치아 여럿을
 *   무료로 받는 길을 막는 것이 이 함수의 치아 단위 비교입니다.
 * ★ 폰틱 크라운도 짝입니다 (unpairedAutoTooth 와 같은 규칙).
 */
export function pairedAutoTeeth(items: PairingItem[]): number[] {
  const teeth = new Set<number>();
  for (const it of items) {
    if (!it.autoPipeline) continue;
    const paired = items.some(
      (o) => o.tooth === it.tooth && !o.autoPipeline && AUTO_PARTNER_TYPES.includes(o.typeCode),
    );
    if (paired) teeth.add(it.tooth);
  }
  return [...teeth].sort((a, b) => a - b);
}

/**
 * 「FlowTemp 함께」 스위치가 켜졌을 때 FlowTemp 를 **더 얹어야 할 치아들** (사용자 요청 2026-10-19).
 *
 * ★ 짝이 되는 최종 크라운(폰틱 포함)은 있는데 FlowTemp 가 아직 없는 치아입니다.
 *   스위치는 "크라운 찍을 때 FlowTemp 도 같이" 라는 뜻이라, 짝 없는 치아에는 안 얹습니다 —
 *   과금 1안(크라운과 함께만)을 스위치가 깨지 않게. 폰틱 크라운이면 FlowTemp 도 폰틱으로
 *   얹습니다(얹는 쪽이 isPontic 을 따라갑니다).
 * ★ 차례는 치식 번호 순 — 어느 순서로 찍었든 같은 결과가 나오게.
 */
export function teethNeedingCompanion(items: PairingItem[]): number[] {
  const teeth = new Set<number>();
  for (const it of items) {
    if (it.autoPipeline || !AUTO_PARTNER_TYPES.includes(it.typeCode)) continue;
    const has = items.some((o) => o.tooth === it.tooth && o.autoPipeline);
    if (!has) teeth.add(it.tooth);
  }
  return [...teeth].sort((a, b) => a - b);
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
  // ★ 최종 크라운 + FlowTemp (2026-10-15) — 제품 성질로 봅니다
  if (isAutoPair(a, b)) return true;
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
