// =========================================================
// 놓을 위치: src/components/home/UnreadChatBanner.tsx
//
// 안 읽은 대화 띠 — **그리는 부분만.**
//
// ★ 읽어 오는 곳(UnreadChatStrip)과 나눠 뒀습니다.
//   이 자리는 눈으로 봐야 맞는지 알 수 있는데, 스스로 읽어 오는
//   조각은 로그인한 화면 안에서만 살아 있어 열어 볼 수가 없습니다.
//   나눠 두면 시연 화면(/playground/home)에서 그대로 띄워 볼 수 있습니다.
//
// ★ 파란 안내 띠가 아니라 **주황 알림 띠**입니다 (2026-08-19).
//   파랑은 이 화면에서 '눌러 볼 것' 을 가리키는 색이라(링크·상태) 같은
//   색으로는 도드라지지 않습니다. 주황은 여기밖에 안 씁니다.
//   빨강은 안 씁니다 — 안 읽은 대화는 '고장' 이 아니라 '기다리는 일' 입니다.
//
// ★ 점 하나만 깜빡입니다. 띠 전체가 움직이면 화면을 볼 때마다
//   거슬립니다. 움직임을 줄여 둔 분께는 안 깜빡입니다(motion-reduce).
// =========================================================

import Link from 'next/link';
import type { UnreadChatOrder } from '@/server/repositories/notification';

export interface UnreadChatBannerProps {
  orders: UnreadChatOrder[];
  /** '/design/orders' 처럼 섹터별 주문 주소 */
  orderPath: string;
}

export default function UnreadChatBanner({ orders, orderPath }: UnreadChatBannerProps) {
  if (orders.length === 0) return null;

  const total = orders.reduce((sum, order) => sum + order.count, 0);

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-[#F3C98B] bg-[#FFF8EC] shadow-[0_1px_3px_rgba(194,114,27,0.10)]">
      {/* 위쪽 진한 줄 — 띠를 통째로 칠하지 않고 이 한 줄만 강하게 */}
      <div className="h-1 bg-[#E8912B]" />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3.5">
        <span className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E8912B] opacity-70 motion-reduce:hidden" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#E8912B]" />
          </span>

          <b className="text-[15px] font-extrabold tracking-[-0.02em] text-[#8A5A12]">
            읽지 않은 대화 {total}건
          </b>
        </span>

        {orders.map((order) => (
          <Link
            key={order.orderId}
            href={`${orderPath}/${order.orderId}`}
            title={order.orderNo}
            className="flex items-center gap-1.5 rounded-full border border-[#F0D3A4] bg-white px-3.5 py-1.5 text-[14px] font-bold text-[#5A4318] transition-colors hover:border-[#E8912B] hover:bg-[#FFF3DE]"
          >
            {/* 이름이 없는 주문만 주문번호로 돌아갑니다 */}
            <span className={order.patientCall ? '' : 'tabular-nums'}>
              {order.patientCall ?? order.orderNo}
            </span>

            <b className="grid h-5 min-w-5 place-items-center rounded-full bg-[#E8912B] px-1.5 text-[12px] font-extrabold tabular-nums leading-none text-white">
              {order.count}
            </b>
          </Link>
        ))}
      </div>
    </div>
  );
}
