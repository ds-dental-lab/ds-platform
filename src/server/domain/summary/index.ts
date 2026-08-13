// =========================================================
// 놓을 위치: src/server/domain/summary/index.ts
//
// 요약 카드 한 줄 만들기. (기능명세서 §4.2.5, §4.2.7)
//   Zir-Cr | 42, X, 31 (A3)
//
// 중복 등록된 치아는 두 줄로 나뉩니다.
// =========================================================

import { byArchOrder } from '../tooth';
import { buildAbbr, FALLBACK_TYPES, type ProsthesisCatalog } from '../prosthesis';
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
  /**
   * 보철 제품 목록. 약칭(Zir-Cr)을 만드는 데 씁니다.
   *
   * ★ 안 주면 최소 목록으로 버팁니다.
   *   제품탭에서 재료를 끄면 지난 주문이 그 조합을 가리킨 채 남는데,
   *   이름을 못 찾아도 코드를 그대로 찍어 화면이 죽지는 않습니다.
   */
  catalog?: ProsthesisCatalog;
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
  catalog = FALLBACK_TYPES,
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

    const abbr = buildAbbr(catalog, typeCode, materialCode);
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

/**
 * 임플란트 모델.
 *
 * ★ 쉐이드와 달리 **치식을 붙여야 합니다** (사용자 신고 2026-08-13 —
 *   "Osstem 으로 넣어주셨는데 디자인센터에서는 Neo로 나오는 경우").
 *
 *   전에는 쉐이드와 똑같이 서로 다르면 그냥 이어 붙였습니다 —
 *     `Osstem TS Regular Hex / Neo IS-III Regular Hex`
 *   어느 치아가 어느 회사인지가 **글에서 사라집니다.** 읽는 사람은
 *   앞의 것을 그 줄 전체로 읽고, 그대로 다른 회사 픽스처로 만듭니다.
 *
 * ★ 쉐이드는 틀려도 색이 조금 다를 뿐이지만, 임플란트는 **안 맞으면
 *   물리적으로 안 들어갑니다.** 같은 규칙을 쓰면 안 되는 자리였습니다.
 *
 * ★ 하나뿐이면 예전 그대로 모델만 적습니다. 치식은 이미 줄 앞에
 *   있어서 두 번 적으면 군더더기입니다.
 */
function summarizeImplants(
  placements: ToothPlacement[],
  implants: Record<number, ImplantSelection>,
  catalog: ImplantCatalog,
): string {
  // 모델별로 치아를 모읍니다. 먼저 나온 차례를 지킵니다
  const byLabel = new Map<string, number[]>();

  for (const placement of placements) {
    if (placement.isPontic) continue;

    const selection = implants[placement.tooth];
    if (!selection) continue;

    const label = formatSelection(catalog, selection);
    if (!label) continue;

    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label)!.push(placement.tooth);
  }

  if (byLabel.size === 0) return '';

  const entries = [...byLabel.entries()];
  if (entries.length === 1) return entries[0][0];

  return entries.map(([label, teeth]) => `${teeth.join(', ')} ${label}`).join(' / ');
}

/** 초기화 버튼을 빨간색으로 강조할지 (명세서 §4.2.5) */
export function shouldHighlightReset(placements: ToothPlacement[]): boolean {
  return placements.length > 0;
}

/** 선택된 치아 개수. 폰틱도 셉니다 */
export function countTeeth(placements: ToothPlacement[]): number {
  return new Set(placements.map((p) => p.tooth)).size;
}
