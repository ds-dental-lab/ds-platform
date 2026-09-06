// =========================================================
// 놓을 위치: src/app/(mobile)/m/orders/page.tsx
//
// 센터 폰 — 주문 찾기. (사용자 요청 2026-09-06)
//
// ★ 디자이너도 씁니다. 전화는 누구에게나 옵니다.
// ★ 석 달치를 통째로 내려 주고 브라우저가 좁힙니다 — 전화 중에 글자마다
//   서버 왕복을 기다릴 수 없습니다 (domain/center-mobile).
// =========================================================

import { requireSector } from '@/server/policies/session';
import { listOrderPage } from '@/server/repositories/order-list';
import { searchFrom, SEARCH_LIMIT } from '@/server/domain/center-mobile';
import MobileOrders from '@/components/center/MobileOrders';

export const dynamic = 'force-dynamic';
export const metadata = { title: '주문 찾기' };

export default async function MobileOrdersPage() {
  await requireSector('design_center');

  // ★ 시계는 도메인이 읽습니다 — 화면 안에서 Date 를 부르면 순수성 검사에 걸립니다
  const result = await listOrderPage({
    from: searchFrom(),
    perPage: SEARCH_LIMIT,
    sort: 'received_at',
    dir: -1,
  });

  return <MobileOrders rows={result.rows} truncated={result.truncated || result.pages > 1} />;
}
