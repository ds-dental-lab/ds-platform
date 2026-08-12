// =========================================================
// 놓을 위치: src/server/domain/worklist/index.ts
//
// 작업 리스트에 누구의 것이 보이는가. (사용자 결정 2026-08-12)
//
// ★ 저장소 안에 있던 것을 여기로 옮겼습니다.
//   "디자인센터 사용자는 본인 것만" 은 규칙인데, repositories 안에
//   한 줄로 있으면 테스트가 못 닿습니다. 이 프로젝트에서 규칙은
//   도메인에 두고 테스트로 잠급니다.
//
// ★ 관리자는 전부 봅니다.
//   누가 얼마나 잡고 있는지가 관리의 일입니다.
//
// ★ 사용자는 자기가 잡은 것만.
//   남의 일까지 보이면 무엇이 내 몫인지 흐려집니다.
// =========================================================

export interface WorklistRow {
  /** 디자인을 잡은 사람. 못 찾았으면 null */
  designerId: string | null;
  /** 잡은 지 며칠째인가 */
  dayCount: number;
  /** 요청시한 */
  dueDate: string;
}

/**
 * 이 사람에게 보이는 줄.
 *
 * ★ 누가 잡았는지 모르는 줄(designerId null)은 사용자에게 안 보입니다.
 *   '내 것' 이라고 말할 근거가 없습니다. 관리자에게는 보입니다 —
 *   주인 없는 일이 있다는 것 자체가 관리자가 알아야 할 사실입니다.
 *
 * ★ 보는 사람을 모르면(viewerId null) 아무것도 안 보여 줍니다.
 *   모를 때 다 보여 주는 쪽으로 기울면, 언젠가 세션이 덜 읽힌 순간에
 *   남의 일이 통째로 보입니다.
 */
export function visibleWork<T extends WorklistRow>(
  rows: T[],
  viewerId: string | null,
  isManager: boolean,
): T[] {
  if (isManager) return rows;
  if (!viewerId) return [];

  return rows.filter((row) => row.designerId === viewerId);
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
