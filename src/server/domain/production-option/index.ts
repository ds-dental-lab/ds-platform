// =========================================================
// 놓을 위치: src/server/domain/production-option/index.ts
//
// 주문에 붙일 제작옵션을 정합니다. (기능명세서 §4.2.8 — 훅 · 폰틱타입)
//
// ★★ **화면이 보낸 것만 믿지 않습니다** (2026-11-18, 사용자 "왜 제작옵션이 없지").
//   주문서는 옵션 목록을 받아 기본값을 미리 골라 둡니다. 그런데 그 목록을 못 받은 채
//   화면이 뜨면 고를 칸 자체가 없어, **옵션이 하나도 없는 주문**이 조용히 들어갔습니다
//   (11-11 부터 9건). 서버가 목록을 다시 읽어 빠진 그룹을 기본값으로 채웁니다.
//
// ★ 기본값은 주문서가 미리 골라 두는 것과 같은 규칙입니다 —
//   기본 표시가 붙은 값, 없으면 첫 값. 손대지 않고 저장한 주문과 똑같은 결과입니다.
// ★ 없는 그룹이나 그 그룹의 것이 아닌 값은 버리고 기본값을 씁니다.
//   한 줄이라도 틀리면 DB 가 묶음 전체를 거절하기 때문입니다.
// =========================================================

export interface OptionGroupRule {
  id: string;
  values: { id: string; isDefault: boolean }[];
}

/** 그룹마다 한 값. 고른 것이 맞으면 그것을, 아니면 기본값을 씁니다 */
export function resolveOrderOptions(
  groups: OptionGroupRule[],
  chosen: Record<string, string> | undefined,
): Record<string, string> {
  const resolved: Record<string, string> = {};

  for (const group of groups) {
    const picked = chosen?.[group.id];
    const valid = picked && group.values.some((v) => v.id === picked);
    const fallback = (group.values.find((v) => v.isDefault) ?? group.values[0])?.id;
    const value = valid ? picked : fallback;
    if (value) resolved[group.id] = value;
  }

  return resolved;
}
