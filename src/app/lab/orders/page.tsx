// =========================================================
// 놓을 위치: src/app/lab/orders/page.tsx
//
// 기공소 작업목록. (설계서 §9.3)
//   배정받은 건만 보이고, 환자명은 마스킹 값으로 옵니다 (§8.5).
// =========================================================

import OrderListScreen from '@/components/order/OrderListScreen';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LabOrderListPage({ searchParams }: PageProps) {
  return (
    <OrderListScreen
      title="작업목록"
      basePath="/lab/orders"
      orderPath="/lab/orders"
      showLab={false}
      showClinicSearch
      searchParams={await searchParams}
    />
  );
}
