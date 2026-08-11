// =========================================================
// 놓을 위치: tests/fixtures/implant-catalog.ts
//
// 테스트용 임플란트 카탈로그.
//
// 실제 마스터는 DB(implant_makers …)에 있고, 그 시드와 같은 값입니다.
// 도메인 규칙은 데이터가 어디서 오든 같아야 하므로, 테스트는 DB 를
// 건드리지 않고 이 고정 값으로 규칙만 검증합니다. (설계서 §6)
//
// 시드를 바꾸면 여기도 같이 바꿔 주세요 —
// supabase/migrations/…_create_implant_masters.sql
// =========================================================

import type { ImplantCatalog } from '@/server/domain/implant';

export const CATALOG: ImplantCatalog = [
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
        // 사이즈 구분이 없는 타입 — 목록이 비어 있습니다
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
