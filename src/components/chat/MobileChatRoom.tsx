// =========================================================
// 놓을 위치: src/components/chat/MobileChatRoom.tsx
//
// 폰의 대화방 — 화면 하나가 대화창 전부입니다. (사용자 요청 2026-09-06)
//
// ★ 대화창 자체는 PC 와 **같은 조각**(OrderChat)입니다. 글·사진·읽음·
//   실시간이 한 벌이라 폰에서 쓴 글이 PC 창에 그대로 뜹니다.
//   여기서는 머리줄(환자·상대·뒤로)과 높이만 잡습니다.
// ★ 높이는 100dvh — 폰 주소창이 오르내려도 입력칸이 화면 밖으로
//   안 밀립니다. min-h-[420px] 는 OrderChat 이 갖고 있어 작은 폰에서도
//   목록이 뭉개지지 않습니다.
// ★ 실시간은 주문상세와 같은 두 길 — 신호(OrderSignal)가 빠른 길,
//   20초 폴링(AutoRefresh)이 반드시 오는 길.
// =========================================================

import Link from 'next/link';
import OrderChat from '@/components/order/OrderChat';
import OrderSignal from '@/components/order/OrderSignal';
import AutoRefresh from '@/components/layout/AutoRefresh';
import type { OrderMessage } from '@/server/repositories/order-message';
import type { Sector } from '@/server/domain/order-status';

export default function MobileChatRoom({
  orderId,
  orderNo,
  patientLabel,
  counterpart,
  messages,
  sector,
  detailHref,
}: {
  orderId: string;
  orderNo: string;
  patientLabel: string;
  /** 상대 조직 — 치과가 보면 센터, 센터가 보면 치과 */
  counterpart: string;
  messages: OrderMessage[];
  sector: Sector;
  /** 이 주문의 내용을 보는 곳. 센터는 폰 주문 화면, 치과는 촬영 화면 */
  detailHref: string | null;
}) {
  return (
    <main className="mx-auto flex h-[100dvh] max-w-[480px] flex-col">
      <OrderSignal orderId={orderId} />
      <AutoRefresh />

      <header className="flex items-center gap-2 border-b border-[var(--line)] bg-white px-3 py-2.5">
        <Link
          href="/m/chats"
          aria-label="대화 목록"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[22px] text-[var(--muted)] active:bg-[#F4F7FA]"
        >
          <span aria-hidden="true">&#8249;</span>
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-extrabold text-[var(--ink)]">{patientLabel}</h1>
          <p className="truncate text-[12px] text-[var(--muted)]">
            {counterpart && `${counterpart} · `}
            <span className="tabular-nums">{orderNo}</span>
          </p>
        </div>

        {detailHref && (
          <Link
            href={detailHref}
            className="shrink-0 rounded-full border border-[var(--line)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--muted)] active:bg-[#F4F7FA]"
          >
            주문 보기
          </Link>
        )}
      </header>

      {/* ★ 둥근 모서리·테두리는 카드일 때의 것 — 폰에서는 화면 끝까지 */}
      <div className="min-h-0 flex-1 [&>div]:rounded-none [&>div]:border-0">
        <OrderChat orderId={orderId} messages={messages} sector={sector} />
      </div>
    </main>
  );
}
