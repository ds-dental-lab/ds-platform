// =========================================================
// 놓을 위치: src/components/order/OrderHistory.tsx
//
// 주문이 지나온 길. 위에서 아래로 시간 순입니다.
// =========================================================

import { STATUS_LABEL } from '@/server/domain/order-status';
import { formatDateTime } from '@/lib/format/date';
import type { OrderHistoryRow } from '@/server/repositories/order';

export default function OrderHistory({ rows }: { rows: OrderHistoryRow[] }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <h2 className="border-b border-gray-200 px-5 py-3 text-sm font-bold text-gray-900">
        진행 이력
      </h2>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">
          아직 상태가 바뀐 적이 없습니다.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((row) => (
            <li key={row.id} className="px-5 py-3">
              <div className="flex flex-wrap items-center gap-2 text-[14px]">
                <span className="text-gray-400">
                  {row.from_status ? STATUS_LABEL[row.from_status] : '등록'}
                </span>
                <span className="text-gray-300">→</span>
                <span className="font-semibold text-gray-900">{STATUS_LABEL[row.to_status]}</span>

                {/* 볼 권한이 없는 조직은 이름이 비어서 옵니다 (설계서 §8.5) */}
                {row.actor_org_name && (
                  <span className="text-gray-500">· {row.actor_org_name}</span>
                )}

                <span className="ml-auto text-gray-400">{formatDateTime(row.created_at)}</span>
              </div>

              {row.reason && (
                <p className="mt-1.5 whitespace-pre-wrap rounded bg-gray-50 px-3 py-2 text-[14px] text-gray-700">
                  {row.reason}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
