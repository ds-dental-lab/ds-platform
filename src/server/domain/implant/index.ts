// =========================================================
// 놓을 위치: src/server/domain/implant/index.ts
//
// 임플란트 계단식 선택 규칙. (기능명세서 §4.2.4)
//   제조사 → 타입 → 사이즈 · 스크류 → 옵션(자유 입력)
//   사이즈·스크류는 제조사가 아니라 타입에 딸립니다.
//
// ★ 마스터 데이터는 DB 에 있습니다 (implant_makers …, Sprint 6).
//   이 파일은 여전히 Next.js 도 Supabase 도 모릅니다 — 카탈로그를
//   인자로 받아 계산만 합니다. 그래서 테스트에서는 가짜 카탈로그를
//   넣어 규칙만 검증할 수 있습니다. (설계서 §6)
// =========================================================

export interface ImplantOption {
  code: string;
  name: string;
}

export interface ImplantType {
  code: string;
  name: string;
  sizes: ImplantOption[];    // 비어 있을 수 있습니다
  screws: ImplantOption[];   // 비어 있을 수 있습니다
}

export interface ImplantManufacturer {
  code: string;
  name: string;
  types: ImplantType[];
}

/** 제조사부터 스크류까지 한 덩어리. repositories/implant 가 만들어 줍니다 */
export type ImplantCatalog = ImplantManufacturer[];

// ---------- 선택 상태 ----------

export interface ImplantSelection {
  manufacturerCode: string | null;
  typeCode: string | null;
  sizeCode: string | null;
  screwCode: string | null;
  option: string;              // 자유 입력
}

export const EMPTY_SELECTION: ImplantSelection = {
  manufacturerCode: null,
  typeCode: null,
  sizeCode: null,
  screwCode: null,
  option: '',
};

// ---------- 조회 ----------
// 전부 카탈로그를 첫 인자로 받습니다. 이 파일은 데이터를 갖지 않습니다.

export function getManufacturer(
  catalog: ImplantCatalog,
  code: string | null,
): ImplantManufacturer | null {
  if (!code) return null;
  return catalog.find((m) => m.code === code) ?? null;
}

/** 그 제조사가 가진 타입만. 제조사를 안 골랐으면 빈 배열 */
export function getTypes(
  catalog: ImplantCatalog,
  manufacturerCode: string | null,
): ImplantType[] {
  return getManufacturer(catalog, manufacturerCode)?.types ?? [];
}

export function getType(
  catalog: ImplantCatalog,
  manufacturerCode: string | null,
  typeCode: string | null,
): ImplantType | null {
  if (!typeCode) return null;
  return getTypes(catalog, manufacturerCode).find((t) => t.code === typeCode) ?? null;
}

/** 사이즈·스크류는 타입에 딸립니다 */
export function getSizes(
  catalog: ImplantCatalog,
  manufacturerCode: string | null,
  typeCode: string | null,
): ImplantOption[] {
  return getType(catalog, manufacturerCode, typeCode)?.sizes ?? [];
}

export function getScrews(
  catalog: ImplantCatalog,
  manufacturerCode: string | null,
  typeCode: string | null,
): ImplantOption[] {
  return getType(catalog, manufacturerCode, typeCode)?.screws ?? [];
}

// ---------- 상위 변경 시 하위 초기화 ----------

/** 제조사를 바꾸면 아래가 전부 지워집니다 (명세서 §4.2.4) */
export function selectManufacturer(code: string): ImplantSelection {
  return { ...EMPTY_SELECTION, manufacturerCode: code };
}

/** 타입을 바꾸면 사이즈·스크류가 지워집니다. 옵션은 유지합니다 */
export function selectType(
  current: ImplantSelection,
  typeCode: string,
): ImplantSelection {
  return {
    ...current,
    typeCode,
    sizeCode: null,
    screwCode: null,
  };
}

// ---------- 완성 판정 ----------

/**
 * 주문을 진행할 수 있는가.
 *
 * ★ 고를 사이즈가 없는 타입은 사이즈 없이도 진행됩니다.
 *   "고를 게 없어서 빈 것"과 "고를 수 있는데 안 고른 것"은 다릅니다.
 */
export function isComplete(catalog: ImplantCatalog, selection: ImplantSelection): boolean {
  const { manufacturerCode, typeCode, sizeCode, screwCode } = selection;

  if (!manufacturerCode || !typeCode) return false;

  const sizes = getSizes(catalog, manufacturerCode, typeCode);
  if (sizes.length > 0 && !sizeCode) return false;

  const screws = getScrews(catalog, manufacturerCode, typeCode);
  if (screws.length > 0 && !screwCode) return false;

  return true;
}

/** 무엇이 비었는지 알려줍니다 */
export function getMissingStep(
  catalog: ImplantCatalog,
  selection: ImplantSelection,
): string | null {
  const { manufacturerCode, typeCode, sizeCode, screwCode } = selection;

  if (!manufacturerCode) return '제조사';
  if (!typeCode) return '타입';
  if (getSizes(catalog, manufacturerCode, typeCode).length > 0 && !sizeCode) return '사이즈';
  if (getScrews(catalog, manufacturerCode, typeCode).length > 0 && !screwCode) return '스크류';
  return null;
}

// ---------- 표시 ----------

function nameOf(list: ImplantOption[], code: string | null): string | null {
  if (!code) return null;
  return list.find((o) => o.code === code)?.name ?? null;
}

/**
 * 요약 표기 — `Osstem TS Regular Hex`
 * 비어 있는 단계는 아예 빠집니다.
 *
 * ★ 카탈로그에서 이름을 못 찾으면 코드를 그대로 씁니다.
 *   마스터에서 지워진 값이 옛 주문에 남아 있을 때, 화면이 비는 대신
 *   최소한 무엇이었는지는 보이게 하려는 것입니다.
 */
export function formatSelection(
  catalog: ImplantCatalog,
  selection: ImplantSelection,
): string {
  const { manufacturerCode, typeCode } = selection;

  const parts = [
    getManufacturer(catalog, manufacturerCode)?.name ?? manufacturerCode,
    getType(catalog, manufacturerCode, typeCode)?.name ?? typeCode,
    nameOf(getSizes(catalog, manufacturerCode, typeCode), selection.sizeCode) ??
      selection.sizeCode,
    nameOf(getScrews(catalog, manufacturerCode, typeCode), selection.screwCode) ??
      selection.screwCode,
    selection.option.trim() || null,
  ];

  return parts.filter(Boolean).join(' ');
}
