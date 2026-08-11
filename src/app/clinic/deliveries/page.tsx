// =========================================================
// 놓을 위치: src/app/clinic/deliveries/page.tsx
//
// 배송조회. (설계서 §9.1)
//   보이는 범위는 RLS 가 정합니다 — 치과는 자기 주문만.
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

export default async function ClinicDeliveriesPage({ searchParams }: PageProps) {
  const { week } = await searchParams;
  const today = todayInKst();

  // 이상한 값이 와도 이번 주로 떨어집니다
  const weekStart = getWeekStart(week && isValidIsoDate(week) ? week : today);
  const days = getWeekDays(weekStart);

  const orders = await listOrdersByDueDate(days[0], days[6]);

  return (
    <div>
      <h1 className="text-xl font-bold">배송조회</h1>
      <p className="mt-1 text-sm text-gray-500">
        요청시한을 기준으로 놓은 주간 보드입니다. 날짜 칸의 주문을 누르면 상세로 갑니다.
      </p>

      <div className="mt-5">
        <DeliveryBoard
          weekStart={weekStart}
          today={today}
          orders={orders}
          basePath="/clinic/deliveries"
          orderPath="/clinic/orders"
        />
      </div>
    </div>
  );
}
