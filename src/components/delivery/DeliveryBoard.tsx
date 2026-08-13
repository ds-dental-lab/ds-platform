// =========================================================
// 놓을 위치: src/components/delivery/DeliveryBoard.tsx
//
// 배송조회 주간 보드. (설계서 §9.1 배송조회, §9.2 배송관리)
//
// ★ 세 섹터가 같은 컴포넌트를 씁니다.
//   무엇이 보이는지는 화면이 아니라 RLS 가 정합니다 —
//   치과는 자기 것만, 디자인센터는 거래 치과 전부, 기공소는 배정받은 것만.
//   그래서 여기서는 섹터별 분기를 두지 않고 링크 경로만 받습니다.
//
// 배송조회는 별도 표가 아니라 요청시한 기준 달력입니다 (§1.2).
// =========================================================

import Link from 'next/link';
import OrderStatusBadge from '@/components/order/OrderStatusBadge';
import {
  getWeekDays,
  shiftWeek,
  isWeekend,
  formatDayLabel,
  formatWeekRange,
  type IsoDate,
} from '@/server/domain/week';
import { ISSUE_META } from '@/server/domain/order-list';
import type { OrderListRow } from '@/server/repositories/order';

export interface DeliveryBoardProps {
  weekStart: IsoDate;
  today: IsoDate;
  orders: OrderListRow[];
  /** 이 화면의 경로. 주 이동 링크를 여기에 붙입니다 */
  basePath: string;
  /** 주문 상세로 가는 경로. 섹터마다 다릅니다 */
  orderPath: string;
  /** 치과 이름을 칸에 적을지. 디자인센터·기공소만 켭니다 */
  showClinic?: boolean;
  /** 기공소를 보일지. 치과에는 감춥니다 (설계서 §8.5) */
  showLab?: boolean;
}

export default function DeliveryBoard({
  weekStart,
  today,
  orders,
  basePath,
  orderPath,
  showClinic = false,
  showLab = false,
}: DeliveryBoardProps) {
  const days = getWeekDays(weekStart);

  // 날짜별로 나눠 담습니다. 요청시한이 곧 배송 기준일입니다.
  const byDay = new Map<IsoDate, OrderListRow[]>();
  for (const day of days) byDay.set(day, []);
  for (const order of orders) byDay.get(order.due_date)?.push(order);

  const thisWeekTotal = orders.length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`${basePath}?week=${shiftWeek(weekStart, -1)}`}
            className="rounded border border-gray-300 px-3 py-1.5 text-[14px] hover:bg-gray-50"
          >
            ← 이전 주
          </Link>
          <Link
            href={basePath}
            className="rounded border border-gray-300 px-3 py-1.5 text-[14px] hover:bg-gray-50"
          >
            이번 주
          </Link>
          <Link
            href={`${basePath}?week=${shiftWeek(weekStart, 1)}`}
            className="rounded border border-gray-300 px-3 py-1.5 text-[14px] hover:bg-gray-50"
          >
            다음 주 →
          </Link>
        </div>

        <span className="text-sm text-gray-600">
          <b className="text-gray-900">{formatWeekRange(weekStart)}</b>
          <span className="ml-2 text-gray-400">{thisWeekTotal}건</span>
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {days.map((day) => {
          const dayOrders = byDay.get(day) ?? [];
          const isToday = day === today;

          return (
            <div
              key={day}
              className={
                'flex min-h-40 flex-col rounded-lg border ' +
                (isToday
                  ? 'border-blue-400 bg-blue-50/40'
                  : isWeekend(day)
                    ? 'border-gray-200 bg-gray-50'
                    : 'border-gray-200 bg-white')
              }
            >
              <div
                className={
                  'flex items-center justify-between border-b px-3 py-2 ' +
                  (isToday ? 'border-blue-200' : 'border-gray-100')
                }
              >
                <span
                  className={
                    'text-[14px] font-bold ' +
                    (isToday
                      ? 'text-blue-700'
                      : isWeekend(day)
                        ? 'text-gray-400'
                        : 'text-gray-700')
                  }
                >
                  {formatDayLabel(day)}
                </span>

                {dayOrders.length > 0 && (
                  <span className="rounded-full bg-gray-800 px-1.5 text-[11px] font-bold text-white">
                    {dayOrders.length}
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-1.5 p-2">
                {dayOrders.length === 0 ? (
                  <p className="py-4 text-center text-[13px] text-gray-300">-</p>
                ) : (
                  dayOrders.map((order) => (
                    <Link
                      key={order.id}
                      href={`${orderPath}/${order.id}`}
                      className="block rounded border border-gray-200 bg-white px-2 py-1.5 hover:border-gray-400"
                    >
                      {/*
                        ★ 주문번호를 뺐습니다 (사용자 결정 2026-08-12).
                          달력에서 찾는 것은 "누구 것이 언제 나가나" 이지
                          번호가 아닙니다. 번호는 상세에 들어가면 있습니다.
                      */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-[13.5px] font-bold text-[#1A2130]">
                          {order.patient_label}
                        </span>
                        <OrderStatusBadge status={order.status} />
                      </div>

                      {showClinic && order.clinic_name && (
                        <p className="mt-0.5 truncate text-[11px] text-gray-500">
                          {order.clinic_name}
                        </p>
                      )}

                      {/* ★ 치과에는 기공소가 안 보입니다 (설계서 §8.5) */}
                      {showLab && order.lab_name && (
                        <p className="truncate text-[11px] text-gray-400">{order.lab_name}</p>
                      )}

                      <div className="mt-1 flex items-center justify-between gap-1">
                        <span className="text-[10.5px] tabular-nums text-gray-400">
                          {order.created_at.slice(2, 10)}
                        </span>

                        {order.issue && (
                          <span
                            className="rounded px-1.5 py-px text-[10px] font-bold"
                            style={{
                              background: ISSUE_META[order.issue].bg,
                              color: ISSUE_META[order.issue].fg,
                            }}
                          >
                            {ISSUE_META[order.issue].label}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
