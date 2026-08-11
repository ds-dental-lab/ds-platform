// =========================================================
// 놓을 위치: src/app/design/orders/page.tsx
//
// 디자인센터 주문목록. (기능명세서 §5 — 모든 거래 치과 대상)
//   기공소 열과 치과명 검색이 함께 나옵니다.
// =========================================================

import OrderListScreen from '@/components/order/OrderListScreen';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DesignOrderListPage({ searchParams }: PageProps) {
  return (
    <OrderListScreen
      sector="design_center"
      title="주문관리"
      basePath="/design/orders"
      orderPath="/design/orders"
      showLab
      showClinicSearch
      searchParams={await searchParams}
    />
  );
}
