// =========================================================
// 놓을 위치: src/server/domain/worklist/index.ts
//
// HOME 왼쪽 아래 '내 일' 목록 — 무엇이 오르고 누구에게 보이는가.
//
// ★ 저장소 안에 있던 것을 여기로 옮겼습니다.
//   "디자인센터 사용자는 본인 것만" 은 규칙인데, repositories 안에
//   한 줄로 있으면 테스트가 못 닿습니다. 이 프로젝트에서 규칙은
//   도메인에 두고 테스트로 잠급니다.
//
// ★ 관리자는 전부 봅니다.
//   누가 얼마나 잡고 있는지가 관리의 일입니다.
//
// ★ 사용자는 자기 것만.
//   남의 일까지 보이면 무엇이 내 몫인지 흐려집니다.
//
// ★ **세 섹터가 다 씁니다** (사용자 결정 2026-08-13 — "계정마다 화면이
//   제각각이다"). 전에는 디자인센터에만 있어서, 사용자 계정으로 들어가면
//   왼쪽 칸에 카드가 하나뿐이라 관리자 화면의 절반도 안 되는 페이지가
//   됐습니다(327px 대 766px). 이제 어느 계정으로 들어와도 왼쪽 칸
//   맨 아래에 같은 모양의 목록이 섭니다.
// =========================================================

import type { OrderStatus, Sector } from '@/server/domain/order-status';

export interface WorklistRow {
  /**
   * 이 줄의 **임자**. 못 찾았으면 null.
   *
   * 섹터마다 누가 임자인지가 다릅니다 — `ownerOf` 가 정합니다.
   */
  ownerId: string | null;
  /** 잡은 지(들어온 지) 며칠째인가 */
  dayCount: number;
  /** 요청시한 */
  dueDate: string;
}

/**
 * 이 목록을 세우는 섹터. **치과는 안 세웁니다** (사용자 요청 2026-08-13).
 *
 * ★ 치과는 만드는 쪽이 아니라 **기다리는 쪽**입니다. 진행 상황은
 *   '진행중 상태' 숫자와 주문목록으로 충분하고, 같은 것을 목록으로
 *   한 번 더 펼치면 화면만 길어집니다 (사용자 판단).
 *
 * ★ 그 대신 치과 사용자 계정은 왼쪽 칸이 다시 짧아집니다.
 *   금액·추이·이 목록이 다 없으므로 남는 것은 진행중 상태·이슈뿐입니다.
 *   그때는 그 카드가 남는 높이를 가져갑니다 (HomeScreen 의 grow 판단) —
 *   안 그러면 왼쪽 칸만 먼저 끝나 세 칸이 어긋납니다.
 */
export const WORK_SECTORS: Sector[] = ['design_center', 'lab'];

/**
 * 어떤 상태가 '아직 내 손에 있는 일' 인가. 섹터마다 다릅니다.
 *
 * ★ 치과는 넣은 뒤로 **끝날 때까지** 자기 일입니다. 물건을 기다리는
 *   쪽이라 어느 단계에 있든 궁금합니다.
 * ★ 디자인센터는 **디자인을 잡은 동안**만입니다. 제작주문으로 넘기면
 *   그때부터 기공소의 일입니다.
 * ★ 기공소는 **제작대기·제작** 입니다. 배송으로 넘어가면 손을 뗍니다.
 */
export const WORK_STATUSES: Record<Sector, OrderStatus[]> = {
  clinic: ['rescan', 'received', 'designing', 'production_wait', 'production', 'shipping'],
  design_center: ['designing'],
  lab: ['production_wait', 'production'],
};

/**
 * 섹터마다 카드에 붙는 이름과 빈 칸에 쓰는 말.
 *
 * ★ 이름에 **'내'** 를 안 씁니다. 같은 카드를 관리자는 조직 전체로,
 *   사용자는 자기 것만 봅니다. '내가 넣은 주문' 이라고 붙이면 열네 건을
 *   보고 있는 관리자에게는 거짓말이 됩니다.
 */
export const WORK_LABEL: Record<Sector, { title: string; empty: string }> = {
  clinic: { title: '진행 중인 주문', empty: '진행 중인 주문이 없습니다.' },
  design_center: { title: '작업 리스트', empty: '진행 중인 작업이 없습니다.' },
  lab: { title: '제작 중', empty: '제작 중인 주문이 없습니다.' },
};

/**
 * 이 줄의 임자가 누구인가.
 *
 * ★ **기공소는 임자가 없습니다(null).** 사람 단위로 배정하지 않고
 *   조직 단위로 받습니다(`lab_org_id`). 없는 주인을 지어내면 사용자
 *   계정에서 목록이 늘 비어 보입니다 — 기공소는 관리자든 사용자든
 *   **같은 목록**을 봅니다. 그게 실제 일하는 모양입니다.
 */
export function ownerOf(
  sector: Sector,
  row: { designerId: string | null; createdBy: string | null },
): string | null {
  if (sector === 'design_center') return row.designerId;
  if (sector === 'clinic') return row.createdBy;

  return null;
}

/**
 * 이 사람에게 보이는 줄.
 *
 * ★ 임자가 없는 줄(ownerId null)은 사용자에게 안 보입니다 —
 *   **임자라는 것이 있는 섹터에서만** 그렇습니다. '내 것' 이라고 말할
 *   근거가 없으니까요. 관리자에게는 보입니다 — 주인 없는 일이 있다는
 *   것 자체가 관리자가 알아야 할 사실입니다.
 *
 * ★ 기공소처럼 임자를 안 두는 섹터는 사용자도 전부 봅니다.
 *   `ownerless` 로 그 뜻을 분명히 받습니다 — 안 그러면 기공소
 *   사용자에게 목록이 통째로 안 보입니다.
 *
 * ★ 보는 사람을 모르면(viewerId null) 아무것도 안 보여 줍니다.
 *   모를 때 다 보여 주는 쪽으로 기울면, 언젠가 세션이 덜 읽힌 순간에
 *   남의 일이 통째로 보입니다.
 */
export function visibleWork<T extends WorklistRow>(
  rows: T[],
  viewerId: string | null,
  isManager: boolean,
  ownerless = false,
): T[] {
  if (isManager) return rows;
  if (ownerless) return rows;
  if (!viewerId) return [];

  return rows.filter((row) => row.ownerId === viewerId);
}

/**
 * 오래 잡고 있는 것부터. 같은 날이면 요청시한이 이른 것부터.
 *
 * ★ 이 목록은 '무엇이 급한가' 가 아니라 '무엇이 안 끝나고 있는가' 를
 *   보는 자리입니다. 급한 것은 주문목록의 D-day 가 봅니다.
 */
export function sortWork<T extends WorklistRow>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => b.dayCount - a.dayCount || a.dueDate.localeCompare(b.dueDate),
  );
}
