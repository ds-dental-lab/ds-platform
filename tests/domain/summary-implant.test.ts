// =========================================================
// 놓을 위치: tests/domain/summary-implant.test.ts
//
// 한 주문에 임플란트 제조사가 둘 섞였을 때. (사용자 신고 2026-08-13 —
//   "A 치과에서 Osstem 으로 넣어주셨는데 디자인센터에서는 Neo로 나오는 경우")
//
// ★ 실제 자료에 그런 주문이 있습니다.
//   ORD-260813-001 — 21·11 은 Dentium, 14·13·12 는 Osstem.
//   요약 줄은 제품(종류/재료)으로만 묶으므로 다섯 개가 한 줄에 옵니다.
// =========================================================

import { describe, it, expect } from 'vitest';
import { buildSummaryLines } from '@/server/domain/summary';
import type { ImplantCatalog } from '@/server/domain/implant';

const CATALOG: ImplantCatalog = [
  {
    code: 'OST',
    name: 'Osstem',
    types: [
      {
        code: 'OST_SS',
        name: 'TS',
        sizes: [{ code: 'REG', name: 'Regular' }],
        screws: [{ code: 'HEX', name: 'Hex' }],
      },
    ],
  },
  {
    code: 'NEO',
    name: 'Neo',
    types: [
      {
        code: 'NEO_IS',
        name: 'IS-III',
        sizes: [{ code: 'REG', name: 'Regular' }],
        screws: [{ code: 'HEX', name: 'Hex' }],
      },
    ],
  },
];

const place = (tooth: number) => ({
  tooth,
  typeCode: 'implant',
  materialCode: 'zirconia',
  isPontic: false,
});

const sel = (maker: string, type: string) => ({
  manufacturerCode: maker,
  typeCode: type,
  sizeCode: 'REG',
  screwCode: 'HEX',
  option: '',
});

describe('제조사가 섞인 주문', () => {
  const lines = () =>
    buildSummaryLines({
      placements: [place(13), place(14), place(23)],
      implants: {
        13: sel('OST', 'OST_SS'),
        14: sel('OST', 'OST_SS'),
        23: sel('NEO', 'NEO_IS'),
      },
      implantCatalog: CATALOG,
    });

  it('★ 어느 치아가 어느 회사인지 알 수 있어야 한다', () => {
    const label = lines()[0].implantLabel;

    // 23 번이 Neo 라는 것이 글에서 읽혀야 합니다
    expect(label).toContain('Neo');
    expect(label).toContain('Osstem');
    expect(label).toMatch(/23/);
    expect(label).toMatch(/13/);
  });

  it('★ 제조사만 나열해서는 안 된다 — 치식이 없으면 뒤바뀐 것을 못 봅니다', () => {
    // 전에는 'Osstem TS Regular Hex / Neo IS-III Regular Hex' 였습니다.
    // 치식이 하나도 안 붙어, 읽는 사람이 앞의 것을 전체로 오해했습니다.
    expect(lines()[0].implantLabel).not.toBe(
      'Osstem TS Regular Hex / Neo IS-III Regular Hex',
    );
  });
});

describe('제조사가 하나면 예전 그대로', () => {
  it('치식을 안 붙이고 모델만 적는다', () => {
    const [line] = buildSummaryLines({
      placements: [place(13), place(14)],
      implants: { 13: sel('OST', 'OST_SS'), 14: sel('OST', 'OST_SS') },
      implantCatalog: CATALOG,
    });

    expect(line.implantLabel).toBe('Osstem TS Regular Hex');
  });

  it('임플란트가 아니면 빈 값', () => {
    const [line] = buildSummaryLines({
      placements: [place(13)],
      implants: {},
      implantCatalog: CATALOG,
    });

    expect(line.implantLabel).toBe('');
  });
});
