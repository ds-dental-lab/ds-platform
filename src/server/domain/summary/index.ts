// =========================================================
// 놓을 위치: src/server/domain/summary/index.ts
//
// 요약 카드 한 줄 만들기. (기능명세서 §4.2.5, §4.2.7)
//   Zir-Cr | 42, X, 31 (A3)
//
// 중복 등록된 치아는 두 줄로 나뉩니다.
// =========================================================

import { byArchOrder } from '../tooth';
import { buildAbbr } from '../prosthesis';
import { formatShade, EMPTY_SHADE, type ToothShade } from '../shade';
import { formatSelection, type ImplantCatalog, type ImplantSelection } from '../implant';
import type { ToothPlacement } from '../bridge';

export interface SummaryLine {
  key: string;
  typeCode: string;
  materialCode: string;
  abbr: string;            // Zir-Cr
  teeth: number[];         // 정렬된 치식 번호
  teethLabel: string;      // "42, X, 31"  — 폰틱은 X
  shadeLabel: string;      // "A3" 또는 "A3/A2"
  implantLabel: string;    // "Osstem TS Regular Hex"
  text: string;            // 한 줄 전체
}

export interface SummaryInput {
  placements: ToothPlacement[];
  /** 치아별 쉐이드. 한 줄 안에서 서로 다르면 치아마다 따로 적습니다 */
  shades?: Record<number, ToothShade>;
  /** 치아별 임플란트 모델 */
  implants?: Record<number, ImplantSelection>;
  /** 임플란트 코드를 이름으로 바꾸는 데 씁니다. 없으면 코드가 그대로 보입니다 */
  implantCatalog?: ImplantCatalog;
}

/**
 * 요약 줄을 만듭니다.
 * ★ 종류·재료가 같은 것끼리 한 줄입니다.
 *   그래서 중복 등록된 치아는 자연히 두 줄로 나뉩니다. (명세서 §4.2.7)
 */
export function buildSummaryLines({
  placements,
  shades = {},
  implants = {},
  implantCatalog = [],
}: SummaryInput): SummaryLine[] {
  const groups = new Map<string, ToothPlacement[]>();

  for (const placement of placements) {
    const key = `${placement.typeCode}|${placement.materialCode}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(placement);
  }

  const lines: SummaryLine[] = [];

  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => byArchOrder(a.tooth, b.tooth));
    const [typeCode, materialCode] = key.split('|');

    const abbr = buildAbbr(typeCode, materialCode);
    const teethLabel = sorted
      .map((p) => (p.isPontic ? 'X' : String(p.tooth)))
      .join(', ');

    const shadeLabel = summarizeShades(sorted, shades);
    const implantLabel = summarizeImplants(sorted, implants, implantCatalog);

    const parts = [`${abbr} | ${teethLabel}`];
    if (shadeLabel) parts.push(`(${shadeLabel})`);
    if (implantLabel) parts.push(`- ${implantLabel}`);

    lines.push({
      key,
      typeCode,
      materialCode,
      abbr,
      teeth: sorted.map((p) => p.tooth),
      teethLabel,
      shadeLabel,
      implantLabel,
      text: parts.join(' '),
    });
  }

  return lines;
}

/**
 * 한 줄 안의 쉐이드를 정리합니다.
 * 전부 같으면 하나로, 다르면 치아마다 적습니다.
 * 폰틱은 쉐이드를 따지지 않습니다.
 */
function summarizeShades(
  placements: ToothPlacement[],
  shades: Record<number, ToothShade>,
): string {
  const labels = placements
    .filter((p) => !p.isPontic)
    .map((p) => formatShade(shades[p.tooth] ?? EMPTY_SHADE))
    .filter(Boolean);

  if (labels.length === 0) return '';

  const unique = [...new Set(labels)];
  return unique.length === 1 ? unique[0] : unique.join(', ');
}

/** 임플란트 모델도 같은 방식으로 정리합니다 */
function summarizeImplants(
  placements: ToothPlacement[],
  implants: Record<number, ImplantSelection>,
  catalog: ImplantCatalog,
): string {
  const labels = placements
    .filter((p) => !p.isPontic && implants[p.tooth])
    .map((p) => formatSelection(catalog, implants[p.tooth]))
    .filter(Boolean);

  if (labels.length === 0) return '';

  const unique = [...new Set(labels)];
  return unique.length === 1 ? unique[0] : unique.join(' / ');
}

/** 초기화 버튼을 빨간색으로 강조할지 (명세서 §4.2.5) */
export function shouldHighlightReset(placements: ToothPlacement[]): boolean {
  return placements.length > 0;
}

/** 선택된 치아 개수. 폰틱도 셉니다 */
export function countTeeth(placements: ToothPlacement[]): number {
  return new Set(placements.map((p) => p.tooth)).size;
}
