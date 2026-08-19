// =========================================================
// 놓을 위치: src/components/home/UnreadChatStrip.tsx
//
// HOME 맨 위의 안 읽은 대화 띠. (사용자 요청 2026-08-19 —
//   "Home 화면에서든 주문목록에서든 뭔가 확실하게 알림을 줄 수 있는 게
//    필요해 보여")
//
// ★ 카드 세 칸에 안 끼웁니다.
//   HOME 왼쪽·가운데·오른쪽은 아래끝을 맞추는 균형이 잡혀 있어서
//   (HomeScreen 머리말), 카드 하나를 끼우면 그 균형을 다시 잡아야
//   합니다. 띠는 그 위에 따로 삽니다 — 있을 때만 나타나고, 없으면
//   화면이 전과 완전히 같습니다.
//
// ★ 주문번호만 싣습니다. 환자 이름은 안 싣습니다.
//   지나가는 눈에도 밟히라고 만든 자리라, 볼 권한을 따질 필요가 없는
//   값만 둡니다.
//
// ★ 서버 컴포넌트입니다. 스스로 읽어 오므로 HOME 페이지는 한 줄만
//   얹으면 됩니다. HOME 의 AutoRefresh 가 갱신도 같이 해 줍니다.
// =========================================================

import Link from 'next/link';
import { listUnreadChatOrders } from '@/server/repositories/notification';

export default async function UnreadChatStrip({ orderPath }: { orderPath: string }) {
  const orders = await listUnreadChatOrders();
  if (orders.length === 0) return null;

  const total = orders.reduce((sum, order) => sum + order.count, 0);

  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-2.5 rounded-lg border border-[#CFE3F8] bg-[#F2F7FE] px-4 py-2.5">
      <span className="flex items-center gap-1.5 text-[13.5px] font-bold text-[#1279E8]">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 2C4.1 2 1 4.6 1 7.8c0 1.8 1 3.4 2.6 4.5-.1.8-.5 1.9-1.3 2.7 1.5-.2 2.8-.8 3.7-1.4.6.1 1.3.2 2 .2 3.9 0 7-2.6 7-5.9S11.9 2 8 2Z" />
        </svg>
        안 읽은 대화 {total}건
      </span>

      {orders.map((order) => (
        <Link
          key={order.orderId}
          href={`${orderPath}/${order.orderId}`}
          className="rounded-full border border-[#CFE3F8] bg-white px-3 py-1 text-[12.5px] font-semibold tabular-nums text-[#2C5D97] hover:border-[#1279E8] hover:text-[#1279E8]"
        >
          {order.orderNo}
          <b className="ml-1 font-extrabold text-[#1279E8]">{order.count}</b>
        </Link>
      ))}
    </div>
  );
}
