// =========================================================
// 놓을 위치: src/app/lab/shipments/page.tsx
//
// 출고 예정. (설계서 §9.3)
//   보이는 범위는 RLS 가 정합니다 — 기공소는 배정받은 건만.
//   환자 이름은 마스킹 값으로 옵니다 (§8.5).
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

export default async function LabShipmentsPage({ searchParams }: PageProps) {
  const { week } = await searchParams;
  const today = todayInKst();

  const weekStart = getWeekStart(week && isValidIsoDate(week) ? week : today);
  const days = getWeekDays(weekStart);

  const orders = await listOrdersByDueDate(days[0], days[6]);

  return (
    <div>
      <h1 className="text-xl font-bold">출고 예정</h1>
      <p className="mt-1 text-sm text-gray-500">
        배정받은 건을 요청시한 기준으로 봅니다. 어느 날까지 끝내야 하는지가 기준입니다.
      </p>

      <div className="mt-5">
        <DeliveryBoard
          weekStart={weekStart}
          today={today}
          orders={orders}
          basePath="/lab/shipments"
          orderPath="/lab/orders"
          showClinic
        />
      </div>
    </div>
  );
}
