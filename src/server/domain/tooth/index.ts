// =========================================================
// 놓을 위치: src/server/domain/tooth/index.ts
//
// 치아 번호(FDI) 규칙.
// ★ 이 파일은 Next.js 도 Supabase 도 몰라야 합니다. (설계서 §6)
//   숫자를 넣으면 답이 나오는 계산기일 뿐입니다.
//   그래서 테스트로 정확히 검증할 수 있습니다.
// =========================================================

/**
 * FDI 치식 번호 읽는 법 — 두 자리 숫자입니다.
 *
 *   1 6
 *   │ └── 정중선에서 6번째 = 첫째 큰어금니
 *   └──── 1사분악 = 오른쪽 위
 *
 *   사분악        위치(1~8)
 *   1 오른쪽 위    1 중절치   5 제2소구치
 *   2 왼쪽 위      2 측절치   6 제1대구치
 *   3 왼쪽 아래    3 견치     7 제2대구치
 *   4 오른쪽 아래  4 제1소구치 8 지치(사랑니)
 */

export type Quadrant = 1 | 2 | 3 | 4;
export type Arch = 'upper' | 'lower';
export type Side = 'right' | 'left';

export type ToothType =
  | 'central_incisor'   // 중절치
  | 'lateral_incisor'   // 측절치
  | 'canine'            // 견치
  | 'first_premolar'    // 제1소구치
  | 'second_premolar'   // 제2소구치
  | 'first_molar'       // 제1대구치
  | 'second_molar'      // 제2대구치
  | 'third_molar';      // 지치

const TOOTH_TYPE_BY_POSITION: Record<number, ToothType> = {
  1: 'central_incisor',
  2: 'lateral_incisor',
  3: 'canine',
  4: 'first_premolar',
  5: 'second_premolar',
  6: 'first_molar',
  7: 'second_molar',
  8: 'third_molar',
};

export const TOOTH_TYPE_LABEL: Record<ToothType, string> = {
  central_incisor: '중절치',
  lateral_incisor: '측절치',
  canine: '견치',
  first_premolar: '제1소구치',
  second_premolar: '제2소구치',
  first_molar: '제1대구치',
  second_molar: '제2대구치',
  third_molar: '지치',
};

// ---------- 유효성 ----------

/** 11~48 사이의 실제 존재하는 치식 번호인가 */
export function isValidTooth(tooth: number): boolean {
  if (!Number.isInteger(tooth)) return false;

  const quadrant = Math.floor(tooth / 10);
  const position = tooth % 10;

  return quadrant >= 1 && quadrant <= 4 && position >= 1 && position <= 8;
}

function assertValid(tooth: number): void {
  if (!isValidTooth(tooth)) {
    throw new Error(`유효하지 않은 치식 번호입니다: ${tooth}`);
  }
}

// ---------- 분해 ----------

export function getQuadrant(tooth: number): Quadrant {
  assertValid(tooth);
  return Math.floor(tooth / 10) as Quadrant;
}

/** 정중선에서 몇 번째인가 (1~8) */
export function getPosition(tooth: number): number {
  assertValid(tooth);
  return tooth % 10;
}

export function getToothType(tooth: number): ToothType {
  return TOOTH_TYPE_BY_POSITION[getPosition(tooth)];
}

/** 위턱인가 아래턱인가 */
export function getArch(tooth: number): Arch {
  const q = getQuadrant(tooth);
  return q === 1 || q === 2 ? 'upper' : 'lower';
}

/** 환자 기준 좌우. 화면에서는 좌우를 뒤집어 그립니다 */
export function getSide(tooth: number): Side {
  const q = getQuadrant(tooth);
  return q === 1 || q === 4 ? 'right' : 'left';
}

/** 어금니 계열인가 (소구치 · 대구치 · 지치) */
export function isPosterior(tooth: number): boolean {
  return getPosition(tooth) >= 4;
}

/** 앞니 계열인가 (중절치 · 측절치 · 견치) */
export function isAnterior(tooth: number): boolean {
  return !isPosterior(tooth);
}

/**
 * 단가표가 쓰는 두 갈래. (설계서 Q-14, 사용자 확정 2026-08-11)
 *
 * ★ 전치는 1·2·3번, 나머지는 전부 구치입니다.
 *   견치(3번)가 전치에 들어갑니다 — 앞에서 보이는 치아라
 *   심미 작업이 들어가고 값이 다릅니다.
 *
 *   isPosterior 와 같은 경계를 씁니다. 두 곳에 따로 적으면
 *   어긋날 때 단가가 틀어집니다.
 */
