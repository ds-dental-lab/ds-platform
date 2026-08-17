// =========================================================
// 놓을 위치: tests/domain/nav.test.ts
// 기준: 사용자 결정 2026-08-12 — 섹터마다 감추는 메뉴가 다름
//
// ★ 이 파일은 **사용자가 준 목록을 그대로 못 박습니다.**
//   한 번 어긋난 적이 있습니다 — '금액이냐 아니냐' 로 한 번에 잘랐다가
//   치과·기공소의 정산까지 닫혔고, 그걸 잡아 준 것은 테스트가 아니라
//   사용자였습니다. 다시 그러지 않게 여기 적어 둡니다.
// =========================================================

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { NAV, visibleNav, hiddenHrefs } from '@/server/domain/nav';
import type { Sector } from '@/server/domain/order-status';

const labels = (sector: Sector, isManager: boolean) =>
  visibleNav(sector, isManager).map((i) => i.label);

describe('관리자는 다 봅니다', () => {
  it('감추는 것 없이 그대로', () => {
    for (const sector of ['clinic', 'design_center', 'lab'] as const) {
      expect(labels(sector, true)).toEqual(NAV[sector].map((i) => i.label));
    }
  });
});

describe('사용자에게 보이는 메뉴 — 사용자가 준 목록 그대로', () => {
  // *"치과 사용자 ... 사용자 탭도 블라인드, 나머지는 완전 똑같이"*
  it('★ 치과 사용자는 사용자탭만 빠집니다 — 정산은 그대로 봅니다', () => {
    expect(labels('clinic', false)).toEqual([
      'HOME',
      '주문등록',
      '주문목록',
      '배송조회',
      '정산',
      '게시판',
    ]);
  });

  // *"기공소 사용자 ... 사용자 탭도 블라인드"*
  it('★ 기공소 사용자도 정산은 그대로 봅니다', () => {
    expect(labels('lab', false)).toEqual([
      'HOME',
      '주문목록',
      '배송조회',
      '정산',
      '게시판',
    ]);
  });

  // *"사용자 탭, 정산관리탭, 제품탭, 휴일탭, 임플란트탭, 통계탭 블라인드처리"*
  it('★ 디자인센터 사용자는 만드는 일만 봅니다', () => {
    expect(labels('design_center', false)).toEqual([
      'HOME',
      '주문등록',
      '주문목록',
      '배송조회',
      '게시판',
    ]);
  });

  it('주문·배송·게시판은 세 섹터 모두 사용자에게 열려 있습니다', () => {
    for (const sector of ['clinic', 'design_center', 'lab'] as const) {
      expect(labels(sector, false)).toContain('주문목록');
      expect(labels(sector, false)).toContain('배송조회');
      expect(labels(sector, false)).toContain('게시판');
    }
  });
});

// =========================================================
// ★ 메뉴를 숨기는 것과 못 들어가는 것은 다릅니다.
//   주소를 바로 치면 열립니다. 실제로 임플란트 화면이 그랬습니다 —
//   메뉴만 감추고 문은 안 달아서 주소로는 들어갔습니다.
//   이 테스트가 그걸 지킵니다.
// =========================================================

describe('★ 감춘 메뉴에는 문이 달려 있어야 합니다', () => {
  const ROOT = path.join(process.cwd(), 'src', 'app');

  /** '/design/holidays' → 그 화면 파일의 내용 */
  function pageSource(href: string): string | null {
    // '/design/...' 은 app 폴더에서 'design/...' 입니다
    const file = path.join(ROOT, href.replace(/^\//, ''), 'page.tsx');

    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  }

  for (const sector of ['clinic', 'design_center', 'lab'] as const) {
    for (const href of hiddenHrefs(sector)) {
      it(`${href} — 화면이 있고 requireManagerSector 를 부릅니다`, () => {
        const source = pageSource(href);

        expect(source, `${href} 에 page.tsx 가 없습니다`).not.toBeNull();
        expect(
          source!.includes('requireManagerSector'),
          `${href} 는 메뉴에서 감췄는데 화면에 문이 없습니다 — 주소를 치면 열립니다`,
        ).toBe(true);
      });
    }
  }

  // 개수만 세면 하나 늘고 하나 줄어도 통과합니다. 목록을 그대로 적습니다
  it('감춘 주소 목록', () => {
    expect(hiddenHrefs('clinic')).toEqual(['/clinic/users']);
    expect(hiddenHrefs('lab')).toEqual(['/lab/users', '/lab/products']);
    expect(hiddenHrefs('design_center')).toEqual([
      '/design/billing',
      '/design/users',
      '/design/signups',
      '/design/contacts',
      '/design/products',
      '/design/holidays',
      '/design/implants',
      '/design/fit-values',
      '/design/stats',
    ]);
  });
});
