// =========================================================
// 놓을 위치: src/server/domain/implant/index.ts
//
// 임플란트 계단식 선택 규칙. (기능명세서 §4.2.4)
//   제조사 → 타입 → 사이즈 · 스크류 → 옵션(자유 입력)
//   사이즈·스크류는 제조사가 아니라 타입에 딸립니다.
//
// ★ 실제 마스터 데이터는 Sprint 6 에서 DB 로 옮깁니다.
//   여기 있는 값은 동작 확인용 예시입니다.
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

// ---------- 예시 마스터 ----------

export const MANUFACTURERS: ImplantManufacturer[] = [
  {
    code: 'OST',
    name: 'Osstem',
    types: [
      {
        code: 'OST_KS',
        name: 'KS',
        sizes: [
          { code: 'OST_KS_MINI', name: 'Mini' },
          { code: 'OST_KS_REG', name: 'Regular' },
        ],
        screws: [
          { code: 'OST_KS_HEX', name: 'Hex' },
          { code: 'OST_KS_NHEX', name: 'Non-Hex' },
        ],
      },
      {
        code: 'OST_SS',
        name: 'SS',
        sizes: [
          { code: 'OST_SS_MINI', name: 'Mini' },
          { code: 'OST_SS_REG', name: 'Regular' },
          { code: 'OST_SS_WIDE', name: 'Wide' },
        ],
        screws: [
          { code: 'OST_SS_OCTA', name: 'Octa' },
          { code: 'OST_SS_NOCTA', name: 'Non-Octa' },
        ],
      },
      {
        code: 'OST_TS',
        name: 'TS',
        sizes: [
          { code: 'OST_TS_MINI', name: 'Mini' },
          { code: 'OST_TS_REG', name: 'Regular' },
        ],
        screws: [
          { code: 'OST_TS_HEX', name: 'Hex' },
          { code: 'OST_TS_NHEX', name: 'Non-Hex' },
        ],
      },
      {
        // 사이즈 구분이 없는 타입 — 목록을 비워 둡니다
        code: 'OST_US',
        name: 'US',
        sizes: [],
        screws: [
          { code: 'OST_US_HEX', name: 'Hex' },
          { code: 'OST_US_NHEX', name: 'Non-Hex' },
        ],
      },
    ],
  },
  {
    code: 'DTM',
    name: 'Dentium',
    types: [
      {
        code: 'DTM_SL',
        name: 'Super Line',
        sizes: [{ code: 'DTM_SL_REG', name: 'Regular' }],
        screws: [
          { code: 'DTM_SL_HEX', name: 'Hex' },
          { code: 'DTM_SL_NHEX', name: 'Non-Hex' },
        ],
      },
      {
        code: 'DTM_SL2',
        name: 'Super Line 2',
        sizes: [{ code: 'DTM_SL2_REG', name: 'Regular' }],
        screws: [
          { code: 'DTM_SL2_HEX', name: 'Hex' },
          { code: 'DTM_SL2_NHEX', name: 'Non-Hex' },
        ],
      },
    ],
  },
  {
    code: 'NBT',
    name: 'Neobiotech',
    types: [
      {
        code: 'NBT_IS',
        name: 'IS',
        sizes: [
          { code: 'NBT_IS_REG', name: 'Regular' },
          { code: 'NBT_IS_WIDE', name: 'Wide' },
        ],
        screws: [
          { code: 'NBT_IS_HEX', name: 'Hex' },
          { code: 'NBT_IS_NHEX', name: 'Non-Hex' },
        ],
      },
    ],
  },
];

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

export function getManufacturer(code: string | null): ImplantManufacturer | null {
  if (!code) return null;
  return MANUFACTURERS.find((m) => m.code === code) ?? null;
}

/** 그 제조사가 가진 타입만. 제조사를 안 골랐으면 빈 배열 */
export function getTypes(manufacturerCode: string | null): ImplantType[] {
  return getManufacturer(manufacturerCode)?.types ?? [];
}

export function getType(
  manufacturerCode: string | null,
  typeCode: string | null,
): ImplantType | null {
  if (!typeCode) return null;
  return getTypes(manufacturerCode).find((t) => t.code === typeCode) ?? null;
}

/** 사이즈·스크류는 타입에 딸립니다 */
export function getSizes(
  manufacturerCode: string | null,
  typeCode: string | null,
): ImplantOption[] {
  return getType(manufacturerCode, typeCode)?.sizes ?? [];
}

export function getScrews(
  manufacturerCode: string | null,
  typeCode: string | null,
): ImplantOption[] {
  return getType(manufacturerCode, typeCode)?.screws ?? [];
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
export function isComplete(selection: ImplantSelection): boolean {
  const { manufacturerCode, typeCode, sizeCode, screwCode } = selection;

  if (!manufacturerCode || !typeCode) return false;

  const sizes = getSizes(manufacturerCode, typeCode);
  if (sizes.length > 0 && !sizeCode) return false;

  const screws = getScrews(manufacturerCode, typeCode);
  if (screws.length > 0 && !screwCode) return false;

  return true;
}

/** 무엇이 비었는지 알려줍니다 */
export function getMissingStep(selection: ImplantSelection): string | null {
  const { manufacturerCode, typeCode, sizeCode, screwCode } = selection;

  if (!manufacturerCode) return '제조사';
  if (!typeCode) return '타입';
  if (getSizes(manufacturerCode, typeCode).length > 0 && !sizeCode) return '사이즈';
  if (getScrews(manufacturerCode, typeCode).length > 0 && !screwCode) return '스크류';
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
 */
export function formatSelection(selection: ImplantSelection): string {
  const { manufacturerCode, typeCode } = selection;

  const parts = [
    getManufacturer(manufacturerCode)?.name,
    getType(manufacturerCode, typeCode)?.name,
    nameOf(getSizes(manufacturerCode, typeCode), selection.sizeCode),
    nameOf(getScrews(manufacturerCode, typeCode), selection.screwCode),
    selection.option.trim() || null,
  ];

  return parts.filter(Boolean).join(' ');
}