export type ToothGroup = 'anterior' | 'posterior';

export function toothGroupOf(tooth: number): ToothGroup {
  return isPosterior(tooth) ? 'posterior' : 'anterior';
}

// ---------- 인접 판정 ----------
// 브릿지 자동 연결의 기준이 됩니다.

/**
 * 두 치아가 실제로 맞닿아 있는가.
 *
 * 규칙 셋
 *  1. 같은 사분악이면 위치가 1 차이 (16-17 ✓, 16-18 ✗)
 *  2. 정중선을 넘는 경우는 11-21(위), 41-31(아래) 둘뿐
 *  3. 위턱과 아래턱은 절대 인접하지 않음 (11-41 ✗)
 */
export function isAdjacent(a: number, b: number): boolean {
  assertValid(a);
  assertValid(b);
  if (a === b) return false;

  // 위턱 · 아래턱은 서로 닿지 않습니다
  if (getArch(a) !== getArch(b)) return false;

  const qa = getQuadrant(a);
  const qb = getQuadrant(b);
  const pa = getPosition(a);
  const pb = getPosition(b);

  // 같은 사분악 안에서는 위치가 1 차이
  if (qa === qb) return Math.abs(pa - pb) === 1;

  // 사분악이 다르면 정중선을 사이에 둔 앞니끼리만
  return pa === 1 && pb === 1;
}

/** 안쪽(정중선) 방향 이웃. 없으면 null */
export function getMesialNeighbor(tooth: number): number | null {
  const q = getQuadrant(tooth);
  const p = getPosition(tooth);

  if (p > 1) return q * 10 + (p - 1);

  // 중절치의 안쪽 이웃은 반대편 중절치입니다
  const across: Record<Quadrant, number> = { 1: 21, 2: 11, 3: 41, 4: 31 };
  return across[q];
}

/** 바깥(사랑니) 방향 이웃. 지치면 null */
export function getDistalNeighbor(tooth: number): number | null {
  const q = getQuadrant(tooth);
  const p = getPosition(tooth);
  return p < 8 ? q * 10 + (p + 1) : null;
}

/**
 * 치아들을 맞닿은 덩어리로 묶습니다.
 * 사이가 빈 치아는 건너뛰지 않습니다.
 *
 *   [16, 17, 18, 26]  →  [[16, 17, 18], [26]]
 *   [16, 18]          →  [[16], [18]]        17이 없으니 따로
 */
export function groupAdjacent(teeth: number[]): number[][] {
  const sorted = [...new Set(teeth)].filter(isValidTooth).sort(byArchOrder);

  const groups: number[][] = [];
  let current: number[] = [];

  for (const tooth of sorted) {
    if (current.length === 0 || isAdjacent(current[current.length - 1], tooth)) {
      current.push(tooth);
    } else {
      groups.push(current);
      current = [tooth];
    }
  }

  if (current.length > 0) groups.push(current);
  return groups;
}

/**
 * 치식도에 놓인 순서대로 정렬합니다.
 * 위턱 먼저, 각 턱 안에서는 오른쪽 지치 → 정중선 → 왼쪽 지치.
 *
 *   위: 18 17 … 12 11 | 21 22 … 27 28
 *   아래: 48 47 … 42 41 | 31 32 … 37 38
 */
export function byArchOrder(a: number, b: number): number {
  return archIndex(a) - archIndex(b);
}

function archIndex(tooth: number): number {
  const q = getQuadrant(tooth);
  const p = getPosition(tooth);

  // 1사분악과 4사분악은 지치(8)가 왼쪽 끝이므로 순서를 뒤집습니다
  const withinArch = q === 1 || q === 4 ? 8 - p : 8 + p;
  const archOffset = getArch(tooth) === 'upper' ? 0 : 100;

  return archOffset + withinArch;
}

// ---------- 표시용 ----------

/** 화면에 그릴 치아 번호 전체를 순서대로 돌려줍니다 */
export function getAllTeeth(): { upper: number[]; lower: number[] } {
  const upper = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  const lower = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
  return { upper, lower };
}

/** "16 (제1대구치, 오른쪽 위)" 같은 설명 */
export function describeTooth(tooth: number): string {
  const type = TOOTH_TYPE_LABEL[getToothType(tooth)];
  const side = getSide(tooth) === 'right' ? '오른쪽' : '왼쪽';
  const arch = getArch(tooth) === 'upper' ? '위' : '아래';
  return `${tooth} (${type}, ${side} ${arch})`;
}
