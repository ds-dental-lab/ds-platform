// =========================================================
// 놓을 위치: src/app/clinic/orders/page.tsx
//
// 치과 주문목록. (기능명세서 §4.3)
//   기공소명은 내려오지 않고, 치과명 검색도 없습니다 — 자기 치과뿐입니다.
// =========================================================

import OrderListScreen from '@/components/order/OrderListScreen';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ClinicOrderListPage({ searchParams }: PageProps) {
  return (
    <OrderListScreen
      sector="clinic"
      title="주문목록"
      basePath="/clinic/orders"
      orderPath="/clinic/orders"
      showLab={false}
      showClinicSearch={false}
      searchParams={await searchParams}
    />
  );
}
