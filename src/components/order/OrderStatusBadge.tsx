// =========================================================
// 놓을 위치: src/components/order/OrderStatusBadge.tsx
//
// 주문 상태 배지. 목록 · 상세에서 함께 씁니다.
// =========================================================

import { STATUS_LABEL, type OrderStatus } from '@/server/domain/order-status';

const STATUS_STYLE: Record<OrderStatus, string> = {
  // ★ 회색입니다. 아직 아무 일도 시작 안 된 자리라 눈에 덜 띄어야 합니다
  uploading: 'bg-slate-100 text-slate-500',
  received: 'bg-blue-50 text-blue-700',
  rescan: 'bg-red-50 text-red-700',
  designing: 'bg-purple-50 text-purple-700',
  production_wait: 'bg-amber-50 text-amber-700',
  production: 'bg-amber-50 text-amber-700',
  shipping: 'bg-teal-50 text-teal-700',
  completed: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-gray-100 text-gray-400',
};

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={'rounded px-2 py-0.5 text-[13px] font-semibold ' + STATUS_STYLE[status]}>
      {STATUS_LABEL[status]}
    </span>
  );
}
