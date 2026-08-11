// =========================================================
// 놓을 위치: src/server/domain/bridge/index.ts
//
// 인접치 자동 연결. (기능명세서 §4.2.6)
// tooth · prosthesis 모듈을 가져다 씁니다.
// =========================================================

import { isAdjacent, byArchOrder } from '../tooth';
import { isBridgeable, FALLBACK_TYPES, type ProsthesisCatalog } from '../prosthesis';

/** 치아 하나에 올라간 보철 하나. 중복 등록된 치아는 두 줄이 됩니다 */
export interface ToothPlacement {
  tooth: number;
  typeCode: string;
  materialCode: string;
  isPontic?: boolean;   // 폰틱은 번호 대신 X 로 표시됩니다
}

export interface BridgeLink {
  key: string;       // "16-17"
  from: number;
  to: number;
  forced: boolean;   // 폰틱이 낀 연결은 끊을 수 없습니다
}

export interface Bridge {
  typeCode: string;
  materialCode: string;
  teeth: number[];
  links: BridgeLink[];
  hasPontic: boolean;
}

// ---------- 연결 지점 이름 ----------

/** 두 치아 사이 연결에 붙이는 이름. 순서가 바뀌어도 같은 이름이 나옵니다 */
export function linkKey(a: number, b: number): string {
  const [first, second] = [a, b].sort(byArchOrder);
  return `${first}-${second}`;
}

// ---------- 연결 판정 ----------

/**
 * 두 보철을 이어 붙일 수 있는가.
 *
 *   인접해야 하고            (사이가 비면 안 됨)
 *   같은 종류 · 같은 재료여야 하고
 *   크라운이나 임플란트여야 합니다   (인레이 제외)
 *
 * 단, 한쪽이라도 폰틱이면 무조건 연결됩니다.
 */
export function canLink(
  a: ToothPlacement,
  b: ToothPlacement,
  /**
   * 제품 목록. 폰틱이 되는 제품만 이어집니다.
   *
   * ★ 안 주면 최소 목록으로 봅니다. 목록을 못 읽었다고 브릿지가
   *   통째로 사라지는 것보다, 씨앗과 같은 규칙으로 버티는 편이 낫습니다.
   */
  catalog: ProsthesisCatalog = FALLBACK_TYPES,
): boolean {
  if (!isAdjacent(a.tooth, b.tooth)) return false;
  if (a.typeCode !== b.typeCode) return false;
  if (a.materialCode !== b.materialCode) return false;

  // ★ 인레이는 브릿지 자체가 성립하지 않습니다.
  //   인레이 폰틱은 현실에 존재하지 않으므로 폰틱보다 이 규칙이 먼저입니다.
  if (!isBridgeable(catalog, a.typeCode, a.materialCode)) return false;

  // 폰틱은 혼자 설 수 없으므로 무조건 이어집니다
  return true;
}

/** 이 연결을 사용자가 끊을 수 있는가. 폰틱이 끼면 불가 */
export function isForcedLink(
  a: ToothPlacement,
  b: ToothPlacement,
  catalog: ProsthesisCatalog = FALLBACK_TYPES,
): boolean {
  // 폰틱이 안 되는 제품은 애초에 안 붙으므로 "끊을 수 없는 연결"도 될 수 없습니다
  if (!isBridgeable(catalog, a.typeCode, a.materialCode)) return false;
  return Boolean(a.isPontic || b.isPontic);
}

// ---------- 묶기 ----------

/**
 * 치식도 전체를 훑어 브릿지 덩어리를 계산합니다.
 *
 * @param placements 지금 치식도에 올라간 보철 전부
 * @param severedKeys 사용자가 − 버튼으로 끊어 둔 연결 지점
 *
 * ★ 판단 1 — 중복 등록된 치아는 종류·재료가 같은 것끼리만 묶습니다.
 *   16번에 지르코니아와 PMMA 가 둘 다 있으면
 *   지르코니아는 지르코니아끼리, PMMA 는 PMMA 끼리 계산합니다.
 */
export function computeBridges(
  placements: ToothPlacement[],
  severedKeys: string[] = [],
): Bridge[] {
  const severed = new Set(severedKeys);
  const bridges: Bridge[] = [];

  // 종류 + 재료 별로 나눠서 각각 계산합니다
  for (const layer of groupByMaterial(placements)) {
    const sorted = [...layer].sort((x, y) => byArchOrder(x.tooth, y.tooth));

    let current: ToothPlacement[] = [];
    let links: BridgeLink[] = [];

    const flush = () => {
      if (current.length >= 2) {
        bridges.push({
          typeCode: current[0].typeCode,
          materialCode: current[0].materialCode,
          teeth: current.map((p) => p.tooth),
          links,
          hasPontic: current.some((p) => p.isPontic),
        });
      }
      current = [];
      links = [];
    };

    for (const placement of sorted) {
      if (current.length === 0) {
        current = [placement];
        continue;
      }

      const prev = current[current.length - 1];
      const key = linkKey(prev.tooth, placement.tooth);
      const forced = isForcedLink(prev, placement);

      // 폰틱 연결은 사용자가 끊어 뒀더라도 무시하고 이어 붙입니다
      const isSevered = severed.has(key) && !forced;

      if (canLink(prev, placement) && !isSevered) {
        current.push(placement);
        links.push({ key, from: prev.tooth, to: placement.tooth, forced });
      } else {
        flush();
        current = [placement];
      }
    }

    flush();
  }

  return bridges;
}

function groupByMaterial(placements: ToothPlacement[]): ToothPlacement[][] {
  const map = new Map<string, ToothPlacement[]>();

  for (const p of placements) {
    const key = `${p.typeCode}|${p.materialCode}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }

  return [...map.values()];
}

// ---------- 버튼 판정 ----------

/** 이 연결 지점에 − 버튼을 보여줄지 */
export function canSever(bridge: Bridge, key: string): boolean {
  const link = bridge.links.find((l) => l.key === key);
  return link ? !link.forced : false;
}

/**
 * 끊어 둔 연결을 + 버튼으로 되붙일 수 있는지.
 * 끊긴 기록이 있고, 규칙상 이어질 수 있는 사이여야 합니다.
 *
 * ★ 판단 2 — 사용자가 끊은 기록은 그 자리에 계속 남습니다.
 *   16·17 을 끊은 뒤 18 을 추가해도 16·17 은 붙지 않습니다.
 */
export function canRejoin(
  a: ToothPlacement,
  b: ToothPlacement,
  severedKeys: string[],
): boolean {
  return severedKeys.includes(linkKey(a.tooth, b.tooth)) && canLink(a, b);
}

/** 치아가 어느 브릿지에 속하는지 찾습니다. 없으면 null */
export function findBridgeOf(
  bridges: Bridge[],
  tooth: number,
  typeCode: string,
  materialCode: string,
): Bridge | null {
  return (
    bridges.find(
      (b) =>
        b.typeCode === typeCode &&
        b.materialCode === materialCode &&
        b.teeth.includes(tooth),
    ) ?? null
  );
}
