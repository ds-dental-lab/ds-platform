// =========================================================
// 놓을 위치: src/server/domain/shade/index.ts
//
// 쉐이드 체계와 이분할 로직. (기능명세서 §4.2.3, 설계서 §4.4)
// 색조 70개는 확정된 목록입니다.
// =========================================================

export type ShadeSystemCode = 'vita_classic' | 'vita_3d_master' | 'ivoclar';

/** 치아를 위아래로 나눈 부위 */
export type ToothPart = 'cervical' | 'incisal';   // 치경부 · 절단부

export interface ShadeSystem {
  code: ShadeSystemCode;
  name: string;
  isDefault: boolean;
  shades: string[];
}

// ---------- 확정 색조 70개 ----------

export const SHADE_SYSTEMS: ShadeSystem[] = [
  {
    code: 'vita_classic',
    name: 'Vita classic',
    isDefault: true,
    shades: [
      'A1', 'A2', 'A3', 'A3.5', 'A4',
      'B1', 'B2', 'B3', 'B3.5', 'B4',
      'C1', 'C2', 'C3', 'C3.5', 'C4',
      'D1', 'D2', 'D3', 'D3.5', 'D4',
    ],
  },
  {
    code: 'vita_3d_master',
    name: 'Vita 3D Master',
    isDefault: false,
    shades: [
      '1M1', '1M2',
      '2L1.5', '2L2.5', '2M1', '2M2', '2M3', '2R1.5', '2R2.5',
      '3L1.5', '3L2.5', '3M1', '3M2', '3M3', '3R1.5', '3R2.5',
      '4L1.5', '4L2.5', '4M1', '4M2', '4M3', '4R1.5', '4R2.5',
      '5M1', '5M2', '5M3',
    ],
  },
  {
    code: 'ivoclar',
    name: 'Ivoclar',
    isDefault: false,
    shades: [
      '01', '1A', '2A', '3A', '4A', 'BL1',
      '2B', '4B', '5B', '6B', 'BL2',
      '1C', '2C', '3C', '4C', '6C', 'BL3',
      '1D', '1E', '2E', '3E', '4E', '6E', 'BL4',
    ],
  },
];

// ---------- 조회 ----------

export function getSystem(code: string): ShadeSystem | null {
  return SHADE_SYSTEMS.find((s) => s.code === code) ?? null;
}

export function getDefaultSystem(): ShadeSystem {
  return SHADE_SYSTEMS.find((s) => s.isDefault) ?? SHADE_SYSTEMS[0];
}

export function getShades(systemCode: string): string[] {
  return getSystem(systemCode)?.shades ?? [];
}

/** 그 체계에 실제로 있는 색조인가 */
export function isValidShade(systemCode: string, shade: string): boolean {
  return getShades(systemCode).includes(shade);
}

/** 색조가 어느 체계에 속하는지 찾습니다 */
export function findSystemOf(shade: string): ShadeSystem | null {
  return SHADE_SYSTEMS.find((s) => s.shades.includes(shade)) ?? null;
}

// ---------- 치아에 입힌 색 ----------

/**
 * 치아 하나의 쉐이드 상태.
 * 위아래가 같으면 한 색, 다르면 이분할입니다.
 */
export interface ToothShade {
  cervical: string | null;   // 치경부 (위)
  incisal: string | null;    // 절단부 (아래)
}

export const EMPTY_SHADE: ToothShade = { cervical: null, incisal: null };

/** 위아래가 같은 색인가 */
export function isUniform(shade: ToothShade): boolean {
  return shade.cervical !== null && shade.cervical === shade.incisal;
}

/** 위아래가 다른가 (이분할) */
export function isSplit(shade: ToothShade): boolean {
  return (
    shade.cervical !== null &&
    shade.incisal !== null &&
    shade.cervical !== shade.incisal
  );
}

export function isEmpty(shade: ToothShade): boolean {
  return shade.cervical === null && shade.incisal === null;
}

// ---------- 이분할 적용 ----------

/**
 * 색조를 눌렀을 때. (명세서 §4.2.3)
 *
 *   비어 있으면        → 치아 전체에 적용
 *   이미 색이 있으면   → 적용하지 않고 '대기' 상태로 둡니다
 *                       사용자가 치아 위/아래를 눌러 부위를 지정합니다
 */
export function applyShade(current: ToothShade, shade: string): ToothShade {
  if (isEmpty(current)) {
    return { cervical: shade, incisal: shade };
  }
  return current;   // 그대로 두고, 부위 지정을 기다립니다
}

/** 치아의 위 또는 아래를 눌렀을 때 — 그 부위에만 적용 */
export function applyToPart(
  current: ToothShade,
  shade: string,
  part: ToothPart,
): ToothShade {
  return part === 'cervical'
    ? { ...current, cervical: shade }
    : { ...current, incisal: shade };
}

/** 치아 전체에 강제로 적용 */
export function applyToWhole(shade: string): ToothShade {
  return { cervical: shade, incisal: shade };
}

export function clearShade(): ToothShade {
  return { ...EMPTY_SHADE };
}

// ---------- 활성 표시 ----------

/**
 * ★ 활성(파란색) 표시는 항상 마지막에 누른 색조 하나에만 켜집니다.
 *   A2 를 눌렀다가 A3 를 누르면 A2 는 꺼져야 합니다.
 */
export function setActiveShade(shade: string | null): string | null {
  return shade;
}

export function isActive(activeShade: string | null, shade: string): boolean {
  return activeShade === shade;
}

// ---------- 표시 ----------

/**
 * 요약 카드에 쓰는 표기. (명세서 §4.2.5 — `Zir-Cr | 42, X, 31 (A3)`)
 *
 *   한 색이면        A3
 *   이분할이면       A3/A2      (치경부/절단부)
 *   비어 있으면      빈 문자열
 */
export function formatShade(shade: ToothShade): string {
  if (isEmpty(shade)) return '';
  if (isUniform(shade)) return shade.cervical!;

  const cervical = shade.cervical ?? '-';
  const incisal = shade.incisal ?? '-';
  return `${cervical}/${incisal}`;
}
