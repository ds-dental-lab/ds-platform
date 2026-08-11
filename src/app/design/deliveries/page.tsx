// =========================================================
// 놓을 위치: src/app/design/deliveries/page.tsx
//
// 배송관리. (설계서 §9.2 — 전체 치과 대상)
//   보이는 범위는 RLS 가 정합니다 — 디자인센터는 거래 치과 주문 전부.
// =========================================================

import { listOrdersByDueDate } from '@/server/repositories/order';
import DeliveryBoard from '@/components/delivery/DeliveryBoard';
import {
  getWeekStart,
  getWeekDays,
  todayInKst,
  isValidIsoDate,
} from '@/server/domain/week';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ week?: string }>;
}

export default async function DesignDeliveriesPage({ searchParams }: PageProps) {
  const { week } = await searchParams;
  const today = todayInKst();

  const weekStart = getWeekStart(week && isValidIsoDate(week) ? week : today);
  const days = getWeekDays(weekStart);

  const orders = await listOrdersByDueDate(days[0], days[6]);

  return (
    <div>
      <h1 className="text-xl font-bold">배송관리</h1>
      <p className="mt-1 text-sm text-gray-500">
        거래 치과의 요청시한을 한 주 단위로 봅니다. 어느 날에 일이 몰리는지 미리 보입니다.
      </p>

      <div className="mt-5">
        <DeliveryBoard
          weekStart={weekStart}
          today={today}
          orders={orders}
          basePath="/design/deliveries"
          orderPath="/design/orders"
          showClinic
        />
      </div>
    </div>
  );
}
