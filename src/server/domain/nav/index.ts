// =========================================================
// 놓을 위치: src/server/domain/nav/index.ts
//
// 사이드바에 무엇이 보이는가. (사용자 결정 2026-08-12)
//
// ★ 컴포넌트 안에 있던 것을 여기로 옮겼습니다.
//   "치과 사용자에게 정산이 보이는가" 는 **규칙**인데, 컴포넌트 안에
//   있으면 테스트가 못 닿습니다. 실제로 한 번 어긋났습니다 —
//   금액이냐 아니냐로 한 번에 잘랐다가 치과·기공소의 정산까지 닫혔고,
//   그걸 잡아 준 것은 테스트가 아니라 사용자였습니다.
//
// ★ 섹터마다 다릅니다. 한 줄로 못 자릅니다.
//   치과·기공소 사용자는 **정산까지 그대로 보고** 사용자탭만 빠집니다.
//   디자인센터 사용자(디자이너)는 만드는 일만 하므로 훨씬 좁습니다.
//
// ★ 그림(아이콘)은 여기 없습니다.
//   이름으로만 가리키고 실제 그림은 화면이 붙입니다. 규칙을 테스트하려고
//   React 를 끌어오면 그 테스트는 곧 안 돌게 됩니다.
// =========================================================

import type { Sector } from '../order-status';

export type NavIcon =
  | 'home'
  | 'new'
  | 'list'
  | 'delivery'
  | 'billing'
  | 'users'
  | 'product'
  | 'holiday'
  | 'implant'
  | 'approve'
  | 'board';

export interface NavItem {
  label: string;
  href?: string;
  icon: NavIcon;
  /** 아직 안 만든 화면 */
  soon?: string;
  /**
   * 사용자에게 안 보이는 메뉴인가.
   *
   * ★ 숨기는 것만으로는 부족합니다. 주소를 바로 치면 열립니다.
   *   여기 true 인 메뉴의 화면에는 requireManagerSector 가 있어야 하고,
   *   그것을 테스트가 지킵니다 (tests/domain/nav.test.ts).
   */
  staffHidden?: boolean;
}

// 시안 순서 그대로입니다
export const NAV: Record<Sector, NavItem[]> = {
  clinic: [
    { label: 'HOME', href: '/clinic', icon: 'home' },
    { label: '주문등록', href: '/clinic/orders/new', icon: 'new' },
    { label: '주문목록', href: '/clinic/orders', icon: 'list' },
    { label: '배송조회', href: '/clinic/deliveries', icon: 'delivery' },
    { label: '정산', href: '/clinic/billing', icon: 'billing' },
    { label: '사용자', href: '/clinic/users', icon: 'users', staffHidden: true },
    { label: '게시판', href: '/clinic/notices', icon: 'board' },
  ],
  design_center: [
    { label: 'HOME', href: '/design', icon: 'home' },
    { label: '주문등록', href: '/design/orders/new', icon: 'new' },
    { label: '주문목록', href: '/design/orders', icon: 'list' },
    { label: '배송조회', href: '/design/deliveries', icon: 'delivery' },
    { label: '정산관리', href: '/design/billing', icon: 'billing', staffHidden: true },
    { label: '사용자', href: '/design/users', icon: 'users', staffHidden: true },
    { label: '가입승인', href: '/design/signups', icon: 'approve', staffHidden: true },
    { label: '제품', href: '/design/products', icon: 'product', staffHidden: true },
    { label: '휴일', href: '/design/holidays', icon: 'holiday', staffHidden: true },
    { label: '임플란트', href: '/design/implants', icon: 'implant', staffHidden: true },
    { label: '통계', href: '/design/stats', icon: 'billing', staffHidden: true },
    { label: '게시판', href: '/design/notices', icon: 'board' },
  ],
  lab: [
    { label: 'HOME', href: '/lab', icon: 'home' },
    { label: '주문목록', href: '/lab/orders', icon: 'list' },
    { label: '배송조회', href: '/lab/shipments', icon: 'delivery' },
    { label: '정산', href: '/lab/billing', icon: 'billing' },
    { label: '사용자', href: '/lab/users', icon: 'users', staffHidden: true },
    { label: '제품', href: '/lab/products', icon: 'product', staffHidden: true },
    { label: '게시판', href: '/lab/notices', icon: 'board' },
  ],
};

/**
 * 이 사람에게 보이는 메뉴.
 *
 * ★ 감춘 메뉴는 흐리게가 아니라 **아예 없습니다.**
 *   흐리게 두면 "왜 안 눌리냐" 를 묻습니다.
 */
export function visibleNav(sector: Sector, isManager: boolean): NavItem[] {
  return NAV[sector].filter((item) => !item.staffHidden || isManager);
}

/** 사용자에게 감춘 주소들 — 화면에 문이 달렸는지 테스트가 이걸로 봅니다 */
export function hiddenHrefs(sector: Sector): string[] {
  return NAV[sector]
    .filter((item) => item.staffHidden && item.href)
    .map((item) => item.href as string);
}
